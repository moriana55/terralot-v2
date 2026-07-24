import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { upsertPublishedListing } from "@/lib/parcel-listing-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// İLAN YAYINLA — /api/admin/listing-publish  (admin-gated + rate-limited)
//
// İlan Üreteci akışının "Kaydet/Yayınla" ucu. Composer'ın (lib/listing-builder)
// ürettiği — ve admin'in gözden geçirip düzenlediği — ilan metnini parsele bağlı
// olarak saklar; /p/[id] bu override'ı tercih eder.
//
// DEGRADE: parcel_listings tablosu yoksa akış kırılmaz → persisted:false döner
// (owner-finance/route.ts isMissingTable kalıbı). Composer zaten /p'de otomatik
// çalışır; yayınlama sadece elle düzenlenmiş metni sabitler.
//
// GÜVENLİK: yalnızca buyer-facing metin (title/description/bullets) saklanır —
// marj/alış-maliyeti/kâr gibi iç alanlar bu uca girmez, /p'ye sızamaz.
// ─────────────────────────────────────────────────────────────────────────────

const schema = z.object({
  parcelRef: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(4000),
  bullets: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  status: z.enum(["published", "draft"]).default("published"),
});

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 30 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const raw = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await upsertPublishedListing(parsed.data);
  return NextResponse.json({
    persisted: result.persisted,
    listing: result.listing,
    reason: result.reason,
    note: result.persisted
      ? "Yayınlandı — /p sayfası artık bu metni gösterir."
      : "Optimistik kaydedildi (kalıcı DEĞİL). Kalıcı yayın için sql/parcel_listings.sql Supabase'de çalıştırılmalı; o zamana dek /p otomatik üretilen metni gösterir.",
  });
}
