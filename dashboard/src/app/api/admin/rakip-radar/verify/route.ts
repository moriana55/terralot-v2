import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import {
  isSyntheticApn,
  regridPath,
  type TrackedListing,
  type Verification,
} from "@/lib/rakip-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGRID_TOKEN = process.env.REGRID_API_TOKEN || "";
const BASE = "https://app.regrid.com/api/v2";

const bodySchema = z.object({ key: z.string().min(1).max(500) });

// Regrid parsel cevabından malik adını çek (search ve detail şekilleri farklı).
type RegridFeature = {
  properties?: { owner?: string; fields?: { owner?: string | null } | null } | null;
};
function extractOwner(json: unknown): string | null {
  const j = json as { parcels?: { features?: RegridFeature[] }; features?: RegridFeature[] };
  const f = (j?.parcels?.features ?? j?.features ?? [])[0];
  return f?.properties?.fields?.owner ?? f?.properties?.owner ?? null;
}

// Malik adı rakibin adına benziyor mu? ("DISCOUNT LOTS LLC" vs "Discount Lots")
function ownerLooksLikeCompetitor(owner: string, competitor: string | null): boolean {
  if (!competitor) return false;
  const o = owner.toLowerCase();
  const tokens = competitor.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  return tokens.length > 0 && tokens.every((t) => o.includes(t));
}

// POST /api/admin/rakip-radar/verify — "satış şüphesi"ndeki ilan için Regrid
// üzerinden GÜNCEL malik kontrolü. Malik rakip DEĞİLSE → SATIŞ DOĞRULANDI
// (Regrid). Malik hâlâ rakipse → satış doğrulanamadı (çekilmiş olabilir).
// DÜRÜSTLÜK: rakip hiç tapuya girmemiş olabilir (assignment/double-close) —
// sonuç ne olursa olsun Recorder linkiyle manuel teyit önerilir.
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const s = supabaseAdmin();
  const { data: t, error } = await s
    .from("competitor_tracked")
    .select("*")
    .eq("listing_key", parsed.data.key)
    .maybeSingle<TrackedListing>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!t) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });

  if (!REGRID_TOKEN) {
    return NextResponse.json({
      ok: false,
      reason: "REGRID_API_TOKEN yok — otomatik malik kontrolü yapılamıyor. Recorder linkiyle manuel doğrula.",
    });
  }
  if (!t.apn || isSyntheticApn(t.apn)) {
    return NextResponse.json({
      ok: false,
      reason: "Gerçek APN yok (scraper sentetik APN üretmiş) — Regrid sorgusu atlanıyor. Recorder'da rakip adıyla (grantor) manuel ara.",
    });
  }
  const path = regridPath(t.state, t.county);
  if (!path) {
    return NextResponse.json({ ok: false, reason: "Eyalet/ilçe bilinmiyor — Regrid path kurulamadı." });
  }

  try {
    const url = `${BASE}/parcels/apn?parcelnumb=${encodeURIComponent(t.apn)}&path=${encodeURIComponent(path)}&token=${encodeURIComponent(REGRID_TOKEN)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${REGRID_TOKEN}` },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      // Trial token bölge kısıtı ("This area is not included in API trials") gibi
      // upstream mesajını aynen göster — kullanıcı neden çalışmadığını bilsin.
      const upstream = (json as { message?: string } | null)?.message?.replace(/\.$/, "");
      return NextResponse.json({
        ok: false,
        reason: `Regrid ${res.status}: ${upstream || "APN eşleşmedi olabilir"}. Recorder linkiyle manuel doğrula.`,
      });
    }
    const owner = extractOwner(json);
    if (!owner) {
      return NextResponse.json({ ok: false, reason: "Regrid parseli buldu ama malik alanı boş — manuel doğrula." });
    }

    const stillCompetitor = ownerLooksLikeCompetitor(owner, t.competitor);
    const verification: Verification = {
      method: "regrid-owner",
      owner,
      ownerChanged: !stillCompetitor,
      checkedAt: new Date().toISOString(),
      note: stillCompetitor
        ? "Malik hâlâ rakip görünüyor — satış doğrulanamadı (ilan çekilmiş olabilir)."
        : "Malik rakip değil → satış doğrulandı (Regrid). Not: rakip tapuya hiç girmemiş olabilir (assignment) — Recorder ile kesinleştir.",
    };

    const update: Partial<TrackedListing> = { verification };
    if (!stillCompetitor && t.status === "SUSPECTED_SOLD") update.status = "SOLD_VERIFIED";

    const { error: uerr } = await s
      .from("competitor_tracked")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("listing_key", t.listing_key);
    if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 });

    if (update.status === "SOLD_VERIFIED") {
      await s.from("competitor_events").insert({
        listing_key: t.listing_key,
        type: "STATUS_CHANGED",
        old_value: { status: t.status },
        new_value: { status: "SOLD_VERIFIED", via: "regrid-owner", owner },
        delta: null,
      });
    }

    return NextResponse.json({ ok: true, owner, ownerChanged: !stillCompetitor, verification, newStatus: update.status ?? t.status });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "Regrid sorgusu başarısız" });
  }
}
