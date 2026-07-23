// ─────────────────────────────────────────────────────────────────────────────
// REGION PLAYBOOK — bölgeye DOĞRU satış dili + DÜRÜST zoning/RV uyarısı.
//
// Amaç: her bölgeye uygun satış açısını (salesAngle) ve dürüst kullanım/izin
// notunu (zoningNote) sisteme gömmek ki yanlış vaat verilmesin. Saf + deterministik
// + null-safe. Hiçbir değerleme/fiyat mantığına dokunmaz — sadece metin/etiket üretir.
//
// KIRMIZI ÇİZGİ:
//   • Her entry'nin zoningNote'u "teyit alıcıda / county'den doğrula" şerhi taşır.
//   • ASLA blanket hukuki vaat verme ("RV yasaldır" gibi). Belirsizse güvenli default.
//
// ARKA PLAN: Arizona çölü ≠ Florida. AZ Mohave (Golden Valley/Meadview/Topock/
// Dolan Springs/Yucca) = unrestricted, off-grid/RV/kamp/homestead satılır.
// FL platted subdivision (Compass Lake/Alford, Jackson County) = mobil/modüler/
// site-built EV için lot; RV'de SÜREKLI oturma çoğu FL county'sinde YASAK +
// POA/deed-restriction olabilir.
// ─────────────────────────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";

export type AllowedUse =
  | "off-grid"
  | "rv"
  | "camping"
  | "homestead"
  | "mobile-home"
  | "modular"
  | "site-built"
  | "agricultural"
  | "recreational";

export type MatchBasis = "city" | "county" | "state" | "default";

export interface Playbook {
  /** İnsan-okur bölge etiketi (ör. "Mohave County, AZ — Golden Valley"). */
  region: string;
  /** Kısa satış pitch'i (Ahmet/mektup bu dili kullanır). */
  salesAngle: string;
  /** İzin verilen/satılabilir kullanımlar (off-grid/RV/mobil-ev/site-built...). */
  allowedUses: AllowedUse[];
  /** DÜRÜST zoning/izin uyarısı — HER ZAMAN "teyit alıcıda" şerhi taşır. */
  zoningNote: string;
  /** Owner-finance / taksitli satış notu (varsa). */
  installmentNote?: string;
  /** Güven seviyesi: city=high, county=medium, state/default=low (genelde). */
  confidence: Confidence;
  /** Eşleşmenin hangi seviyede yapıldığı. */
  matchBasis: MatchBasis;
}

export interface PlaybookQuery {
  state?: string | null;
  county?: string | null;
  region?: string | null; // şehir / bölge adı
  address?: string | null; // serbest metin fallback (situs / property_address)
}

// Tüm zoningNote'ların ortak güvenli kuyruğu — her entry'de teyit şerhi GARANTİ.
const CONFIRM_TAIL = "Kullanım/izin parselin zone'una göre değişir — alıcı county zoning'den teyit etmeli.";

// Arizona'ya özgü — arazi temizliği/ağaç kesme: korumalı yerli bitki uyarısı (Native Plant Law).
const AZ_NATIVE_PLANT =
  "Arazi temizliği: Arizona Native Plant Law korumalı yerli türleri (Joshua tree, saguaro, ocotillo, ironwood, bazı kaktüsler) kapsar — serbestçe kesilemez; AZ Dept of Agriculture'a bildirim/izin (bazen salvage/taşıma) gerekebilir. Çöl çalısı (creosote/brush) genelde serbest. Korumalı bitki için alıcı teyit etmeli.";

// ── State normalizasyonu (market-overlap / all-deals deseniyle uyumlu) ──────────
const FULL: Record<string, string> = {
  alabama: "AL", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  florida: "FL", georgia: "GA", idaho: "ID", kentucky: "KY", louisiana: "LA",
  michigan: "MI", missouri: "MO", nevada: "NV", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", ohio: "OH", oklahoma: "OK", oregon: "OR", "south carolina": "SC",
  tennessee: "TN", texas: "TX", utah: "UT", wyoming: "WY",
};
const ABBR = new Set(Object.values(FULL));

function normState(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (/^[A-Za-z]{2}$/.test(t) && ABBR.has(t.toUpperCase())) return t.toUpperCase();
  const low = t.toLowerCase();
  for (const [name, ab] of Object.entries(FULL)) if (low === name || low.startsWith(name + " ")) return ab;
  return /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : null;
}

const normCounty = (c: string | null | undefined) =>
  (c || "").toLowerCase().replace(/\s+county$/i, "").trim();

// Adres kuyruğundan eyalet çıkar: "..., MEADVIEW, AZ 86444" → "AZ".
function stateFromAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const m = addr.toUpperCase().match(/,\s*([A-Z]{2})\s*,?\s*\d{5}/) || addr.toUpperCase().match(/\b([A-Z]{2})\s+\d{5}\b/);
  return m && ABBR.has(m[1]) ? m[1] : null;
}

// ── Entry şablonları (pure data) ────────────────────────────────────────────────
interface CityEntry {
  kind: "city";
  state: string;
  cities: string[]; // anahtar kelimeler (lowercase, includes ile aranır)
  pb: Omit<Playbook, "matchBasis">;
}
interface CountyEntry {
  kind: "county";
  state: string;
  counties: string[]; // normCounty'lenmiş anahtarlar
  pb: Omit<Playbook, "matchBasis">;
}
interface StateEntry {
  kind: "state";
  state: string;
  pb: Omit<Playbook, "matchBasis">;
}

// AZ Mohave — unrestricted çöl: off-grid/RV/kamp/homestead.
const AZ_MOHAVE_PB: Omit<Playbook, "matchBasis"> = {
  region: "Mohave County, AZ",
  salesAngle: "Off-grid çöl yaşamı / RV / kamp / homestead için ucuz ham arsa — Mohave görece izin verici, eyalet-dışı alıcıya cazip giriş.",
  allowedUses: ["off-grid", "rv", "camping", "homestead", "mobile-home", "recreational"],
  zoningNote:
    "Mohave County görece izin verici; off-grid genelde sorun değil. Ancak RV'de SÜREKLI oturma süresi parselin zone'una (ör. AR/RR) göre değişir — RV oturumu için blanket izin vaadi verilmez. " +
    AZ_NATIVE_PLANT + " " +
    CONFIRM_TAIL,
  installmentNote: "AZ non-judicial foreclosure → temerrütte hızlı geri-al; senet + deed of trust (CFD kullanma).",
  confidence: "high",
};

// AZ Coconino (Williams) — daha düzenli, orman yakını.
const AZ_COCONINO_PB: Omit<Playbook, "matchBasis"> = {
  region: "Coconino County, AZ (Williams)",
  salesAngle: "Çam/orman yakını rekreasyon arsası — Williams/Coconino; manzara + serin iklim, hafta sonu kaçış konumu.",
  allowedUses: ["recreational", "camping", "site-built"],
  zoningNote:
    "Coconino County off-grid/RV ve permit kurallarını Mohave'den DAHA SIKI uygular; süreli oturma ve yapı izinleri sınırlı olabilir — alıcı county zoning/permit ofisinden teyit etmeli. " +
    AZ_NATIVE_PLANT + " " +
    CONFIRM_TAIL,
  installmentNote: "AZ non-judicial foreclosure → hızlı geri-al; senet + deed of trust.",
  confidence: "high",
};

// FL platted subdivision (Jackson County: Compass Lake, Alford) — ev lotu.
const FL_PLATTED_PB: Omit<Playbook, "matchBasis"> = {
  region: "Jackson County, FL — platted subdivision (Compass Lake / Alford)",
  salesAngle: "Platted subdivision lot — mobil/modüler/site-built EV için arsa (göl/orman yakını, altyapısı oturmuş bölge).",
  allowedUses: ["mobile-home", "modular", "site-built", "recreational"],
  zoningNote:
    "FL platted subdivision: RV'de SÜREKLI oturma çoğu FL county'sinde YASAKTIR (geçici kamp ≠ ikamet). POA/deed-restriction (HOA aidatı, yapı şartı) olabilir — alıcı county zoning + POA kurallarından teyit etmeli. " +
    CONFIRM_TAIL,
  installmentNote: "FL taksitli (owner-finance) satışa uygun; deed-restriction ve POA aidatlarını sözleşmeye yansıt.",
  confidence: "high",
};

const CITY_ENTRIES: CityEntry[] = [
  {
    kind: "city",
    state: "AZ",
    cities: ["golden valley", "golden vly", "meadview", "topock", "dolan springs", "dolan spgs", "yucca", "kingman", "fort mohave", "ft mohave", "ft. mohave", "bullhead", "lake havasu", "havasu"],
    pb: AZ_MOHAVE_PB,
  },
  { kind: "city", state: "AZ", cities: ["williams"], pb: AZ_COCONINO_PB },
  { kind: "city", state: "FL", cities: ["compass lake", "alford"], pb: FL_PLATTED_PB },
];

const COUNTY_ENTRIES: CountyEntry[] = [
  { kind: "county", state: "AZ", counties: ["mohave"], pb: { ...AZ_MOHAVE_PB, confidence: "medium" } },
  { kind: "county", state: "AZ", counties: ["coconino"], pb: { ...AZ_COCONINO_PB, confidence: "medium" } },
  { kind: "county", state: "FL", counties: ["jackson"], pb: { ...FL_PLATTED_PB, confidence: "medium" } },
];

// ── State-level installment-friendly fallback'ler (AHMET-SUNUM-HAZIRLIK kuralları) ──
function stateFallback(state: string, salesAngle: string, allowedUses: AllowedUse[], extraZoning: string, installmentNote: string, confidence: Confidence = "low"): StateEntry {
  return {
    kind: "state",
    state,
    pb: {
      region: `${state} (genel)`,
      salesAngle,
      allowedUses,
      zoningNote: `${extraZoning} ${CONFIRM_TAIL}`.trim(),
      installmentNote,
      confidence,
    },
  };
}

const NONJUDICIAL = "non-judicial foreclosure → temerrütte hızlı geri-al; senet + deed of trust (CFD kullanma).";

const STATE_ENTRIES: StateEntry[] = [
  stateFallback("AZ", "Ucuz çöl/ham arsa — off-grid potansiyeli; taksitli (owner-finance) satışa uygun eyalet.", ["off-grid", "recreational"], "AZ kırsalı genelde izin verici ama parsel bazında değişir.", NONJUDICIAL),
  stateFallback("TX", "Ucuz kırsal arsa — owner-finance dostu, geniş eyalet; off-grid/rekreasyon konumuna göre.", ["recreational", "off-grid"], "TX'te county/MUD kuralları değişken; deed-restriction olabilir.", NONJUDICIAL),
  stateFallback("NM", "Ucuz çöl/yayla arsa (Luna/Valencia) — off-grid/homestead; taksitli satışa uygun.", ["off-grid", "recreational", "homestead"], "NM kırsalı izin verici olabilir ama subdivision/permit kuralları parsele göre değişir.", "NM owner-finance'a uygun; geri-al süreci için title firmasıyla çalış."),
  stateFallback("CO", "Ucuz yayla/orman arsa (Costilla/Saguache) — rekreasyon/off-grid; taksitli satış.", ["off-grid", "recreational", "camping"], "CO bazı county'lerde (ör. Costilla) kamp/oturma gün sınırı uygular — sıkı olabilir.", "CO owner-finance'a uygun; oturma gün limitlerini alıcıya açıkça bildir."),
  stateFallback("FL", "Platted/ham arsa — mobil/modüler/site-built EV lotu; taksitli satışa uygun.", ["mobile-home", "modular", "site-built", "recreational"], "FL'de RV'de sürekli oturma çoğu county'de yasak; POA/deed-restriction olabilir.", "FL owner-finance'a uygun; deed-restriction'ları sözleşmeye yansıt."),
  stateFallback(
    "TN",
    "Cumberland Plateau — 60'lar/70'lerin eski rekreasyon subdivision lotları (orman/manzara); ucuz hafta-sonu kaçış + homestead arsası, absentee miras sahiplerinden alım.",
    ["recreational", "camping", "homestead", "site-built"],
    "Kırsal TN county'lerinin çoğunda county zoning zayıf/yok AMA eski platted subdivision'larda POA/deed-restriction (min. yapı, RV yasağı) yaşıyor olabilir; plato arazisi dik/kayalık — septik için perk testi şart.",
    NONJUDICIAL,
    "medium"
  ),
  stateFallback(
    "NV",
    "Nye County (Pahrump/Calvada) — 60'lar/70'lerin posta-yoluyla-satılmış çöl subdivision lotları; sahiplerin ezici kısmı eyalet-dışı absentee (motive satıcı), off-grid/RV/yatırım için düşük giriş fiyatı.",
    ["off-grid", "recreational", "camping"],
    "⚠ NV çölünde SU GERÇEK risk: çoğu lotta kuyu/su hakkı YOK ve Pahrump havzası (Basin 162) aşırı tahsisli — yeni kuyu izni kısıtlı olabilir; su hakkı ayrı satılır, arsayla otomatik gelmez. Calvada tipi lotlarda yol/elektrik de olmayabilir — alıcı su hakkı + kuyu iznini NV Division of Water Resources ve county'den doğrulamalı.",
    NONJUDICIAL,
    "medium"
  ),
  stateFallback(
    "OK",
    "Ucuz kırsal arsa — eyalet-dışı/absentee miras sahipleri yoğun (motive satıcı); homestead/rekreasyon için düşük giriş fiyatı, owner-finance dostu.",
    ["recreational", "homestead", "off-grid", "agricultural"],
    "Kırsal OK county'lerinin çoğunda county zoning YOK (metrolar hariç) — kullanım esnek AMA mineral hakları çoğu parselde AYRIK (yüzey ≠ maden) ve yol erişimi/easement doğrulanmalı.",
    NONJUDICIAL,
    "medium"
  ),
  stateFallback("AR", "Ucuz kırsal/orman arsa — owner-finance dostu.", ["recreational", "homestead"], "AR county kuralları değişken.", NONJUDICIAL),
  stateFallback(
    "OR",
    "Christmas Valley (Lake) + Klamath — 1960'ların posta-yoluyla-satılmış çöl subdivision lotları; absentee sahipler yoğun (motive satıcı), off-grid/rekreasyon için çok düşük giriş fiyatı.",
    ["off-grid", "recreational", "camping"],
    "⚠ Christmas Valley'nin land-scam GEÇMİŞİ alıcıya dürüstçe söylenir: bölge rüzgarlı, toprak alkali/tozlu, çoğu lotta su-elektrik-yol yok. Ayrıca Oregon eyalet planlama kuralları (statewide land use) SIKI — kırsal parselde konut izni EFU/zoning'e takılabilir, 'ev yapılır' vaadi verilmez.",
    "OR owner-finance yapılabilir ama forclosure süreci eyalet kurallarına göre değişir — title firmasıyla çalış; nakit satış öncelik.",
    "medium"
  ),
  stateFallback(
    "GA",
    "Güney GA kırsal/orman arsası — heirs' property (bölünmemiş miras arazisi) yoğun; motive absentee mirasçılardan düşük fiyatlı alım, tarım/rekreasyon/ev lotu.",
    ["recreational", "agricultural", "site-built", "mobile-home"],
    "⚠ GA'da heirs' property riski GERÇEK: tapu bölünmemişse TÜM mirasçıların imzası (veya quiet title davası) gerekir — title araştırması yapılmadan kapanış vaadi verilmez; tax deed alımlarında 12 aylık redemption (%20 prim) süreci vardır.",
    "GA owner-finance'a uygun; heirs'/tax-deed kaynaklı parselde title netleşmeden taksitli satış başlatma.",
    "medium"
  ),
  stateFallback(
    "MO",
    "Lake of the Ozarks (Camden) — göl/rekreasyon subdivision lotları; KC/StL/eyalet-dışı absentee sahipler yoğun, hafta-sonu kaçış + emeklilik arsası olarak satılır.",
    ["recreational", "camping", "site-built", "mobile-home"],
    "⚠ Göl bölgesi lotlarında POA/HOA aidatı ve deed-restriction (min. yapı, mobil ev yasağı) YAYGIN — aidat borcu alıcıya geçebilir. 'Göl erişimi' vaadi verilmez: çoğu lot göl kıyısı DEĞİL, erişim ancak subdivision'ın ortak alanı/rampası varsa vardır; Ameren kıyı şeridi izni ayrı konu. Alıcı POA aidatı + erişimi county ve POA'dan doğrulamalı.",
    NONJUDICIAL,
    "medium"
  ),
  stateFallback(
    "MI",
    "Upper Peninsula — av/rekreasyon parselleri (orman, ATV/kar motoru, geyik avı); eyalet-güneyi (downstate) absentee sahipler yoğun, sezonluk kullanım arsası olarak satılır.",
    ["recreational", "camping", "homestead"],
    "⚠ UP'de KAR GERÇEK: yıllık 3-8 metre kar yağar, çoğu arka-yol kışın BAKILMAZ — parsel yılın 4-5 ayı pratikte erişilmez olabilir; 'yıl boyu erişim' vaadi verilmez. Yasal yol erişimi (easement) parsel bazında doğrulanmalı; landlocked av parseli yaygındır.",
    NONJUDICIAL,
    "medium"
  ),
  stateFallback(
    "SC",
    "Lowcountry (Colleton/ACE Basin) — kırsal+kıyı-yakını lotlar; heirs' property ve eyalet-dışı absentee sahipler yoğun (motive satıcı), Charleston yayılımının kenarında düşük giriş fiyatı.",
    ["recreational", "agricultural", "site-built", "mobile-home"],
    "⚠ SC'de heirs' property riski GERÇEK (Lowcountry'de ABD'nin en yoğun bölgelerinden): tapu bölünmemişse TÜM mirasçıların imzası veya mahkeme süreci gerekir — title araştırması yapılmadan kapanış vaadi verilmez. Kıyı-yakını lotlarda wetland/CRZ (kıyı düzenleme) kısıtı yapılaşmayı engelleyebilir — alıcı title + wetland durumunu county ve title firmasından doğrulamalı.",
    "SC owner-finance'a uygun; heirs' kaynaklı parselde title netleşmeden taksitli satış başlatma.",
    "medium"
  ),
  stateFallback("WY", "Ucuz açık arazi — off-grid/rekreasyon; taksitli satışa uygun.", ["off-grid", "recreational"], "WY kırsalı izin verici olabilir ama parsel bazında değişir.", NONJUDICIAL),
  // NY — taksitli satış ÖNERİLMEZ (alıcı çıkarma sorunu). Güvenli, uyarılı.
  {
    kind: "state",
    state: "NY",
    pb: {
      region: "New York (genel)",
      salesAngle: "Kırsal arsa — ama bu eyalette taksitli satış modeli RİSKLİ (Ahmet'in ayrı ev işi).",
      allowedUses: ["recreational"],
      zoningNote: `⚠ NY'de TAKSİTLİ (installment) satış YAPMA — temerrütte alıcı çıkarma süreci zor. Kullanım/izin için alıcı county'den teyit etmeli. ${CONFIRM_TAIL}`,
      installmentNote: "NY'de installment/owner-finance ÖNERİLMEZ — alıcı çıkarma riski; nakit satışı tercih et.",
      confidence: "medium",
    },
  },
];

// ── Default (bilinmeyen) — güvenli uyarı ────────────────────────────────────────
const DEFAULT_PB: Omit<Playbook, "matchBasis"> = {
  region: "Bilinmeyen bölge",
  salesAngle: "Ucuz arsa fırsatı — kullanım potansiyeli (off-grid/RV/ev) parsele göre, satış dili DD sonrası netleşir.",
  allowedUses: [],
  zoningNote: `Zone/izin doğrulanmadı — kullanım (off-grid/RV/ev) alıcı tarafından county zoning'den teyit edilmeli. Blanket vaat verilmez. ${CONFIRM_TAIL}`,
  confidence: "low",
};

// Test/denetim için tüm tanımlı entry'lerin playbook'ları (default dahil).
export const ALL_PLAYBOOK_ENTRIES: Omit<Playbook, "matchBasis">[] = [
  ...CITY_ENTRIES.map((e) => e.pb),
  ...COUNTY_ENTRIES.map((e) => e.pb),
  ...STATE_ENTRIES.map((e) => e.pb),
  DEFAULT_PB,
];

/**
 * Bölge/eyalet → playbook. Saf + deterministik + null-safe.
 * Öncelik: şehir (city) > county > eyalet (state) > default.
 * Şehir/county eşleşmesi state uyumu gerektirir (state biliniyorsa) — yanlış
 * eşleşmeyi (ör. başka eyaletteki "Williams") engeller.
 */
export function regionPlaybook(q: PlaybookQuery): Playbook {
  const state = normState(q.state) ?? stateFromAddress(q.address);
  const county = normCounty(q.county);
  const hay = `${q.region ?? ""} ${q.county ?? ""} ${q.address ?? ""}`.toLowerCase();

  // 1) Şehir (city) — state biliniyorsa eşleşmeli; bilinmiyorsa anahtar-kelime yeterli.
  for (const e of CITY_ENTRIES) {
    if (state && state !== e.state) continue;
    if (e.cities.some((c) => hay.includes(c))) {
      return { ...e.pb, matchBasis: "city" };
    }
  }

  // 2) County — state gerekli (county adları eyaletler arası tekrar eder).
  if (state) {
    for (const e of COUNTY_ENTRIES) {
      if (e.state !== state) continue;
      if (e.counties.some((c) => county === c || hay.includes(c))) {
        return { ...e.pb, matchBasis: "county" };
      }
    }
  }

  // 3) Eyalet (state) fallback.
  if (state) {
    const e = STATE_ENTRIES.find((x) => x.state === state);
    if (e) return { ...e.pb, matchBasis: "state" };
  }

  // 4) Default güvenli uyarı.
  return { ...DEFAULT_PB, matchBasis: "default" };
}

/** Harita popup / tek satır gösterim: "Satış açısı: … · ⚠ {zoningNote}". */
export function formatPlaybookLine(pb: Playbook): string {
  return `Satış açısı: ${pb.salesAngle} · ⚠ ${pb.zoningNote}`;
}

// İnsan-okur kullanım etiketleri (UI rozetleri için).
export const USE_LABELS: Record<AllowedUse, string> = {
  "off-grid": "Off-grid",
  rv: "RV",
  camping: "Kamp",
  homestead: "Homestead",
  "mobile-home": "Mobil ev",
  modular: "Modüler ev",
  "site-built": "Site-built ev",
  agricultural: "Tarım",
  recreational: "Rekreasyon",
};
