// ─────────────────────────────────────────────────────────────────────────────
// HEDEF 25 EYALET — MAKİNECE OKUNUR KAYIT
//
// `HEDEF-25-EYALET.md` dosyasının koddaki karşılığı. Seçim gerekçeleri,
// taksitli satış (contract for deed / land contract) uygunluğu ve hedef
// county'ler burada tutulur; ekranlar ve betikler bunu okur.
//
// ⚠ İŞ KURALI: taksitli satış NEW YORK'ta YAPILMAZ. Aşağıdaki listede NY yoktur
// ve `installment` alanı "yasak" olan hiçbir eyalet listeye alınmamıştır.
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = 1 | 2 | 3;

/** Taksitli satış (contract for deed) uygunluğu — iş kuralı, hukuki tavsiye değil. */
export type Installment =
  /** Yaygın, oturmuş uygulama — öncelikli. */
  | "uygun"
  /** Yasal ama ek yükümlülük var (tescil, ihbar süresi, açıklama zorunluluğu). */
  | "kosullu"
  /** Yapılmaz. */
  | "yasak";

/** Parsel verisinin nereden geleceği. */
export type VeriYolu =
  /** Eyalet geneli tek ArcGIS servisi — en ucuz yol. */
  | "eyalet-arcgis"
  /** County bazlı ArcGIS servisleri. */
  | "county-arcgis"
  /** Ücretsiz kaynakta sahip/posta yok → Regrid (ücretli) gerekir. */
  | "regrid-gerekli"
  /** Ücretsiz kaynak var ama posta adresi içermiyor → mektup atılamaz. */
  | "posta-adresi-yok";

export interface EyaletHedefi {
  kod: string;
  ad: string;
  tier: Tier;
  installment: Installment;
  /** ALL-STATES-LAND-RESEARCH.md'den ortalama acre fiyatı (USD). */
  acreFiyat: number | null;
  /** Neden bu eyalet seçildi — tek cümle. */
  gerekce: string;
  /** Hedeflenen county'ler (kayıt defterinde karşılığı olanlar önce). */
  countyler: string[];
  veriYolu: VeriYolu;
  /** Veri kaynağı hakkında somut not (ölçülmüş gerçek). */
  kaynakNotu: string;
}

export const HEDEF_EYALETLER: EyaletHedefi[] = [
  // ── TIER 1 — taksitli satışın ve ucuz arsanın birlikte olduğu çekirdek ────
  {
    kod: "NM", ad: "New Mexico", tier: 1, installment: "uygun", acreFiyat: 725,
    gerekce: "ABD'nin en ucuz arsası; 35+ acre bölmeler tamamen muaf, taksitli satış oturmuş.",
    countyler: ["Valencia", "Luna"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Valencia county ArcGIS'i çalışıyor (168.831 boş arsa). Luna için ücretsiz servis bulunamadı — Regrid gerekli.",
  },
  {
    kod: "TX", ad: "Texas", tier: 1, installment: "kosullu", acreFiyat: 3725,
    gerekce: "Batı TX county'lerinde acre başı $200-500; ETJ dışı 5+ acre bölmede plat gerekmiyor.",
    countyler: ["Hudspeth", "Brewster", "Presidio", "Terrell", "Liberty", "Cherokee", "Harrison", "Brazoria", "Cochran"],
    veriYolu: "county-arcgis",
    kaynakNotu: "~155 TX CAD servisi AYNI 'BIS' şemasını paylaşıyor → tek üretici fonksiyonla county eklenir. 9'u kayıtlı, hepsi çalışıyor.",
  },
  {
    kod: "AZ", ad: "Arizona", tier: 1, installment: "uygun", acreFiyat: 4200,
    gerekce: "Mohave/Apache/Navajo'da ucuz çöl arsası; ≤5 parsel 10+ acre bölme staff review ile kolay.",
    countyler: ["Mohave", "Apache", "Navajo", "Cochise"],
    veriYolu: "regrid-gerekli",
    kaynakNotu: "⚠ Mohave ArcGIS host'u (mcgis.mohave.gov) ÇÖKTÜ — TCP bağlantısı kurulmuyor. Diğer 3 county için ücretsiz servis bulunamadı.",
  },

  // ── TIER 2 — ucuz + kolay bölme ──────────────────────────────────────────
  {
    kod: "MT", ad: "Montana", tier: 2, installment: "uygun", acreFiyat: 1280,
    gerekce: "Acre başı ~$1.280; 'certificate of survey' ile ≤5 parsel minor split.",
    countyler: ["Hill", "Blaine", "Phillips", "Garfield", "Sanders"],
    veriYolu: "eyalet-arcgis",
    kaynakNotu: "⭐ EN TEMİZ KAYNAK: MSDI eyalet geneli tek servis, 56 county, 920.897 parselin 286.441'i 'Vacant Land', posta alanları ayrı ve dolu.",
  },
  {
    kod: "WY", ad: "Wyoming", tier: 2, installment: "uygun", acreFiyat: 1000,
    gerekce: "Acre başı ~$1.000; 35+ acre tarımsal muafiyet; gelir vergisi yok.",
    countyler: ["Carbon", "Fremont", "Lincoln"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Eyalet geneli katmanda (373.666 parsel) sahip+posta VAR ama değer/sınıf alanı YOK → boş arsa ayırt edilemiyor. County servisleri kullanılıyor.",
  },
  {
    kod: "NV", ad: "Nevada", tier: 2, installment: "uygun", acreFiyat: 1230,
    gerekce: "Acre başı ~$1.230; Nye County Las Vegas erişim mesafesinde, gelir vergisi yok.",
    countyler: ["Nye"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Nye planlama ArcGIS'i çalışıyor (31.280 boş arsa). Posta eyaleti ayrı alan değil, 'CITY, ST' birleşiğinden ayrıştırılıyor.",
  },
  {
    kod: "AR", ad: "Arkansas", tier: 2, installment: "uygun", acreFiyat: 2500,
    gerekce: "Güneydoğu'nun en ucuzu, su bol, kırsal county'lerde minimal düzenleme.",
    countyler: ["Sharp", "Izard", "Van Buren"],
    veriYolu: "posta-adresi-yok",
    kaynakNotu: "⚠ AR eyalet katmanında SAHİBİN POSTA ADRESİ YOK (adrlabel = parselin kendi adresi). DB'deki 71.585 AR satırının %0'ı mailable. Regrid şart.",
  },
  {
    kod: "MS", ad: "Mississippi", tier: 2, installment: "uygun", acreFiyat: 2100,
    gerekce: "Acre başı ~$2.100; çoğu kırsal county'de bölme basit.",
    countyler: ["Jefferson", "Claiborne", "Amite", "Wilkinson", "Kemper"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Kaynak araştırması yapıldı — sonuç KAPSAM-ENVANTERI.md §6'da. Kayıt defterine eklenmeyi bekliyor.",
  },
  {
    kod: "WV", ad: "West Virginia", tier: 2, installment: "uygun", acreFiyat: 2200,
    gerekce: "Doğu kıyısına yakın, acre başı ~$2.200, kırsal muafiyetler var.",
    countyler: ["McDowell", "Webster", "Calhoun", "Clay", "Wirt"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Kaynak araştırması yapıldı — sonuç KAPSAM-ENVANTERI.md §6'da.",
  },
  {
    kod: "OK", ad: "Oklahoma", tier: 2, installment: "uygun", acreFiyat: 2880,
    gerekce: "10+ acre bölmeler muaf; düz tarım arazisi bol.",
    countyler: ["Pittsburg", "Atoka", "Beckham", "Bryan"],
    veriYolu: "posta-adresi-yok",
    kaynakNotu: "⚠ Mevcut OK ArcGIS katmanlarında sahip/posta alanı YOK (yalnızca parcel_id + geometri). DB'deki 345 satırın %0'ı mailable.",
  },
  {
    kod: "MO", ad: "Missouri", tier: 2, installment: "kosullu", acreFiyat: 3200,
    gerekce: "Kırsal county'lerin çoğunda sıfır zoning ve sıfır code enforcement.",
    countyler: ["Camden"],
    veriYolu: "county-arcgis",
    kaynakNotu: "⚠ Camden assessor servisi artık token istiyor (HTTP 499 'Token Required'). DB'deki 10.351 satır elde ama canlı tazeleme YOK.",
  },

  // ── TIER 3 — fırsat var, dikkat gerekli ──────────────────────────────────
  {
    kod: "CO", ad: "Colorado", tier: 3, installment: "uygun", acreFiyat: 2290,
    gerekce: "Doğu plains ucuz; 35+ acre genellikle muaf; Costilla tarihsel ana pazarımız.",
    countyler: ["Costilla", "Las Animas", "Park", "Pueblo", "Saguache"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Costilla/Las Animas kendi servisleriyle, Park eyalet katmanıyla çalışıyor. ⚠ Pueblo/Saguache'de arazi kullanımı opak kod (70E/04AB) → boş arsa ayıklanamıyor.",
  },
  {
    kod: "ID", ad: "Idaho", tier: 3, installment: "uygun", acreFiyat: 4500,
    gerekce: "≤4 parsel simple split; talep hızla artıyor.",
    countyler: ["Owyhee", "Cassia", "Elmore", "Lemhi"],
    veriYolu: "county-arcgis",
    kaynakNotu: "4 county çalışıyor (23.972 boş arsa). ⚠ Cassia/Elmore/Lemhi ISTC proxy'si arkasında, Referer başlığı zorunlu — ISTC değişirse sessizce ölür. ⚠ Idaho Code §74-120: bu veri ÜÇÜNCÜ TARAFA posta listesi olarak SATILAMAZ.",
  },
  {
    kod: "OR", ad: "Oregon", tier: 3, installment: "uygun", acreFiyat: 4800,
    gerekce: "Doğu Oregon ucuz; ≤3 parsel 'partition' ile bölünür.",
    countyler: ["Klamath", "Lake"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Klamath (28.390) ve Lake (6.265) çalışıyor. Lake'te değer alanı yok — ayrı 2020 katmanından backfill gerekiyor.",
  },
  {
    kod: "KY", ad: "Kentucky", tier: 3, installment: "uygun", acreFiyat: 3800,
    gerekce: "Minor plat (≤5 lot) kolay; dağlık doğu bölgesi ucuz.",
    countyler: ["Harlan", "Bell", "Leslie", "Elliott", "Wolfe"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Kaynak araştırması yapıldı — sonuç KAPSAM-ENVANTERI.md §6'da.",
  },
  {
    kod: "NC", ad: "North Carolina", tier: 3, installment: "uygun", acreFiyat: 5200,
    gerekce: "10+ acre parçalar tüm county subdivision kurallarından MUAF; ≤5 lot minor, 30-45 günde onay.",
    countyler: ["Brunswick", "Rutherford", "Northampton"],
    veriYolu: "eyalet-arcgis",
    kaynakNotu: "NC OneMap eyalet geneli katmanı çalışıyor (3 county 97.945 boş arsa). Bazı county'ler posta adresini tek alanda paketliyor — ayrıştırılıyor.",
  },
  {
    kod: "SC", ad: "South Carolina", tier: 3, installment: "uygun", acreFiyat: 4800,
    gerekce: "Kırsal bölgelerde bölme basit; Colleton kıyıya yakın.",
    countyler: ["Colleton"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Colleton çalışıyor (12.456 boş arsa) ama DEĞER ALANI YOK → fiyatlama yapılamıyor.",
  },
  {
    kod: "AL", ad: "Alabama", tier: 3, installment: "uygun", acreFiyat: 3200,
    gerekce: "Kırsal county'lerin çoğunda minimal düzenleme.",
    countyler: ["Wilcox", "Perry", "Lowndes", "Choctaw", "Clarke"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Kaynak araştırması yapıldı — sonuç KAPSAM-ENVANTERI.md §6'da.",
  },
  {
    kod: "GA", ad: "Georgia", tier: 3, installment: "uygun", acreFiyat: 4500,
    gerekce: "Atlanta uzağı ucuz; kırsal county'lerde bölme kolay.",
    countyler: ["Bibb", "Chatham"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Bibb (13.171) ve Chatham (16.973) çalışıyor.",
  },
  {
    kod: "KS", ad: "Kansas", tier: 3, installment: "uygun", acreFiyat: 2400,
    gerekce: "Kırsal county'lerde bölme basit; tarım arazisi bol.",
    countyler: ["Douglas"],
    veriYolu: "county-arcgis",
    kaynakNotu: "⚠ Eyalet geneli ORKA servisi CAMA (sahip/değer) verisini REST'te YAYINLAMIYOR. Hedeflenen ucuz county'lerin (Barber, Comanche, Elk…) hiçbirinde halka açık servis yok. Douglas tek doğrulanmış kaynak, değer alanı yok.",
  },
  {
    kod: "NE", ad: "Nebraska", tier: 3, installment: "uygun", acreFiyat: 2800,
    gerekce: "Çok kırsal, ucuz; county bazlı basit bölme.",
    countyler: ["Cass"],
    veriYolu: "county-arcgis",
    kaynakNotu: "⚠ Eyalet geneli katman 1,15M parsel içeriyor ama SAHİP ADI ve POSTA ADRESİ YOK. Cass tek doğrulanmış mailable kaynak (6.687 boş arsa).",
  },
  {
    kod: "SD", ad: "South Dakota", tier: 3, installment: "uygun", acreFiyat: 2800,
    gerekce: "Gelir vergisi yok; kırsal county'lerde minimal düzenleme.",
    countyler: ["Pennington"],
    veriYolu: "county-arcgis",
    kaynakNotu: "⚠ SD'nin eyalet geneli parsel servisi YOK (arcgis.sd.gov tarandı). Hedeflenen ucuz county'lerin (Harding, Ziebach, Corson…) hiçbirinde servis yok. Pennington tek kaynak (9.365 boş arsa).",
  },
  {
    kod: "MI", ad: "Michigan", tier: 3, installment: "kosullu", acreFiyat: 5500,
    gerekce: "Kuzey Michigan ucuz; Land Division Act county bazlı.",
    countyler: ["Roscommon"],
    veriYolu: "county-arcgis",
    kaynakNotu: "Roscommon çalışıyor (7.833 boş arsa).",
  },
  {
    kod: "TN", ad: "Tennessee", tier: 3, installment: "uygun", acreFiyat: 3500,
    gerekce: "5+ acre parçalar genellikle basit süreç.",
    countyler: ["Sullivan", "Chester"],
    veriYolu: "posta-adresi-yok",
    kaynakNotu: "⚠ TN eyalet parsel katmanında SAHİP ADI ve POSTA ADRESİ YOK (yalnızca GISLINK + geometri). DB'deki 3.666 satırın %0'ı mailable.",
  },

  // ── TIER 4 — pahalı ama iç bölgelerde fırsat ─────────────────────────────
  {
    kod: "FL", ad: "Florida", tier: 3, installment: "uygun", acreFiyat: 10000,
    gerekce: "İç bölgeler (Charlotte, Highlands, Citrus, Putnam) hâlâ ucuz; 2025 yasası bölmeyi kolaylaştırdı; taksitli satış çok yaygın.",
    countyler: ["Lee", "Charlotte", "Putnam", "Highlands", "Citrus", "Brevard", "Levy", "Marion", "Polk"],
    veriYolu: "eyalet-arcgis",
    kaynakNotu: "FL eyalet geneli centroid katmanı + Lee'nin kendi servisi. ⚠ Sıralamayı LND_VAL üzerinde yapmak zaman aşımına yol açıyor (OBJECTID'ye alındı). Marion ve Polk hâlâ 45sn'de yanıt vermiyor.",
  },
];

// ── Türetilmiş yardımcılar ──────────────────────────────────────────────────

export const HEDEF_EYALET_KODLARI: string[] = HEDEF_EYALETLER.map((e) => e.kod).sort();

export const HEDEF_SAYISI = HEDEF_EYALETLER.length;

/** Taksitli satışa ENGEL olan eyaletler — buraya girenler hedefe ALINMAZ. */
export const TAKSIT_YASAK_EYALETLER: string[] = ["NY"];

export function hedef(kod: string): EyaletHedefi | undefined {
  return HEDEF_EYALETLER.find((e) => e.kod === kod.toUpperCase());
}

/** Mektup atılamayacak (posta adresi olmayan) eyaletler — dürüst ayrım. */
export const POSTA_ADRESI_OLMAYAN: string[] = HEDEF_EYALETLER
  .filter((e) => e.veriYolu === "posta-adresi-yok")
  .map((e) => e.kod);
