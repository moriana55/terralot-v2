import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// DEVRE DIŞI — bu route artık çalışmıyor (410 Gone).
//
// Eski hâli GERÇEK bir scraper DEĞİLDİ: Math.random() ile sahte owner adı,
// fiyat, APN ve adres üretip canlı `tax_delinquent_properties` tablosuna insert
// ediyordu — yani prod veriyi sahte kayıtlarla kirletiyordu. Bu da outreach/Lob
// pipeline'ının yanlış sahip/adres verisiyle gerçek mektup atma riskini doğuruyordu.
//
// Hiçbir şey INSERT EDİLMEZ. Gerçek lead'ler yalnızca doğrulanabilir kaynaklardan
// (tax-roll / Regrid) gelir ve /api/admin/sync-deals üzerinden senkronlanır.
// Sahte veri üretimi kalıcı olarak kaldırıldı.
// ─────────────────────────────────────────────────────────────────────────────

const DISABLED = {
  error: "gone",
  message:
    "zillow-scraper kalıcı olarak devre dışı bırakıldı. Bu endpoint Math.random ile " +
    "sahte owner/fiyat/APN üretip canlı tabloyu kirletiyordu. Gerçek lead'ler " +
    "/api/admin/sync-deals üzerinden doğrulanabilir kaynaklardan gelir. Hiçbir veri yazılmaz.",
} as const;

export async function POST() {
  return NextResponse.json(DISABLED, { status: 410 });
}

export async function GET() {
  return NextResponse.json(DISABLED, { status: 410 });
}
