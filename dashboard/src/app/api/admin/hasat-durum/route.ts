import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { hasatSagligi, type HasatDurumDosyasi } from "@/lib/hasat-durum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/hasat-durum — günlük hasat otomasyonunun GERÇEK durumu.
//
// Kaynak: scraper/.hasat-durum.json (scraper/hasat-runner.mjs her koşu sonunda
// yazar). Uydurma yok: dosya yoksa "bilinmiyor" döner, yeşil VARSAYILMAZ.
// Vercel'de dosya bulunmaz — orada da dürüstçe "bilinmiyor" görünür.
//
// Yol geçersiz kılma: VEGALAND_HASAT_DURUM env değişkeni.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const yol =
    process.env.VEGALAND_HASAT_DURUM ||
    join(process.cwd(), "..", "scraper", ".hasat-durum.json");

  let durum: HasatDurumDosyasi | null = null;
  let okumaHatasi: string | null = null;
  try {
    durum = JSON.parse(readFileSync(yol, "utf8")) as HasatDurumDosyasi;
  } catch (e) {
    durum = null;
    okumaHatasi = e instanceof Error ? e.message : "okunamadı";
  }

  return NextResponse.json({
    saglik: hasatSagligi(durum, new Date()),
    durum,
    yol,
    okumaHatasi,
  });
}
