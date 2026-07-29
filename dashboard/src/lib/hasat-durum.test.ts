// Hasat durumu yardımcıları testleri (saf, DB/fs yok). Çalıştırma: npm test
//
// Bu testlerin varlık sebebi: 2026 Haziran–Temmuz arası otomasyon 3,5 hafta
// boyunca ÖLÜ olmasına rağmen panel "başarılı" gösterdi. Aşağıdaki senaryolar
// o yanılsamanın her bir biçimini kilitler.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasatSagligi,
  yasEtiketi,
  HASAT_BAYAT_SAAT,
  HASAT_SESSIZ_SAAT,
  type HasatDurumDosyasi,
} from "./hasat-durum.ts";

const SIMDI = new Date("2026-07-29T12:00:00.000Z");
const saatOnce = (h: number) => new Date(SIMDI.getTime() - h * 3600000).toISOString();

/** Sağlıklı bir durum dosyası — testler bunun üstüne fark uygular. */
const saglikli = (ek: Partial<HasatDurumDosyasi> = {}): HasatDurumDosyasi => ({
  surum: 1,
  sonKosuBaslangic: saatOnce(6),
  sonKosuBitis: saatOnce(5),
  sonKosuBasarili: true,
  sonBasariliKosu: saatOnce(5),
  ustUsteHata: 0,
  sonHata: null,
  smoke: false,
  sureSn: 3600,
  adimlar: [{ ad: "socrata-harvest.js", kod: 0, sureSn: 80 }],
  satirlar: {},
  toplamYeniSatir: 1200,
  countyler: [{ ad: "TX/Presidio", satir: 900 }],
  countySayisi: 3,
  ...ek,
});

test("taze ve dolu tur → yeşil", () => {
  const s = hasatSagligi(saglikli(), SIMDI);
  assert.equal(s.renk, "yesil");
  assert.match(s.baslik, /Son başarılı hasat: 5 saat önce/);
  assert.equal(s.toplamYeniSatir, 1200);
});

test("durum dosyası yok → yeşil DEĞİL, 'bilinmiyor'", () => {
  const s = hasatSagligi(null, SIMDI);
  assert.equal(s.renk, "bilinmiyor");
  assert.equal(s.basariliSaat, null);
  assert.match(s.aciklama, /launchd-kur\.sh/);
});

test("runner günlerdir hiç koşmamış → kırmızı (eski sessiz ölüm senaryosu)", () => {
  const s = hasatSagligi(
    saglikli({ sonKosuBitis: saatOnce(24 * 25), sonBasariliKosu: saatOnce(24 * 25) }),
    SIMDI
  );
  assert.equal(s.renk, "kirmizi");
  assert.match(s.baslik, /25 gün önce/);
  assert.match(s.aciklama, /launchd/);
});

test(`sessizlik eşiği: ${HASAT_SESSIZ_SAAT} saat altı yeşil, üstü kırmızı`, () => {
  const az = saatOnce(HASAT_SESSIZ_SAAT - 1);
  assert.equal(
    hasatSagligi(saglikli({ sonKosuBitis: az, sonBasariliKosu: az }), SIMDI).renk,
    "yesil"
  );
  const cok = saatOnce(HASAT_SESSIZ_SAAT + 1);
  assert.equal(
    hasatSagligi(saglikli({ sonKosuBitis: cok, sonBasariliKosu: cok }), SIMDI).renk,
    "kirmizi"
  );
});

test("son koşu başarısız → kırmızı, hata mesajı ve patlayan adım görünür", () => {
  const s = hasatSagligi(
    saglikli({
      sonKosuBasarili: false,
      ustUsteHata: 3,
      sonHata: "run-all.sh çıkış 1 — Cannot find module",
      sonBasariliKosu: saatOnce(30),
      adimlar: [
        { ad: "socrata-harvest.js", kod: 0, sureSn: 80 },
        { ad: "node dd-enrich.js", kod: 1, sureSn: 12 },
      ],
    }),
    SIMDI
  );
  assert.equal(s.renk, "kirmizi");
  assert.match(s.baslik, /BAŞARISIZ/);
  assert.match(s.aciklama, /üst üste 3 başarısız/i);
  assert.match(s.aciklama, /Cannot find module/);
  assert.match(s.aciklama, /dd-enrich/);
  assert.equal(s.basarisizAdimlar.length, 1);
});

test("başarısız koşu 'son başarılı' zamanını GERİ ALMAZ", () => {
  const s = hasatSagligi(
    saglikli({ sonKosuBasarili: false, sonBasariliKosu: saatOnce(20), ustUsteHata: 1 }),
    SIMDI
  );
  assert.equal(Math.floor(s.basariliSaat ?? 0), 20);
});

test(`son başarılı hasat ${HASAT_BAYAT_SAAT} saati geçtiyse → kırmızı`, () => {
  // Koşu bugün yapıldı ve "başarılı" bitti ama son BAŞARILI damgası eski:
  // bu kombinasyon dosya elle kurcalanınca oluşur; yine de yeşil olmamalı.
  const s = hasatSagligi(
    saglikli({ sonBasariliKosu: saatOnce(HASAT_BAYAT_SAAT + 2) }),
    SIMDI
  );
  assert.equal(s.renk, "kirmizi");
});

test("hatasız ama 0 yeni satır → sarı (sessiz boş tur yeşil sayılmaz)", () => {
  const s = hasatSagligi(saglikli({ toplamYeniSatir: 0 }), SIMDI);
  assert.equal(s.renk, "sari");
  assert.match(s.baslik, /0 yeni satır/);
});

test("sadece smoke koşusu → sarı, gerçek hasat sayılmaz", () => {
  const s = hasatSagligi(saglikli({ smoke: true, toplamYeniSatir: 5 }), SIMDI);
  assert.equal(s.renk, "sari");
  assert.match(s.baslik, /smoke/i);
});

test("yasEtiketi: saat/gün/az önce/hiç", () => {
  assert.equal(yasEtiketi(null), "hiç");
  assert.equal(yasEtiketi(0.4), "az önce");
  assert.equal(yasEtiketi(5), "5 saat önce");
  assert.equal(yasEtiketi(47), "47 saat önce");
  assert.equal(yasEtiketi(72), "3 gün önce");
});
