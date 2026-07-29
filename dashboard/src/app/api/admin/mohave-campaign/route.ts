import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { supabaseAdmin } from "@/lib/supabase";
import mohave from "@/data/mohave-offmarket.json";
import {
  buildCampaign, buildLetterBody, buildTop750Campaign, campaignToCsv, excludeMailed, ownerKey,
  type CampaignFilter, type CampaignLetter, type CampaignResult, type MohaveRow, type Top750Result,
} from "@/lib/mohave-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE MEKTUP KAMPANYASI API — segment → sahip-dedupe → Lob-ready CSV + GÖNDERİM.
// GET: özet + önizleme (?format=csv tam liste; ?excludeMailed=1 log'daki
//      sahipleri düşer — tablo yoksa graceful).
// POST: "Kampanyayı Başlat" — segmenti sunucuda YENİDEN hesaplar, sayı istemcinin
//      onayladığıyla eşleşmezse 409 (yanlışlıkla 735 mektup gitmesin). LOB_API_KEY
//      yoksa DRY-RUN: hiçbir şey gönderilmez/yazılmaz, gidecekler raporlanır.
// Admin-gated: est_offer içeren çıktı hiçbir public yüzeye gitmez; mektup
// gövdesine est_offer/spread ASLA girmez (buildLetterBody testli).
// ─────────────────────────────────────────────────────────────────────────────

const ROWS = ((mohave as { rows?: MohaveRow[] }).rows ?? []) as MohaveRow[];

// Bölge listesi bir kez hesaplanır (filtre dropdown'u için).
const REGIONS = [...new Set(ROWS.map((r) => (r.region || "").trim()).filter(Boolean))].sort();

// Tek POST'ta üst sınır: parmak kayması / filtre unutması 20K mektuba dönmesin.
const MAX_BATCH = 1500;
const LOB_BASE = "https://api.lob.com/v1";
// ⭐ "En İyi 750" reçetesi: skora göre azalan sıralı ilk N parsel.
const TOP750_N = 750;

const numParam = (v: string | null): number | undefined => {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function filterFromParams(sp: URLSearchParams): CampaignFilter {
  const scope = sp.get("ownerScope");
  const apnsParam = sp.get("apns");
  return {
    region: sp.get("region") || undefined,
    minAcres: numParam(sp.get("minAcres")),
    maxAcres: numParam(sp.get("maxAcres")),
    maxLandValue: numParam(sp.get("maxLandValue")),
    minScore: numParam(sp.get("minScore")),
    ownerScope: scope === "absentee" || scope === "instate" ? scope : "all",
    minParcels: numParam(sp.get("minParcels")),
    // 🗺️ Haritadan seçim köprüsü: /admin/alinabilir-harita'da sepete eklenen
    // parseller buraya virgülle ayrılmış APN listesi olarak gelir.
    apns: apnsParam ? apnsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
  };
}

// Log tablosundaki owner_key'ler. Tablo yok / env yok / hata → null döner ve
// çağıran "exclusion kullanılamadı" diye dürüstçe raporlar (sessiz 0 sanma yok).
async function fetchMailedKeys(): Promise<Set<string> | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const keys = new Set<string>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin()
        .from("mail_campaign_log")
        .select("owner_key")
        .in("status", ["sent"]) // failed/dry_run tekrar denemeyi ENGELLEMEZ
        .range(from, from + PAGE - 1);
      if (error) return null; // tablo henüz yaratılmamış olabilir — graceful
      for (const r of data ?? []) if (r.owner_key) keys.add(r.owner_key as string);
      if (!data || data.length < PAGE) break;
    }
    return keys;
  } catch {
    return null;
  }
}

async function applyExclusion(letters: CampaignLetter[], wantExclude: boolean) {
  if (!wantExclude) return { letters, excludedMailed: 0, exclusionAvailable: null as boolean | null };
  const mailed = await fetchMailedKeys();
  if (mailed == null) return { letters, excludedMailed: 0, exclusionAvailable: false };
  const { kept, excluded } = excludeMailed(letters, mailed);
  return { letters: kept, excludedMailed: excluded, exclusionAvailable: true };
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const isTop750 = sp.get("top750") === "1";
  // ⭐ "En İyi 750": diğer segment filtreleri yok sayılır, skora göre otomatik seçim yapılır.
  const c: CampaignResult | Top750Result = isTop750
    ? buildTop750Campaign(ROWS, TOP750_N)
    : buildCampaign(ROWS, filterFromParams(sp));
  const ex = await applyExclusion(c.letters, sp.get("excludeMailed") === "1");
  const letters = ex.letters;

  if (sp.get("format") === "csv") {
    const stamp = new Date().toISOString().slice(0, 10);
    const tag = isTop750 ? "en-iyi-750" : sp.get("apns") ? "harita-secimi" : "kampanya";
    return new NextResponse(campaignToCsv(letters), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mohave-${tag}-${stamp}-${letters.length}mektup.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    summary: {
      letters: letters.length,
      parcels: letters.reduce((a, l) => a + l.parcelCount, 0),
      totalAcres: Math.round(letters.reduce((a, l) => a + l.totalAcres, 0) * 10) / 10,
      totalOffer: Math.round(letters.reduce((a, l) => a + l.totalOffer, 0)),
      skippedNoAddress: c.skippedNoAddress,
      skippedGovOwner: c.skippedGovOwner,
      excludedMailed: ex.excludedMailed,
      sourceRows: ROWS.length,
      ...(isTop750
        ? {
            requestedTopN: (c as Top750Result).requestedTopN,
            consideredParcels: (c as Top750Result).consideredParcels,
            avgScore: (c as Top750Result).avgScore,
            regionBreakdown: (c as Top750Result).regionBreakdown,
          }
        : {}),
    },
    exclusionAvailable: ex.exclusionAvailable,
    lobConfigured: Boolean(process.env.LOB_API_KEY),
    regions: REGIONS,
    preview: letters.slice(0, 120),
  });
}

// ─── POST: Kampanyayı Başlat ─────────────────────────────────────────────────

const sendSchema = z.object({
  action: z.literal("send_campaign"),
  campaign: z.string().trim().min(3).max(80),
  filter: z.object({
    region: z.string().max(80).optional(),
    minAcres: z.number().optional(),
    maxAcres: z.number().optional(),
    maxLandValue: z.number().optional(),
    minScore: z.number().optional(),
    ownerScope: z.enum(["all", "absentee", "instate"]).optional(),
    minParcels: z.number().optional(),
    /** 🗺️ Haritadan seçilen APN listesi (varsa) — bkz. filterFromParams. */
    apns: z.array(z.string()).optional(),
  }),
  /** true ise 'filter' yok sayılır — ⭐ "En İyi 750" reçetesi skora göre kendi seçimini yapar. */
  top750: z.boolean().optional(),
  excludeMailed: z.boolean(),
  /** İstemcinin onay modal'ında gördüğü mektup sayısı — eşleşmezse 409. */
  expectedLetters: z.number().int().positive(),
});

function fromAddress() {
  return {
    name: process.env.LOB_FROM_NAME || "VegaLand Acquisitions",
    address_line1: process.env.LOB_FROM_LINE1 || "1234 Main St",
    address_city: process.env.LOB_FROM_CITY || "Austin",
    address_state: process.env.LOB_FROM_STATE || "TX",
    address_zip: process.env.LOB_FROM_ZIP || "78701",
  };
}

function letterContact() {
  return {
    company: process.env.LOB_FROM_NAME || "VegaLand Acquisitions",
    phone: process.env.CAMPAIGN_CONTACT_PHONE || undefined,
    email: process.env.CAMPAIGN_CONTACT_EMAIL || undefined,
  };
}

interface SendOutcome {
  owner: string;
  ownerKey: string;
  lobId: string | null;
  status: "sent" | "failed";
  error?: string;
}

async function sendOne(l: CampaignLetter, apiKey: string, campaign: string): Promise<SendOutcome> {
  const key = ownerKey(l);
  try {
    const res = await fetch(`${LOB_BASE}/letters`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: `VegaLand kampanya: ${campaign}`,
        to: {
          name: l.owner.slice(0, 40), // Lob name limiti
          address_line1: l.address,
          address_city: l.city,
          address_state: l.state,
          address_zip: l.zip,
        },
        from: fromAddress(),
        // Lob "file": HTML gövde. Düz metni <pre benzeri> basit HTML'e sarıyoruz.
        file: `<html><body style="font-family:Georgia,serif;font-size:12px;line-height:1.5;white-space:pre-wrap;padding:32px;">${
          buildLetterBody(l, letterContact()).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        }</body></html>`,
        color: false,
        use_type: "operational",
      }),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } } | null)?.error?.message || `HTTP ${res.status}`;
      return { owner: l.owner, ownerKey: key, lobId: null, status: "failed", error: msg };
    }
    return { owner: l.owner, ownerKey: key, lobId: (data as { id?: string } | null)?.id ?? null, status: "sent" };
  } catch (e) {
    return { owner: l.owner, ownerKey: key, lobId: null, status: "failed", error: String(e) };
  }
}

async function logOutcomes(campaign: string, letters: CampaignLetter[], outcomes: SendOutcome[]): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase env yok — gönderim loglanamadı (mail_campaign_log boş kalır, exclusion çalışmaz).";
  }
  const byKey = new Map(letters.map((l) => [ownerKey(l), l]));
  const rows = outcomes.map((o) => {
    const l = byKey.get(o.ownerKey);
    return {
      campaign,
      owner_key: o.ownerKey,
      owner: o.owner,
      mailing_address: l ? `${l.address}, ${l.city} ${l.state} ${l.zip}` : null,
      apns: l?.apns ?? [],
      parcel_count: l?.parcelCount ?? null,
      total_acres: l ? Math.round(l.totalAcres * 100) / 100 : null,
      lob_id: o.lobId,
      status: o.status,
    };
  });
  try {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin().from("mail_campaign_log").insert(rows.slice(i, i + 500));
      if (error) return `Log yazılamadı (${error.message}) — mail_campaign_log.sql çalıştırıldı mı?`;
    }
    return null;
  } catch (e) {
    return `Log yazılamadı: ${String(e)}`;
  }
}

export async function POST(req: NextRequest) {
  // Gönderim ucu: sıkı limit — bu uç gerçek para harcar.
  const limited = enforceRateLimit(req, { limit: 5 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Segmenti sunucuda yeniden hesapla — istemcinin gördüğü sayıyla eşleşmeli.
  const c: CampaignResult = body.top750 ? buildTop750Campaign(ROWS, TOP750_N) : buildCampaign(ROWS, body.filter);
  const ex = await applyExclusion(c.letters, body.excludeMailed);
  const letters = ex.letters;

  if (body.excludeMailed && ex.exclusionAvailable === false) {
    return NextResponse.json(
      { error: "exclusion_unavailable", message: "mail_campaign_log okunamadı — 'daha önce gönderilenleri hariç tut' istendi ama doğrulanamıyor. Önce scraper/sql/mail_campaign_log.sql çalıştırın veya toggle'ı kapatın." },
      { status: 409 }
    );
  }
  if (letters.length === 0) {
    return NextResponse.json({ error: "empty_segment", message: "Bu segmentte gönderilecek mektup yok." }, { status: 400 });
  }
  if (letters.length !== body.expectedLetters) {
    return NextResponse.json(
      { error: "count_mismatch", expected: body.expectedLetters, actual: letters.length, message: "Segment sayısı onayladığınızdan farklı — sayfayı yenileyip tekrar onaylayın." },
      { status: 409 }
    );
  }
  if (letters.length > MAX_BATCH) {
    return NextResponse.json(
      { error: "batch_too_large", max: MAX_BATCH, actual: letters.length, message: `Tek seferde en fazla ${MAX_BATCH} mektup — segmenti daraltın.` },
      { status: 400 }
    );
  }

  const apiKey = process.env.LOB_API_KEY;

  // DRY-RUN: key yok → hiçbir şey gönderilmez, hiçbir şey yazılmaz.
  if (!apiKey) {
    return NextResponse.json({
      dryRun: true,
      campaign: body.campaign,
      letters: letters.length,
      parcels: letters.reduce((a, l) => a + l.parcelCount, 0),
      sample: letters.slice(0, 10).map((l) => ({
        owner: l.owner, address: `${l.address}, ${l.city} ${l.state} ${l.zip}`, parcelCount: l.parcelCount,
      })),
      sampleBody: buildLetterBody(letters[0], letterContact()),
      message: "LOB_API_KEY tanımlı değil — DRY-RUN. Key gelince aynı buton gerçek gönderim yapar.",
    });
  }

  // Gerçek gönderim: 4'lü eşzamanlılık (Lob rate limitine nazik, 735 mektup ~makul sürede).
  const outcomes: SendOutcome[] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < letters.length; i += CONCURRENCY) {
    const batch = letters.slice(i, i + CONCURRENCY);
    outcomes.push(...(await Promise.all(batch.map((l) => sendOne(l, apiKey, body.campaign)))));
  }
  const sent = outcomes.filter((o) => o.status === "sent");
  const failed = outcomes.filter((o) => o.status === "failed");
  const logWarning = await logOutcomes(body.campaign, letters, outcomes);

  return NextResponse.json({
    dryRun: false,
    campaign: body.campaign,
    sent: sent.length,
    failed: failed.length,
    failures: failed.slice(0, 20).map((f) => ({ owner: f.owner, error: f.error })),
    logWarning,
  });
}
