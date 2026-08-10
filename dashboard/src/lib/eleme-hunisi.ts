// ─────────────────────────────────────────────────────────────────────────────
// ELEME HUNİSİ — saf hesap katmanı (DB/fs YOK, bu yüzden test edilebilir).
//
// NEDEN VAR: /admin/eleme-hunisi ekranı hem sahibin hem de yatırımcının önüne
// çıkıyor. Orada gösterilen HİÇBİR sayı elle yazılmaz; hepsi üç canlı kaynaktan
// türetilir:
//
//   1) `public/kapsam-olcum.json`      → sorgulayabildiğimiz county havuzu
//      (scripts/kapsam-olc.mjs her county'ye GERÇEK sorgu atarak üretir)
//   2) `public/hasat-birikim.json`     → turdan tura BİRİKEN "incelenen parsel"
//      (scraper/birikim-guncelle.mjs, filtreli-hasat loglarından üretir)
//   3) Supabase `offmarket_leads`      → canlı head-count'lar
//
// DÜRÜSTLÜK KURALLARI (bu dosyanın asıl işi):
//  • "ERİŞİLEBİLİR" ≠ "İNCELENEN" ≠ "KAYITLI". Üçü ayrı ölçüdür ve ASLA tek
//    rakamda toplanmaz. Erişilebilir = sorgulayabildiğimiz havuz. İncelenen =
//    gerçekten çekilip buy-box'tan geçirilen parsel. Kayıtlı = DB'deki lead.
//  • Yüzde hesabı sıfıra bölünmez — payda 0/negatif/NaN ise `null` döner ve UI
//    "—" gösterir. (Daha önce ekranda "%NaN" yaşandı; bu fonksiyon o kapıyı
//    kapatır.)
//  • Veri yoksa 0 + boş durum döndürülür, tahmin ÜRETİLMEZ.
// ─────────────────────────────────────────────────────────────────────────────

// ── Birikimli "incelenen parsel" defteri ────────────────────────────────────

/** Tek bir hasat turunun (eyalet bazında) makine-okunur özeti. */
export interface BirikimTuru {
  /** Kaynak log dosyasının adı — TEKİLLİK ANAHTARI (aynı log iki kez sayılmaz). */
  kaynak: string;
  baslangic: string | null;
  bitis: string | null;
  /** Bu kaydın kapsadığı eyalet(ler). */
  eyaletler: string[];
  /** Kaynaktan çekilip buy-box süzgecinden GEÇİRİLEN parsel sayısı. */
  aday: number;
  /** Süzgeçten geçip DB'ye yazılan (upsert) satır sayısı. */
  yazilan: number;
  /** Kural → elenen adet. */
  elenen: Record<string, number>;
}

export interface BirikimDosyasi {
  surum?: number;
  guncelleme?: string | null;
  turlar?: BirikimTuru[];
}

/** Bir eleme kuralının ekrandaki satırı. */
export interface ElemeSatiri {
  kural: string;
  adet: number;
  /** Aday havuzuna göre pay (%). Aday 0 ise null. */
  pay: number | null;
}

export interface BirikimOzeti {
  /** Deftere giren tur (log dosyası) sayısı. */
  turSayisi: number;
  /** Birikimli incelenen parsel. */
  aday: number;
  /** Birikimli süzgeçten geçen. */
  yazilan: number;
  /** Birikimli elenen (kuralların toplamı). */
  elenenToplam: number;
  /** Kural kırılımı — çoktan aza. */
  eleme: ElemeSatiri[];
  /** Defterde geçen eyaletler (alfabetik). */
  eyaletler: string[];
  /** En eski / en yeni tur zamanı (ISO) — yoksa null. */
  ilkTur: string | null;
  sonTur: string | null;
  /** Süzgeçten geçme oranı (%) — aday 0 ise null. */
  gecisOrani: number | null;
}

/**
 * Sıfıra bölünmeyen yüzde. Payda geçersizse (0, negatif, NaN) `null`.
 * UI `null` gördüğünde "—" basar — asla "%NaN" değil.
 */
export function yuzde(pay: number, toplam: number): number | null {
  if (!Number.isFinite(pay) || !Number.isFinite(toplam)) return null;
  if (toplam <= 0) return null;
  return (pay / toplam) * 100;
}

/** Sayı gibi görünmeyen her şeyi 0'a indirger (tahmin üretmez). */
function sayi(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Defteri özetler. Boş/bozuk defter → her şey 0, `eleme` boş dizi.
 * Aynı `kaynak` iki kez varsa YALNIZCA SONUNCUSU sayılır (idempotent okuma).
 */
export function birikimOzeti(b: BirikimDosyasi | null | undefined): BirikimOzeti {
  const benzersiz = new Map<string, BirikimTuru>();
  for (const t of b?.turlar ?? []) {
    if (!t || typeof t.kaynak !== "string" || !t.kaynak) continue;
    benzersiz.set(t.kaynak, t);
  }
  const turlar = [...benzersiz.values()];

  let aday = 0;
  let yazilan = 0;
  const elenen = new Map<string, number>();
  const eyaletler = new Set<string>();
  const zamanlar: number[] = [];

  for (const t of turlar) {
    aday += sayi(t.aday);
    yazilan += sayi(t.yazilan);
    for (const e of t.eyaletler ?? []) if (e) eyaletler.add(String(e).toUpperCase());
    for (const [k, v] of Object.entries(t.elenen ?? {})) {
      elenen.set(k, (elenen.get(k) ?? 0) + sayi(v));
    }
    for (const ts of [t.baslangic, t.bitis]) {
      if (!ts) continue;
      const ms = new Date(ts).getTime();
      if (Number.isFinite(ms)) zamanlar.push(ms);
    }
  }

  const eleme: ElemeSatiri[] = [...elenen.entries()]
    .map(([kural, adet]) => ({ kural, adet, pay: yuzde(adet, aday) }))
    .sort((x, y) => y.adet - x.adet);

  return {
    turSayisi: turlar.length,
    aday,
    yazilan,
    elenenToplam: eleme.reduce((s, e) => s + e.adet, 0),
    eleme,
    eyaletler: [...eyaletler].sort(),
    ilkTur: zamanlar.length ? new Date(Math.min(...zamanlar)).toISOString() : null,
    sonTur: zamanlar.length ? new Date(Math.max(...zamanlar)).toISOString() : null,
    gecisOrani: yuzde(yazilan, aday),
  };
}

/**
 * Defteri yeni turlarla birleştirir — İDEMPOTENT.
 * Aynı `kaynak` adlı kayıt varsa üzerine yazılır (log yeniden üretilirse
 * sayı ŞİŞMEZ). Sıralama: bitiş/başlangıç zamanına göre eskiden yeniye.
 */
export function birikimBirlestir(
  mevcut: BirikimDosyasi | null | undefined,
  yeni: BirikimTuru[]
): BirikimDosyasi {
  const map = new Map<string, BirikimTuru>();
  for (const t of mevcut?.turlar ?? []) {
    if (t?.kaynak) map.set(t.kaynak, t);
  }
  for (const t of yeni) {
    if (t?.kaynak) map.set(t.kaynak, t);
  }
  const turlar = [...map.values()].sort((a, b) => {
    const av = new Date(a.bitis ?? a.baslangic ?? 0).getTime() || 0;
    const bv = new Date(b.bitis ?? b.baslangic ?? 0).getTime() || 0;
    return av - bv || a.kaynak.localeCompare(b.kaynak);
  });
  return { surum: 1, guncelleme: new Date().toISOString(), turlar };
}

// ── filtreli-hasat log → defter kaydı ───────────────────────────────────────

/** `scraper/logs/filtreli-hasat-*.json` dosyasının okuduğumuz kısmı. */
export interface FiltreliHasatLog {
  baslangic?: string | null;
  bitis?: string | null;
  eyalet?: Record<string, { aday?: number; yazilan?: number; elenen?: Record<string, number> }>;
}

/**
 * Bir hasat logunu defter kaydına çevirir. Log'da birden çok eyalet varsa
 * hepsi TEK kayıtta toplanır (tekillik anahtarı dosya adıdır).
 * Eyalet bloğu yoksa `null` döner — boş kayıt deftere girmez.
 */
export function logdanTur(log: FiltreliHasatLog | null | undefined, kaynak: string): BirikimTuru | null {
  const eyaletBlok = log?.eyalet;
  if (!eyaletBlok || typeof eyaletBlok !== "object") return null;

  const eyaletler: string[] = [];
  let aday = 0;
  let yazilan = 0;
  const elenen: Record<string, number> = {};

  for (const [st, v] of Object.entries(eyaletBlok)) {
    if (!st) continue;
    eyaletler.push(st.toUpperCase());
    aday += sayi(v?.aday);
    yazilan += sayi(v?.yazilan);
    for (const [k, n] of Object.entries(v?.elenen ?? {})) {
      elenen[k] = (elenen[k] ?? 0) + sayi(n);
    }
  }
  if (!eyaletler.length) return null;

  return {
    kaynak,
    baslangic: log?.baslangic ?? null,
    bitis: log?.bitis ?? null,
    eyaletler: eyaletler.sort(),
    aday,
    yazilan,
    elenen,
  };
}

// ── Kapsam ölçümü (sorgulanabilir county havuzu) ────────────────────────────

export interface KapsamOlcumSatiri {
  state?: string;
  durum?: string;
  toplamParsel?: number | null;
}

export interface KapsamOzeti {
  /** ÇALIŞAN county'lerin ölçülen toplam parsel sayısı. */
  toplamParsel: number;
  /** Parsel sayısı ölçülebilmiş, çalışan county adedi. */
  countySayisi: number;
  eyaletSayisi: number;
  olcumZamani: string | null;
  /**
   * Çalışıyor ama toplam parsel sayısı ölçülemeyen county adedi —
   * bunlar toplama GİRMEZ, yani gösterilen havuz gerçekte olandan küçüktür.
   */
  sayilamayan: number;
}

/**
 * Kapsam ölçümünü özetler. YALNIZCA `durum === "calisiyor"` ve
 * `toplamParsel > 0` olan satırlar toplanır — ölçülmemiş county için tahmin
 * üretilmez, sayılamayan county ayrı raporlanır.
 */
export function kapsamOzeti(
  olcum: { olcumZamani?: string | null; sonuclar?: KapsamOlcumSatiri[] } | null | undefined
): KapsamOzeti {
  const satirlar = (olcum?.sonuclar ?? []).filter((s) => s?.durum === "calisiyor");
  const sayilabilir = satirlar.filter((s) => sayi(s.toplamParsel) > 0);
  return {
    toplamParsel: sayilabilir.reduce((s, r) => s + sayi(r.toplamParsel), 0),
    countySayisi: sayilabilir.length,
    eyaletSayisi: new Set(sayilabilir.map((s) => String(s.state ?? "").toUpperCase()).filter(Boolean)).size,
    olcumZamani: olcum?.olcumZamani ?? null,
    sayilamayan: satirlar.length - sayilabilir.length,
  };
}

// ── Eyalet geneli katmanlar (ERİŞİLEBİLİR — taranmış DEĞİL) ─────────────────

export interface EyaletKatmani {
  state: string;
  ad: string;
  /** Katmanın servis metadata'sından okunan TOPLAM parsel sayısı. */
  parsel: number;
  /** Sahip + posta adresi var mı — yoksa mektup hattına giremez. */
  mektupAlaniVar: boolean;
  /** Bu katmanla ilgili dürüstlük notu (neyi yapamıyoruz). */
  not: string;
  /** Kaynak kaydı — `src/lib/county-registry.ts` içindeki üretici. */
  kayit: string;
}

/**
 * TEK UÇTAN erişilen eyalet geneli parsel katmanları.
 *
 * ⚠ Bu sayılar "taranmış parsel" DEĞİLDİR — servisin toplam kayıt sayısıdır,
 * yani "sorgulayabildiğimiz havuz". Ekranda ayrı bir kutuda, ayrı etiketle
 * gösterilir ve incelenen/kayıtlı sayılarla ASLA toplanmaz.
 *
 * Değerlerin kaynağı `src/lib/county-registry.ts` içindeki katman üreticileri
 * (`msStatewide`, `wvStatewide`) ve servis metadata'sından yapılan doğrulama.
 */
export const EYALET_KATMANLARI: EyaletKatmani[] = [
  {
    state: "MS",
    ad: "MARIS eyalet geneli parsel (82 county)",
    parsel: 1_994_839,
    mektupAlaniVar: true,
    not: "Sahip + tam posta + arazi değeri dolu. Servis sayfalama kabul etmiyor; motor objectId parçalı çekime düşüyor.",
    kayit: "county-registry.ts · msStatewide()",
  },
  {
    state: "WV",
    ad: "WVU GIS eyalet geneli parsel",
    parsel: 1_389_855,
    mektupAlaniVar: true,
    not: "Sahip adı %98,8 dolu ama ARAZİ DEĞERİ YOK — boş arsa sinyali fiziksel adres boşluğu + acre eşiğinden çıkarılıyor.",
    kayit: "county-registry.ts · wvStatewide()",
  },
  {
    state: "WY",
    ad: "WY eyalet geneli parsel",
    parsel: 373_666,
    mektupAlaniVar: true,
    not: "Sahip + posta var ama DEĞER ve SINIF alanı yok → boş arsa ayırt edilemiyor. WY bu yüzden county servislerinden hasat ediliyor.",
    kayit: "county-registry.ts · WYOMING bloğu",
  },
];

/**
 * 4 Ağustos 2026'da CANLI DOĞRULANMIŞ eyalet geneli kaynak kaydı.
 *
 * Yukarıdaki elle yazılmış üç katman (MS, WV, WY) o günden önce kalma ve
 * ERİŞİLEBİLİR adımını 3,7 milyonda gösteriyordu. Oysa ulusal keşif 21 eyalette
 * 67,8 milyon parsele tek uçtan erişim ölçtü — huninin tepesi, veritabanındaki
 * 1,25 milyondan KÜÇÜK görünüyordu, yani huni ters duruyordu.
 *
 * Bu liste `data/ulusal-kaynaklar.json`'dan türetilir; her satır o gün servise
 * gerçek sorgu atılarak (alan listesi + returnCountOnly) doğrulandı. Elle yazılan
 * katmanlardan yalnız kayıtta OLMAYANLAR korunur (WV) — çakışanlar iki kez sayılmaz.
 *
 * ⚠ Hâlâ "taranmış" DEĞİL: servisin bildirdiği toplam kayıt sayısı, yani
 * sorgulayabildiğimiz havuz. İncelenen/kayıtlı sayılarla ASLA toplanmaz.
 */
const DURUM_NOTU: Record<string, string> = {
  hazir: "Sahip + posta alanı doğrulandı, hasada hazır.",
  "sahip-adi-yok": "Sahip adı alanı yok — mektup/SMS hattına giremez, yalnız parsel sayımı.",
  "posta-yok": "Sahip adı var ama posta adresi yok — temas için skip trace şart.",
  "yanlis-pozitif": "Alan eşlemesi güvenilmez çıktı; hasada alınmadan önce yeniden doğrulanmalı.",
};

/** `data/ulusal-kaynaklar.json` satırının okuduğumuz kısmı. */
export interface UlusalKaynakSatiri {
  eyalet: string;
  ad: string;
  parsel: number | null;
  posta: boolean;
  durum: string;
  not?: string;
}

/**
 * Ulusal kaynak kaydını erişilebilir katman listesine çevirir — SAF fonksiyon.
 *
 * JSON'u bu dosya İÇE AKTARMAZ: burası bilerek dosya/DB dokunmayan hesap
 * katmanı (dosyanın başlığına bakın), çağıran taraf veriyi getirir.
 *
 * Parsel sayısı okunamayan kaynaklar (ör. NY) DIŞARIDA bırakılır — sayısı
 * bilinmeyen bir kaynağı "erişilebilir havuz"a katmak toplamı uydurmak olur.
 */
export function ulusalKatmanlar(kayit: Record<string, unknown> | null | undefined): EyaletKatmani[] {
  return Object.entries(kayit ?? {})
    .filter(([k]) => k !== "_not")
    .map(([, v]) => v as UlusalKaynakSatiri)
    .filter((r) => r && typeof r.parsel === "number" && r.parsel > 0)
    .map((r) => ({
      state: r.eyalet,
      ad: r.ad,
      parsel: r.parsel as number,
      mektupAlaniVar: Boolean(r.posta),
      not: r.not?.trim() || DURUM_NOTU[r.durum] || `Durum: ${r.durum}.`,
      kayit: "ulusal-kaynaklar.json · 2026-08-04 canlı doğrulama",
    }));
}

/** Ulusal kayıt + yalnız orada bulunmayan elle yazılmış katmanlar. */
export function erisilebilirKatmanlar(kayit: Record<string, unknown> | null | undefined): EyaletKatmani[] {
  const ulusal = ulusalKatmanlar(kayit);
  return [...ulusal, ...EYALET_KATMANLARI.filter((k) => !ulusal.some((u) => u.state === k.state))];
}

/** Katman listesinin toplamı — elle yazılmaz, kalemlerden türetilir. */
export const katmanToplami = (k: EyaletKatmani[]) => k.reduce((s, x) => s + x.parsel, 0);

// ── Huni kademeleri ─────────────────────────────────────────────────────────

export interface HuniKademesi {
  ad: string;
  /** Etiketin altındaki tek cümlelik açıklama — "erişilebilir mi, incelenmiş mi". */
  aciklama: string;
  deger: number | null;
  /** Bir önceki kademeye göre oran (%) — hesaplanamıyorsa null. */
  oran: number | null;
  /** Sayının nereden geldiği — ekranda her kademenin altında görünür. */
  kaynak: string;
}

export interface HuniGirdi {
  incelenen: number;
  uygun: number;
  kayitli: number | null;
  mektupAtilabilir: number | null;
  yatirimaUygun: number | null;
  kaynakHasat: string;
  kaynakCanli: string;
}

/**
 * İki ayrı huniyi kurar:
 *  • "yapilanIs" — İNCELENEN → UYGUN (hasat logu birikiminden)
 *  • "havuz"     — KAYITLI → MEKTUP ATILABİLİR → A+/A (canlı DB'den)
 *
 * İkisi bilerek AYRI: kayıtlı havuz, birikimli sayaçtan önce koşan turların
 * ürünü olduğu için incelenen sayısından büyük olabilir. Tek huniye dizilseydi
 * yatırımcıya yanlış bir "%" izlenimi verirdi.
 */
export function huniKur(g: HuniGirdi): { yapilanIs: HuniKademesi[]; havuz: HuniKademesi[] } {
  const yapilanIs: HuniKademesi[] = [
    {
      ad: "İncelenen parsel",
      aciklama: "Kaynaktan çekilip buy-box süzgecinden geçirildi",
      deger: g.incelenen,
      oran: null,
      kaynak: g.kaynakHasat,
    },
    {
      ad: "Uygun parsel",
      aciklama: "Süzgecin beş kuralından da geçti, kaydedildi",
      deger: g.uygun,
      oran: yuzde(g.uygun, g.incelenen),
      kaynak: g.kaynakHasat,
    },
  ];

  const havuz: HuniKademesi[] = [
    {
      ad: "Kayıtlı lead",
      aciklama: "offmarket_leads tablosundaki toplam satır",
      deger: g.kayitli,
      oran: null,
      kaynak: g.kaynakCanli,
    },
    {
      ad: "Mektup atılabilir",
      aciklama: "Beş posta alanının beşi de dolu",
      deger: g.mektupAtilabilir,
      oran: g.kayitli != null && g.mektupAtilabilir != null ? yuzde(g.mektupAtilabilir, g.kayitli) : null,
      kaynak: g.kaynakCanli,
    },
    {
      ad: "Yatırıma uygun A+/A",
      aciklama: "Coğrafi doğrulaması yapılmış, mektup atılabilir en iyi parseller",
      deger: g.yatirimaUygun,
      oran:
        g.mektupAtilabilir != null && g.yatirimaUygun != null
          ? yuzde(g.yatirimaUygun, g.mektupAtilabilir)
          : null,
      kaynak: g.kaynakCanli,
    },
  ];

  return { yapilanIs, havuz };
}

/**
 * Kademeyi bar genişliğine çevirir — en büyük kademe %100.
 * Boş/sıfır huni → hepsi 0 (NaN genişlik yok).
 */
export function barGenislikleri(kademeler: HuniKademesi[]): number[] {
  const enBuyuk = kademeler.reduce((m, k) => Math.max(m, k.deger ?? 0), 0);
  if (enBuyuk <= 0) return kademeler.map(() => 0);
  return kademeler.map((k) => ((k.deger ?? 0) / enBuyuk) * 100);
}
