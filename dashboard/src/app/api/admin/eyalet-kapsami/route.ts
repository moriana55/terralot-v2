import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { COUNTY_REGISTRY } from "@/lib/county-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// EYALET KAPSAMI — kayıt defteri + son GERÇEK ölçüm sonucu birleşimi.
//
// Ölçüm dosyası `public/kapsam-olcum.json`, `scripts/kapsam-olc.mjs` tarafından
// üretilir (her county'ye gerçek sorgu atarak). Dosya yoksa/eskiyse satırlar
// "ölçülmedi" olarak döner — TAHMİN ÜRETİLMEZ.
// ─────────────────────────────────────────────────────────────────────────────

interface OlcumKaydi {
  key: string; durum: string; saglayici: string | null; ornekSatir: number;
  mailable: number; mailableOran: number | null; degerVar: boolean;
  toplamParsel: number | null; toplamHata: string | null;
  sureMs: number; mesaj: string | null; olcumZamani: string; apiCagri: number;
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let olcum: { olcumZamani?: string; sonuclar?: OlcumKaydi[] } = {};
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "kapsam-olcum.json"), "utf8");
    olcum = JSON.parse(raw);
  } catch {
    // Ölçüm dosyası yok — sorun değil, satırlar "ölçülmedi" döner.
  }
  const olcumMap = new Map((olcum.sonuclar ?? []).map((s) => [s.key, s]));

  const satirlar = Object.entries(COUNTY_REGISTRY).map(([key, e]) => {
    const o = olcumMap.get(key);
    return {
      key,
      label: e.label,
      state: e.state,
      county: e.county,
      kaynakZinciri: e.sources.map((s) => s.kind).join(" → ") || "yok",
      hasValue: e.hasValue,
      not: e.not ?? null,
      // Kayıttaki bilinen durum (insan eliyle doğrulanmış)
      bilinenDurum: e.bilinenDurum,
      // Son ÖLÇÜLEN durum — yoksa null (tahmin yok)
      olculenDurum: o?.durum ?? null,
      saglayici: o?.saglayici ?? null,
      ornekSatir: o?.ornekSatir ?? null,
      mailable: o?.mailable ?? null,
      mailableOran: o?.mailableOran ?? null,
      degerVar: o?.degerVar ?? null,
      toplamParsel: o?.toplamParsel ?? null,
      toplamHata: o?.toplamHata ?? null,
      sureMs: o?.sureMs ?? null,
      mesaj: o?.mesaj ?? null,
      sonOlcum: o?.olcumZamani ?? null,
    };
  });

  const eyaletler = [...new Set(satirlar.map((s) => s.state))].sort();

  return NextResponse.json({
    olcumZamani: olcum.olcumZamani ?? null,
    eyaletSayisi: eyaletler.length,
    countySayisi: satirlar.length,
    calisan: satirlar.filter((s) => s.olculenDurum === "calisiyor").length,
    olculmemis: satirlar.filter((s) => s.olculenDurum == null).length,
    eyaletler,
    satirlar,
  });
}
