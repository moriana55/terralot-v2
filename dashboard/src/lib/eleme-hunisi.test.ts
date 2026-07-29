// Eleme hunisi hesap testleri (saf; DB/fs yok). Çalıştırma: npm test
//
// Bu testlerin varlık sebebi: eleme hunisi ekranı YATIRIMCIYA gösteriliyor.
// Oradaki tek bir uydurma/şişmiş/NaN rakam güveni bitirir. Aşağıdaki senaryolar
// üç hatayı imkânsız kılar:
//   1) aynı hasat logunun iki kez sayılıp "incelenen"i şişirmesi,
//    2) payda 0 iken "%NaN" basılması,
//   3) erişilebilir/incelenen/kayıtlı ölçülerinin tek rakamda karışması.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  yuzde,
  birikimOzeti,
  birikimBirlestir,
  logdanTur,
  kapsamOzeti,
  huniKur,
  barGenislikleri,
  EYALET_KATMANLARI,
  EYALET_KATMANLARI_TOPLAM,
  type BirikimTuru,
  type FiltreliHasatLog,
} from "./eleme-hunisi.ts";

// ── yuzde: sıfıra bölme koruması ────────────────────────────────────────────

test("yuzde: normal hesap", () => {
  assert.equal(yuzde(25_043, 295_746)!.toFixed(2), "8.47");
});

test("yuzde: payda 0 → null (asla NaN)", () => {
  assert.equal(yuzde(5, 0), null);
});

test("yuzde: payda negatif → null", () => {
  assert.equal(yuzde(5, -10), null);
});

test("yuzde: NaN girdi → null", () => {
  assert.equal(yuzde(Number.NaN, 10), null);
  assert.equal(yuzde(10, Number.NaN), null);
});

test("yuzde: pay 0 → 0, null değil", () => {
  assert.equal(yuzde(0, 100), 0);
});

// ── logdanTur ───────────────────────────────────────────────────────────────

const msLog: FiltreliHasatLog = {
  baslangic: "2026-07-29T17:15:03.234Z",
  bitis: "2026-07-29T17:16:24.839Z",
  eyalet: {
    MS: {
      aday: 29_736,
      yazilan: 8_386,
      elenen: {
        "deger-bandi": 2_205,
        "absentee-degil": 18_327,
        "acre-bandi": 571,
        "mektup-eksik": 96,
        "kamu-sahipli": 151,
      },
    },
  },
};

test("logdanTur: gerçek MS logu birebir okunur", () => {
  const t = logdanTur(msLog, "filtreli-hasat-2026-07-29-MS.json")!;
  assert.equal(t.aday, 29_736);
  assert.equal(t.yazilan, 8_386);
  assert.deepEqual(t.eyaletler, ["MS"]);
  assert.equal(t.elenen["absentee-degil"], 18_327);
  assert.equal(t.kaynak, "filtreli-hasat-2026-07-29-MS.json");
});

test("logdanTur: çok eyaletli log tek kayıtta toplanır", () => {
  const t = logdanTur(
    {
      eyalet: {
        MS: { aday: 100, yazilan: 10, elenen: { "acre-bandi": 5 } },
        WV: { aday: 50, yazilan: 5, elenen: { "acre-bandi": 3, mukerrer: 1 } },
      },
    },
    "cok.json"
  )!;
  assert.equal(t.aday, 150);
  assert.equal(t.yazilan, 15);
  assert.deepEqual(t.eyaletler, ["MS", "WV"]);
  assert.equal(t.elenen["acre-bandi"], 8);
  assert.equal(t.elenen.mukerrer, 1);
});

test("logdanTur: eyalet bloğu yoksa null (boş kayıt deftere girmez)", () => {
  assert.equal(logdanTur({ eyalet: {} }, "bos.json"), null);
  assert.equal(logdanTur(null, "yok.json"), null);
  assert.equal(logdanTur({}, "yok2.json"), null);
});

// ── birikimBirlestir: İDEMPOTENT olmalı ─────────────────────────────────────

const tur = (kaynak: string, aday: number, yazilan: number, elenen: Record<string, number> = {}): BirikimTuru => ({
  kaynak,
  baslangic: "2026-07-29T17:00:00.000Z",
  bitis: "2026-07-29T17:10:00.000Z",
  eyaletler: ["MS"],
  aday,
  yazilan,
  elenen,
});

test("birikimBirlestir: aynı log iki kez eklenirse sayı ŞİŞMEZ", () => {
  const bir = birikimBirlestir(null, [tur("a.json", 100, 10)]);
  const iki = birikimBirlestir(bir, [tur("a.json", 100, 10)]);
  assert.equal(iki.turlar!.length, 1);
  assert.equal(birikimOzeti(iki).aday, 100);
});

test("birikimBirlestir: aynı kaynak yeniden üretilirse ÜZERİNE yazılır", () => {
  const bir = birikimBirlestir(null, [tur("a.json", 100, 10)]);
  const iki = birikimBirlestir(bir, [tur("a.json", 250, 25)]);
  assert.equal(iki.turlar!.length, 1);
  assert.equal(birikimOzeti(iki).aday, 250);
});

test("birikimBirlestir: farklı turlar BİRİKİR", () => {
  let b = birikimBirlestir(null, [tur("a.json", 100, 10)]);
  b = birikimBirlestir(b, [tur("b.json", 200, 20)]);
  b = birikimBirlestir(b, [tur("c.json", 300, 30)]);
  const o = birikimOzeti(b);
  assert.equal(o.turSayisi, 3);
  assert.equal(o.aday, 600);
  assert.equal(o.yazilan, 60);
});

test("birikimBirlestir: turlar zamana göre eskiden yeniye sıralanır", () => {
  const b = birikimBirlestir(null, [
    { ...tur("yeni.json", 1, 1), bitis: "2026-08-02T00:00:00.000Z" },
    { ...tur("eski.json", 1, 1), bitis: "2026-07-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(b.turlar!.map((t) => t.kaynak), ["eski.json", "yeni.json"]);
});

// ── birikimOzeti ────────────────────────────────────────────────────────────

test("birikimOzeti: 7 eyaletlik gerçek tur toplamları raporla eşleşir", () => {
  // 2026-07-29 filtreli hasat turu — yedek/hasat-raporu-20260729.md ile birebir.
  const gercek: BirikimTuru[] = [
    tur("MS.json", 29_736, 8_386, { "absentee-degil": 18_327, "deger-bandi": 2_205, "acre-bandi": 571, "kamu-sahipli": 151, "mektup-eksik": 96 }),
    tur("WV.json", 5_418, 1_201, { "absentee-degil": 4_076 }),
    tur("MT.json", 30_388, 1_541, { "absentee-degil": 26_432 }),
    tur("NC.json", 97_945, 7_477, { "absentee-degil": 73_493 }),
    tur("AL.json", 97_420, 3_254, { "absentee-degil": 83_000 }),
    tur("ID.json", 22_972, 1_349, { "absentee-degil": 18_853 }),
    tur("WY.json", 11_867, 1_835, { "absentee-degil": 7_146 }),
  ];
  const o = birikimOzeti(birikimBirlestir(null, gercek));
  assert.equal(o.aday, 295_746); // raporun "Toplam aday" satırı
  assert.equal(o.yazilan, 25_043); // raporun "Toplam upsert" satırı
  assert.equal(o.eleme[0].kural, "absentee-degil");
  assert.equal(o.eleme[0].adet, 231_327);
  assert.equal(o.eleme[0].pay!.toFixed(1), "78.2");
});

test("birikimOzeti: eleme kırılımı çoktan aza sıralı", () => {
  const o = birikimOzeti(
    birikimBirlestir(null, [tur("a.json", 1000, 100, { az: 5, cok: 500, orta: 50 })])
  );
  assert.deepEqual(o.eleme.map((e) => e.kural), ["cok", "orta", "az"]);
});

test("birikimOzeti: boş defter → sıfır + boş kırılım, NaN yok", () => {
  const o = birikimOzeti(null);
  assert.equal(o.aday, 0);
  assert.equal(o.yazilan, 0);
  assert.equal(o.turSayisi, 0);
  assert.deepEqual(o.eleme, []);
  assert.equal(o.gecisOrani, null);
  assert.equal(o.ilkTur, null);
});

test("birikimOzeti: bozuk/negatif alanlar 0 sayılır, çökmez", () => {
  const o = birikimOzeti({
    turlar: [
      // @ts-expect-error — bilerek bozuk kayıt
      { kaynak: "x.json", aday: "abc", yazilan: -5, elenen: { a: null }, eyaletler: null },
    ],
  });
  assert.equal(o.aday, 0);
  assert.equal(o.yazilan, 0);
  assert.equal(o.eleme[0].adet, 0);
});

test("birikimOzeti: kaynaksız kayıt yok sayılır", () => {
  // @ts-expect-error — kaynak alanı yok
  const o = birikimOzeti({ turlar: [{ aday: 999, yazilan: 9, elenen: {}, eyaletler: ["MS"] }] });
  assert.equal(o.turSayisi, 0);
  assert.equal(o.aday, 0);
});

test("birikimOzeti: eyaletler tekilleşir ve alfabetik döner", () => {
  const o = birikimOzeti(
    birikimBirlestir(null, [
      { ...tur("a.json", 1, 1), eyaletler: ["WV", "MS"] },
      { ...tur("b.json", 1, 1), eyaletler: ["MS", "AL"] },
    ])
  );
  assert.deepEqual(o.eyaletler, ["AL", "MS", "WV"]);
});

// ── kapsamOzeti ─────────────────────────────────────────────────────────────

test("kapsamOzeti: yalnız ÇALIŞAN ve sayılabilen county toplanır", () => {
  const o = kapsamOzeti({
    olcumZamani: "2026-07-29T17:41:12.375Z",
    sonuclar: [
      { state: "CO", durum: "calisiyor", toplamParsel: 62_087 },
      { state: "CO", durum: "calisiyor", toplamParsel: 8_365 },
      { state: "CO", durum: "veri-yok", toplamParsel: 0 },
      { state: "TX", durum: "servis-kapali", toplamParsel: 99_999 }, // sayılmaz
      { state: "MS", durum: "calisiyor", toplamParsel: null }, // sayılamayan
    ],
  });
  assert.equal(o.toplamParsel, 70_452);
  assert.equal(o.countySayisi, 2);
  assert.equal(o.eyaletSayisi, 1);
  assert.equal(o.sayilamayan, 1);
  assert.equal(o.olcumZamani, "2026-07-29T17:41:12.375Z");
});

test("kapsamOzeti: dosya yoksa sıfır + tahmin yok", () => {
  const o = kapsamOzeti(null);
  assert.equal(o.toplamParsel, 0);
  assert.equal(o.countySayisi, 0);
  assert.equal(o.olcumZamani, null);
});

// ── Eyalet geneli katmanlar: ERİŞİLEBİLİR, taranmış DEĞİL ───────────────────

test("EYALET_KATMANLARI: toplam elle yazılmaz, kalemlerden türetilir", () => {
  assert.equal(
    EYALET_KATMANLARI_TOPLAM,
    EYALET_KATMANLARI.reduce((s, k) => s + k.parsel, 0)
  );
  assert.ok(EYALET_KATMANLARI.length >= 2);
});

test("EYALET_KATMANLARI: her katmanın kaynağı ve dürüstlük notu var", () => {
  for (const k of EYALET_KATMANLARI) {
    assert.ok(k.kayit.length > 0, `${k.state} kaynaksız`);
    assert.ok(k.not.length > 0, `${k.state} notsuz`);
    assert.ok(k.parsel > 0, `${k.state} parsel yok`);
  }
});

// ── huniKur: iki ölçü ASLA tek huniye karışmaz ──────────────────────────────

const girdi = {
  incelenen: 295_746,
  uygun: 25_043,
  kayitli: 585_191,
  mektupAtilabilir: 498_562,
  yatirimaUygun: 9_342,
  kaynakHasat: "hasat logu",
  kaynakCanli: "canlı sorgu",
};

test("huniKur: yapılan iş hunisi İNCELENEN → UYGUN", () => {
  const { yapilanIs } = huniKur(girdi);
  assert.equal(yapilanIs.length, 2);
  assert.equal(yapilanIs[0].deger, 295_746);
  assert.equal(yapilanIs[1].deger, 25_043);
  assert.equal(yapilanIs[0].oran, null); // ilk kademenin oranı yok
  assert.equal(yapilanIs[1].oran!.toFixed(1), "8.5");
});

test("huniKur: kayıtlı havuz AYRI huni — incelenen ile yüzdelenmez", () => {
  const { havuz } = huniKur(girdi);
  assert.equal(havuz[0].deger, 585_191);
  assert.equal(havuz[0].oran, null);
  assert.equal(havuz[1].oran!.toFixed(1), "85.2"); // mektup / kayıtlı
  assert.equal(havuz[2].oran!.toFixed(1), "1.9"); // A+/A / mektup
});

test("huniKur: her kademenin kaynak etiketi dolu", () => {
  const { yapilanIs, havuz } = huniKur(girdi);
  for (const k of [...yapilanIs, ...havuz]) assert.ok(k.kaynak.length > 0, `${k.ad} kaynaksız`);
});

test("huniKur: canlı sorgu düşerse null kademe, oran null — 0 uydurulmaz", () => {
  const { havuz } = huniKur({ ...girdi, kayitli: null, mektupAtilabilir: null, yatirimaUygun: null });
  assert.equal(havuz[0].deger, null);
  assert.equal(havuz[1].oran, null);
  assert.equal(havuz[2].oran, null);
});

test("huniKur: hiç hasat yoksa oran null, %NaN yok", () => {
  const { yapilanIs } = huniKur({ ...girdi, incelenen: 0, uygun: 0 });
  assert.equal(yapilanIs[1].oran, null);
});

// ── barGenislikleri ─────────────────────────────────────────────────────────

test("barGenislikleri: en büyük kademe %100, orantı korunur", () => {
  const { yapilanIs } = huniKur(girdi);
  const g = barGenislikleri(yapilanIs);
  assert.equal(g[0], 100);
  assert.equal(g[1].toFixed(1), "8.5");
});

test("barGenislikleri: tüm değerler 0/null → hepsi 0 (NaN genişlik yok)", () => {
  const g = barGenislikleri([
    { ad: "a", aciklama: "", deger: 0, oran: null, kaynak: "x" },
    { ad: "b", aciklama: "", deger: null, oran: null, kaynak: "x" },
  ]);
  assert.deepEqual(g, [0, 0]);
  for (const x of g) assert.ok(Number.isFinite(x));
});
