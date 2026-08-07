import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

// ─────────────────────────────────────────────────────────────────────────────
// ÇEVİRME KANITI — aynı parselin ALIM ve SATIM fiyatı.
// Kaynak: deliverables/cevirme-kaniti-<tarih>.csv (scraper/cevirme-kaniti.mjs).
// Veritabanına yazılmıyor çünkü bu bir KANIT DOSYASI: müşteriye gösterilen
// rakamın hangi anda hangi kaynaktan çıktığı sabit kalmalı; canlı tabloya
// bağlarsak sunumdaki sayı ertesi gün değişir ve güven kaybı olur.
// ─────────────────────────────────────────────────────────────────────────────

export type Cift = {
  county: string; apn: string; acres: number;
  alimYil: number; alimAy: number; alimFiyat: number;
  satimYil: number; satimAy: number; satimFiyat: number;
  carpan: number; ayFark: number;
};

const med = (a: number[]) => {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

/** CSV satırı — bu dosyada tırnaklı alan yok (sayı + APN + county adı). */
const parcala = (satir: string) => satir.split(",");

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const dizin = resolve(process.cwd(), "..", "deliverables");
  if (!existsSync(dizin)) return NextResponse.json({ hazir: false, neden: "deliverables klasörü yok" });
  const dosyalar = readdirSync(dizin).filter((f) => f.startsWith("cevirme-kaniti-") && f.endsWith(".csv")).sort();
  if (!dosyalar.length) {
    return NextResponse.json({ hazir: false, neden: "Kanıt dosyası üretilmemiş — node scraper/cevirme-kaniti.mjs" });
  }
  const dosya = dosyalar[dosyalar.length - 1];
  const uretildi = dosya.replace("cevirme-kaniti-", "").replace(".csv", "");

  const satirlar = readFileSync(resolve(dizin, dosya), "utf8").trim().split("\n").slice(1);
  const cift: Cift[] = [];
  for (const s of satirlar) {
    const p = parcala(s);
    if (p.length < 11) continue;
    const c: Cift = {
      county: p[0], apn: p[1], acres: Number(p[2]),
      alimYil: Number(p[3]), alimAy: Number(p[4]), alimFiyat: Number(p[5]),
      satimYil: Number(p[6]), satimAy: Number(p[7]), satimFiyat: Number(p[8]),
      carpan: Number(p[9]), ayFark: Number(p[10]),
    };
    if (!Number.isFinite(c.carpan) || !Number.isFinite(c.alimFiyat)) continue;
    cift.push(c);
  }
  if (!cift.length) return NextResponse.json({ hazir: false, neden: "dosya boş" });

  const carpanlar = cift.map((c) => c.carpan).sort((a, b) => a - b);
  const ozet = {
    n: cift.length,
    medCarpan: med(carpanlar),
    p25: carpanlar[Math.floor(carpanlar.length * 0.25)],
    p75: carpanlar[Math.floor(carpanlar.length * 0.75)],
    zararPay: cift.filter((c) => c.carpan < 1).length / cift.length,
    medAy: med(cift.map((c) => c.ayFark)),
    medAlim: med(cift.map((c) => c.alimFiyat)),
    medSatim: med(cift.map((c) => c.satimFiyat)),
  };

  const kova = new Map<string, Cift[]>();
  for (const c of cift) {
    if (!kova.has(c.county)) kova.set(c.county, []);
    kova.get(c.county)!.push(c);
  }
  const countyler = [...kova.entries()]
    .filter(([, a]) => a.length >= 5)
    .map(([county, a]) => ({
      county, n: a.length,
      medAlim: med(a.map((x) => x.alimFiyat)),
      medSatim: med(a.map((x) => x.satimFiyat)),
      medCarpan: med(a.map((x) => x.carpan)),
      medAy: med(a.map((x) => x.ayFark)),
      zararPay: a.filter((x) => x.carpan < 1).length / a.length,
    }))
    .sort((a, b) => b.n - a.n);

  // Örnek satırlar: UÇ değerler DEĞİL, medyanın etrafındakiler. Uç örnekler
  // (x9, x11) büyük olasılıkla arsaya yapı yapıldıktan sonraki satış; sunumda
  // gösterilirse doğrulanamaz ve güveni yıkar (Mohave/Gokce dersi).
  const ortadakiler = [...cift]
    .sort((a, b) => Math.abs(a.carpan - ozet.medCarpan) - Math.abs(b.carpan - ozet.medCarpan))
    .slice(0, 40)
    .sort((a, b) => b.satimFiyat - a.satimFiyat);

  return NextResponse.json({ hazir: true, uretildi, ozet, countyler, ornekler: ortadakiler });
}
