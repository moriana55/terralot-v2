// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET NOT MOTORU — SAF ÇEKİRDEK (test edilebilir, DB'siz).
//
// 565K offmarket_leads kaydını A+..F harf notuyla puanlar. Yiğit'in onayladığı
// revize ağırlıklar (2026-07-23 brief revizyonu):
//   • CAZİBE / FİZİKSEL  ~40  → acre sweet-spot (10) + OSM geo mesafeleri (30):
//        yol erişimi (12), elektrik hattı (8), su/göl (6), kasaba (4)
//        — Amerikalı arsa alıcısının gerçekten istediği özellikler.
//   • PAZAR LİKİDİTESİ   ~20  → rakip (Discount Lots/Landio/Rina) aynı county'de
//        ilan taşıyor mu (pazar-var-mı sinyali; fiyat-arbitraj vurgusu DEĞİL)
//        + county nüfus büyümesi (county_growth.json).
//   • MARJ               ~15  → net = est_retail − est_offer − $2.000 sabit gider.
//        Net $5K altı (bilinen değerde) C tavanı. Değer verisi olmayan
//        eyaletlerde (MO/SC/OR-Lake/TN/OK) county rakip $/acre comp'undan
//        TAHMİN — tahmin olduğu bayraklanır, not düşürülmez.
//   • SATICI MOTİVASYONU ~15  → absentee / out-of-state, aynı sahip+adreste 5+
//        parsel (toplu anlaşma), miras kalıpları (EST OF/ESTATE/HEIRS/TRUST),
//        tax_delinquent_properties overlap.
//   • KAPANIŞ RİSKİ      ~−10 → bilinen POA/HOA subdivision cezası; kamu/kurum
//        sahipli parsel doğrudan F (satın alınamaz).
//
// DÜRÜSTLÜK KURALI: her puan bileşeni grade_flags'e insan-okur gerekçe yazar;
// tahmin/eksik veri açıkça "tahmin"/"eksik" olarak bayraklanır.
// Geo mesafeleri (dist_*_m): NULL = taranmadı, -1 = tarandı/bulunamadı.
// Geo doğrulaması OLMAYAN kayıt B tavanına takılır → A+/A her zaman
// Overpass ile doğrulanmış parseldir (vitrin güvenilirliği).
// ─────────────────────────────────────────────────────────────────────────────

export const GRADES = ["A+", "A", "B", "C", "D", "F"];

// Not dağılımı (skor percentile'ından): A+ en iyi %1, A sonraki %4, B %15,
// C %30, D %30, F kalan — "herkes A" olmasın diye sabit.
export const GRADE_QUANTILES = [0.01, 0.05, 0.2, 0.5, 0.8];

const FIXED_COST = 2000; // kapanış + geri vergi + outreach sabit gideri ($)

// ── Kamu/kurum sahibi — satın alınamaz, doğrudan F.
// Kaynak kalıp: dashboard/src/lib/mohave-campaign.ts isGovOwner (genişletildi).
const GOV_OWNER_RE =
  /\b(UNITED STATES|U S A|USA\b|STATE OF|COUNTY OF|CITY OF|TOWN OF|VILLAGE OF|BUREAU OF LAND|BLM\b|SCHOOL DISTRICT|INDIAN TRIBE|TRIBAL|FOREST SERVICE|DEPT OF|DEPARTMENT OF|HOUSING AUTHORITY|IMPROVEMENT DISTRICT|WATER DISTRICT|POWER DISTRICT|DRAINAGE DISTRICT|LEVEE DISTRICT|HIGHWAY DEPT)\b/;
export function isGovOwner(owner) {
  return GOV_OWNER_RE.test(String(owner ?? "").toUpperCase());
}

// ── Miras/estate motivasyon kalıpları (satmaya daha yatkın sahip).
const ESTATE_RE = /\b(EST OF|ESTATE|HEIRS|TRUST|TTEE|TRUSTEE)\b/;
export function isEstateOwner(owner) {
  return ESTATE_RE.test(String(owner ?? "").toUpperCase());
}

// ── Bilinen POA/HOA subdivision'ları — yıllık aidat + devir kuralları kapanışı
// zorlaştırır/marjı yer. Liste bilinçli KISA ve belgeli tutuldu (uydurma yok):
//   • Calvada Valley / Calvada Meadows (Pahrump, Nye County NV) — büyük POA.
//   • Cherokee Village (Sharp/Fulton AR) — SID assessment'lı dev subdivision.
//   • Horseshoe Bend (Izard AR) — POA'lı planlı topluluk.
//   • Fairfield Bay (Van Buren/Cleburne AR) — POA'lı resort topluluk.
//   • Hot Springs Village (Garland/Saline AR) — ABD'nin en büyük gated POA'sı.
// İki seviye: situs/adres düzeyinde isim geçiyorsa GÜÇLÜ (-8); yalnız
// region/county etiketi o bölgeyi işaret ediyorsa BÖLGESEL RİSK (-5) —
// NV Nye verisi "Pahrump/Calvada" bölge etiketiyle geldiği için parsel bazında
// kesin POA üyeliği bilinmiyor, dürüstçe "risk" olarak bayraklanır.
const POA_KEYWORDS = [
  "CALVADA",
  "CHEROKEE VILLAGE",
  "HORSESHOE BEND",
  "FAIRFIELD BAY",
  "HOT SPRINGS VILLAGE",
];
export function detectPoa({ state, county, region, situs }) {
  const sit = String(situs ?? "").toUpperCase();
  for (const k of POA_KEYWORDS) if (sit.includes(k)) return { level: "strong", name: k };
  const reg = `${String(county ?? "")} ${String(region ?? "")}`.toUpperCase();
  for (const k of POA_KEYWORDS) if (reg.includes(k)) return { level: "region", name: k };
  return null;
}

// ── County adı normalizasyonu — "Bibb County, GA" → "BIBB"; likidite/growth
// eşleşmesi için tek biçim. AZ verisinde county alanı bölge adı taşır
// (ör. "Dolan Springs / Meadview") — hepsi Mohave taraması → "MOHAVE".
export function normCounty(state, county, region) {
  if (String(state).toUpperCase() === "AZ") return "MOHAVE";
  let c = String(county ?? region ?? "").toUpperCase().trim();
  c = c.replace(/,\s*[A-Z]{2}$/, "").replace(/\s+COUNTY$/, "").trim();
  return c;
}

// ── Acre sweet-spot (cazibe bileşeni, 0-10) — ABD kırsal arsa alıcısının
// tipik talebi 1-10 acre bandında; 0.25 altı mikro-lot satılması en zor ürün.
export function acresPoints(acres) {
  const a = Number(acres);
  if (!Number.isFinite(a) || a <= 0) return { pts: 0, flag: "acre verisi yok" };
  if (a < 0.25) return { pts: 0, flag: `mikro parsel (${a} ac < 0.25) — satışı zor` };
  if (a < 0.5) return { pts: 4, flag: null };
  if (a < 1) return { pts: 7, flag: null };
  if (a <= 10) return { pts: 10, flag: null };
  if (a <= 20) return { pts: 7, flag: null };
  if (a <= 40) return { pts: 5, flag: null };
  return { pts: 3, flag: `büyük parsel (${Math.round(a)} ac) — alıcı havuzu dar` };
}

// ── Geo cazibe (0-30) — OSM Overpass GERÇEK mesafeleri (geo-enrich yazdı).
// null = taranmadı (0 puan + "geo bekliyor" bayrağı puanlayanda),
// -1   = tarandı, yarıçap içinde bulunamadı.
export function geoPoints(geo) {
  const flags = [];
  let pts = 0;
  let landlocked = false;
  const { dist_road_m: road, dist_power_m: power, dist_water_m: water, dist_town_m: town } = geo ?? {};

  if (road != null) {
    if (road === -1) {
      landlocked = true;
      flags.push("⛔ 1.6 km içinde yol yok (OSM) — landlocked");
    } else if (road <= 100) { pts += 12; flags.push(`🛣 yola cepheli (~${road} m)`); }
    else if (road <= 400) { pts += 9; flags.push(`🛣 yol ~${road} m`); }
    else if (road <= 800) { pts += 6; flags.push(`🛣 yol ~${road} m`); }
    else { pts += 3; flags.push(`🛣 yol uzak (~${road} m)`); }
  }
  if (power != null && power !== -1) {
    if (power <= 150) { pts += 8; flags.push(`⚡ elektrik hattı ~${power} m`); }
    else if (power <= 500) { pts += 5; flags.push(`⚡ elektrik ~${power} m`); }
    else { pts += 2; flags.push(`⚡ elektrik uzak (~${power} m)`); }
  } else if (power === -1) flags.push("elektrik hattı 1.5 km içinde görünmüyor (OSM)");
  if (water != null && water !== -1) {
    if (water <= 300) { pts += 6; flags.push(`🌊 su/göl ~${water} m`); }
    else { pts += 3; flags.push(`🌊 su ~${water} m`); }
  }
  if (town != null && town !== -1) {
    if (town <= 8000) { pts += 4; flags.push(`🏘 kasabaya ~${(town / 1000).toFixed(0)} km`); }
    else { pts += 2; flags.push(`🏘 kasabaya ~${(town / 1000).toFixed(0)} km`); }
  }
  return { pts, flags, landlocked };
}

/**
 * KADEME 1+2 SKOR — tek lead'i puanlar.
 * ctx:
 *   liquidity   : Map "ST|COUNTY" → { n, medPpa }   (competitor_listings)
 *   stateLiq    : Map "ST"        → { n, medPpa }
 *   growth      : Map "ST|COUNTY" → { g5, g1, pop } (county_growth.json)
 *   ownerCluster: Map "OWNER|MAILING" (upper) → parsel sayısı (>=5 olanlar)
 *   taxDelinq   : Set  "ST|APN" ve "ST|OWNER"      (tax_delinquent_properties)
 * Dönen: { score, flags, grade_cap } — grade_cap: "F" | "C" | "B" | null.
 */
export function scoreLead(lead, ctx) {
  const flags = [];
  let cap = null;

  // 0) Kamu sahipli → doğrudan F, puan hesabı anlamsız.
  if (isGovOwner(lead.owner)) {
    return { score: 0, flags: ["kamu/kurum sahipli — satın alınamaz"], grade_cap: "F" };
  }

  const st = String(lead.state ?? "").toUpperCase();
  const county = normCounty(st, lead.county, lead.region);
  let score = 0;

  // 1) CAZİBE ~40 ─ acre (10) + geo (30)
  const ap = acresPoints(lead.acres);
  score += ap.pts;
  if (ap.flag) flags.push(ap.flag);
  const gp = geoPoints(lead);
  score += gp.pts;
  flags.push(...gp.flags);
  if (gp.landlocked) cap = "F";
  const geoDone = lead.geo_enriched_at != null || lead.dist_road_m != null;
  if (!geoDone) {
    flags.push("geo doğrulaması bekliyor (yol/elektrik/su taranmadı)");
    if (cap !== "F") cap = "B"; // A+/A yalnız geo-doğrulanmış parsele
  }

  // 2) LİKİDİTE ~20 ─ rakip aynı county'de satıyor mu (pazar kanıtı) + büyüme
  const liq = ctx.liquidity?.get(`${st}|${county}`);
  const sliq = ctx.stateLiq?.get(st);
  if (liq && liq.n >= 3) { score += 14; flags.push(`pazar kanıtlı: rakipler bu county'de ${liq.n} ilan taşıyor`); }
  else if (liq) { score += 10; flags.push(`rakip bu county'de aktif (${liq.n} ilan)`); }
  else if (sliq && sliq.n >= 10) { score += 6; flags.push("rakip eyalette aktif, bu county'de ilanı yok"); }
  else if (sliq && sliq.n >= 3) { score += 4; }
  else flags.push("county/eyalette rakip kanıtı yok — pazar belirsiz");
  const gr = ctx.growth?.get(`${st}|${county}`);
  if (gr) {
    if (gr.g5 >= 0.05) { score += 6; flags.push(`county nüfusu 5 yılda %${Math.round(gr.g5 * 100)} büyüdü`); }
    else if (gr.g5 >= 0.02) { score += 4; }
    else if (gr.g5 >= 0) { score += 2; }
    else flags.push(`county nüfusu düşüyor (%${Math.round(gr.g5 * 100)}/5y)`);
  }

  // 3) MARJ ~15 ─ net = retail − offer − sabit gider; eksik değerde comp tahmini
  const retail = num(lead.est_retail);
  const offer = num(lead.est_offer);
  const margin = num(lead.est_margin);
  let net = null;
  let estimated = false;
  if (retail != null && offer != null) net = retail - offer - FIXED_COST;
  else if (margin != null) net = margin - FIXED_COST;
  else {
    // MO/SC/OR-Lake/TN/OK: değerleme yok → county (yoksa eyalet) rakip $/acre
    // comp'undan TAHMİN. Blind teklif ~%35 varsayımıyla net ≈ 0.65×retail − gider.
    const ppa = liq?.medPpa ?? sliq?.medPpa ?? null;
    const a = Number(lead.acres);
    if (ppa != null && Number.isFinite(a) && a > 0) {
      net = 0.65 * ppa * a - FIXED_COST;
      estimated = true;
      flags.push("değer TAHMİNİ: rakip $/acre comp'undan (county değerlemesi yok)");
    } else {
      score += 5; // nötr — notu veri eksikliğiyle çökertme (brief kuralı)
      flags.push("değer verisi eksik — marj puanı nötr");
    }
  }
  if (net != null) {
    if (net >= 15000) score += 15;
    else if (net >= 8000) score += 12;
    else if (net >= 5000) score += 8;
    else if (net >= 2500) score += 4;
    else if (net >= 0) score += 2;
    else flags.push("net marj negatif görünüyor");
    if (net < 5000 && !estimated) {
      if (cap !== "F") cap = capMin(cap, "C");
      flags.push("net marj $5K altı — C tavanı");
    }
  }

  // 4) MOTİVASYON ~15
  let mot = 0;
  const outOfState = lead.mailing_state && st && String(lead.mailing_state).toUpperCase() !== st;
  if (lead.absentee || outOfState) { mot += 6; flags.push(outOfState ? "out-of-state sahip" : "absentee sahip"); }
  const clusterKey = ownerClusterKey(lead.owner, lead.mailing_address);
  const clusterN = ctx.ownerCluster?.get(clusterKey);
  if (clusterN >= 5) { mot += 4; flags.push(`toplu anlaşma: aynı sahipte ${clusterN} parsel`); }
  if (isEstateOwner(lead.owner)) { mot += 3; flags.push("miras/trust sahibi — motivasyon yüksek"); }
  if (ctx.taxDelinq?.has(`${st}|APN|${String(lead.apn ?? "").toUpperCase()}`) ||
      ctx.taxDelinq?.has(`${st}|OWN|${String(lead.owner ?? "").toUpperCase().trim()}`)) {
    mot += 5;
    flags.push("vergi borçlusu listesiyle eşleşiyor — güçlü motivasyon");
  }
  score += Math.min(15, mot);

  // 5) KAPANIŞ RİSKİ ~−10 ─ POA/HOA
  const poa = detectPoa({ state: st, county: lead.county, region: lead.region, situs: lead.situs });
  if (poa) {
    if (poa.level === "strong") { score -= 8; flags.push(`POA/HOA: ${title(poa.name)} — aidat+devir kuralları kapanışı zorlaştırır`); }
    else { score -= 5; flags.push(`POA riski: bölge ${title(poa.name)} çevresi — parsel bazında aidat doğrulanmalı`); }
  }

  return { score: Math.max(0, Math.round(score * 10) / 10), flags, grade_cap: cap };
}

const CAP_ORDER = { F: 0, D: 1, C: 2, B: 3 };
function capMin(a, b) {
  if (!a) return b;
  if (!b) return a;
  return CAP_ORDER[a] <= CAP_ORDER[b] ? a : b;
}
function num(v) {
  const n = Number(v);
  return v == null || !Number.isFinite(n) ? null : n;
}
function title(s) {
  return String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
export function ownerClusterKey(owner, mailing) {
  return `${String(owner ?? "").toUpperCase().trim()}|${String(mailing ?? "").toUpperCase().trim()}`;
}

// ── Percentile eşikleri: skor dizisinden A+/A/B/C/D alt sınırlarını türet.
// scores SIRALANMAMIŞ gelebilir; kopyalanıp azalan sıralanır.
export function gradeThresholds(scores) {
  const s = Float64Array.from(scores).sort().reverse();
  if (!s.length) return null;
  const at = (q) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(s.length * q) - 1))];
  return { aPlus: at(0.01), a: at(0.05), b: at(0.2), c: at(0.5), d: at(0.8) };
}

// Skor + tavan → harf notu.
export function assignGrade(score, thresholds, cap = null) {
  if (cap === "F") return "F";
  let g;
  if (score >= thresholds.aPlus) g = "A+";
  else if (score >= thresholds.a) g = "A";
  else if (score >= thresholds.b) g = "B";
  else if (score >= thresholds.c) g = "C";
  else if (score >= thresholds.d) g = "D";
  else g = "F";
  if (cap && GRADES.indexOf(g) < GRADES.indexOf(cap)) g = cap;
  return g;
}
