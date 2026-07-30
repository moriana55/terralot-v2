import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// NOT KALİBRASYONU — "bu not neden bu not?" kanıtı, CANLI.
//
// Sabit rakam YOK: her sayı ya offmarket_leads'ten (band dağılımı) ya da
// grade_calibration tablosundan gelir. grade_calibration'ı
// `node scraper/not-kalibrasyon.mjs` üretir: FL land_comps'taki GERÇEKLEŞMİŞ
// kol satışlarını APN ile lead'lere bağlayıp notu dış bir sonuçla sınar.
//
// Tablo/şema yoksa hata değil, kurulum talimatı döner (ekran çökmez).
// ─────────────────────────────────────────────────────────────────────────────

export type KalibSatir = {
  tur: string; anahtar: string;
  n_lead: number | null; n_satis: number | null; satis_orani: number | null;
  med_satis: number | null; ort_skor: number | null;
  ek: Record<string, unknown> | null; built_at: string | null;
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();

  const { data, error } = await s
    .from("grade_calibration")
    .select("tur, anahtar, n_lead, n_satis, satis_orani, med_satis, ort_skor, ek, built_at");

  if (error) {
    const msg = error.message ?? "";
    if (/does not exist|schema cache|relation/i.test(msg)) {
      return NextResponse.json({
        hazir: false,
        kurulum: "node scraper/not-kalibrasyon.mjs",
        not: msg,
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const rows = (data ?? []) as KalibSatir[];
  const al = (tur: string) => rows.filter((r) => r.tur === tur);
  const ozet = Object.fromEntries(al("ozet").map((r) => [r.anahtar, r]));

  return NextResponse.json({
    hazir: rows.length > 0,
    kurulum: rows.length ? null : "node scraper/not-kalibrasyon.mjs",
    olcumTarihi: rows.reduce<string | null>((t, r) => (r.built_at && (!t || r.built_at > t) ? r.built_at : t), null),
    band: al("band").sort((a, b) => a.anahtar.localeCompare(b.anahtar)),
    desil: al("desil").sort((a, b) => Number(a.anahtar) - Number(b.anahtar)),
    geo: al("geo"),
    spearman: ozet.spearman ?? null,
    yanlisNegatif: ozet.yanlis_negatif ?? null,
    kapsam: ozet.kapsam ?? null,
  });
}
