import { rankByOffmarketScore } from "./mohave-score";
import { isCorporateOrWhaleOwner } from "./whale-owners";

// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE MEKTUP KAMPANYASI — saf segmentasyon + sahip-dedupe + CSV motoru.
//
// Girdi: mohave-offmarket.json satırları (20K gerçek parsel, sahip + POSTA adresi).
// Çıktı: "mektup" listesi — aynı sahip + aynı posta adresi TEK mektup alır
// (bir sahibin 30 parseli varsa 30 mektup değil 1 portföy teklifi mektubu).
// Posta adresi/zip eksik satırlar dürüstçe atlanır ve sayılır (Lob'da zaten
// başarısız olurdu — sessizce çöpe gitmesin, raporda görünsün).
//
// Saf + bağımlılıksız: node --test ile JSON/Supabase çekmeden doğrulanır.
// ─────────────────────────────────────────────────────────────────────────────

export interface MohaveRow {
  apn: string;
  owner: string;
  mailing_address: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip: string;
  situs?: string;
  use?: string;
  acres: number | null;
  land_value?: number | null;
  region: string;
  est_offer?: number | null;
  score?: number | null;
  /** 0-100 runtime skor (mohave-score.ts). DB'ye yazılmaz, "En İyi 750" reçetesi için hesaplanır. */
  offmarket_score?: number | null;
}

export interface CampaignFilter {
  /** Bölge tam adı (boş = hepsi). */
  region?: string;
  minAcres?: number;
  maxAcres?: number;
  /** County land value üst sınırı (ucuz lot hedefi). */
  maxLandValue?: number;
  minScore?: number;
  /** absentee = sahip AZ dışında; instate = AZ içinde. */
  ownerScope?: "all" | "absentee" | "instate";
  /** Sahip başına min parsel (2 = yalnız çok-parselli toptan hedefler). */
  minParcels?: number;
  /** ⭐ Haritadan elle seçilen APN listesi (varsa) — diğer filtreler yine uygulanır
   * (adres hijyeni + kamu-sahip vb.) ama sadece bu APN'ler havuza girer. */
  apns?: string[];
}

export interface CampaignLetter {
  owner: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  parcelCount: number;
  apns: string[];
  totalAcres: number;
  /** İç blind-offer toplamı (est_offer). SADECE admin — müşteri yüzeyine sızmaz. */
  totalOffer: number;
  regions: string[];
  /** Gruptaki parsellerin offmarket_score ortalaması (mohave-score.ts). Skor hesaplanmadıysa 0. */
  avgScore: number;
}

export interface CampaignResult {
  letters: CampaignLetter[];
  parcels: number;
  totalAcres: number;
  totalOffer: number;
  /** Posta adresi/zip/sahip eksik olduğu için atlanan satırlar. */
  skippedNoAddress: number;
  /** Devlet/kamu sahipli olduğu için atlanan satırlar (federal arazi satın alınamaz). */
  skippedGovOwner: number;
}

// Kamu/devlet sahipleri: mektup hedefi DEĞİL (federal/eyalet/county arazisi satılık değil).
const GOV_OWNER_RE =
  /\b(UNITED STATES|STATE OF|COUNTY OF|MOHAVE COUNTY|CITY OF|TOWN OF|BUREAU OF LAND|SCHOOL DISTRICT|INDIAN TRIBE|TRIBAL)\b/;
export const isGovOwner = (owner: unknown): boolean => GOV_OWNER_RE.test(String(owner ?? "").toUpperCase());

// ─── 🗺️ Harita köprüsü: sessionStorage'a yazılan APN listesi → segment filtresi ──
// Harita kokpitinde tıkla-seçilen parseller /admin/mohave/kampanya?from=map'e
// sessionStorage üzerinden taşınır (sayfa yenilense de kaybolmasın diye). Bu
// fonksiyon o ham id listesini (sessionStorage'dan okunan JSON dizi) doğrudan
// buildCampaign'in anladığı CampaignFilter'a çevirir — saf, testlenebilir.
export function buildFilterFromApns(apns: string[]): CampaignFilter {
  return { apns: apns.map((a) => clean(a)).filter(Boolean) };
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clean = (s: unknown): string => String(s ?? "").trim();

export function filterRows(rows: MohaveRow[], f: CampaignFilter): { kept: MohaveRow[]; skippedNoAddress: number; skippedGovOwner: number } {
  const kept: MohaveRow[] = [];
  let skipped = 0;
  let skippedGov = 0;
  // Haritadan seçim varsa hızlı üyelik testi için bir kez Set'e çevir.
  const apnSet = f.apns && f.apns.length ? new Set(f.apns.map((a) => clean(a).toUpperCase())) : null;
  for (const r of rows) {
    if (apnSet && !apnSet.has(clean(r.apn).toUpperCase())) continue;
    // Adres hijyeni ÖNCE: mektup atılamayacak satır segmente hiç girmesin.
    if (!clean(r.owner) || !clean(r.mailing_address) || !clean(r.mailing_zip)) { skipped++; continue; }
    if (isGovOwner(r.owner)) { skippedGov++; continue; }
    if (f.region && clean(r.region) !== f.region) continue;
    const acres = num(r.acres);
    if (f.minAcres != null && acres < f.minAcres) continue;
    if (f.maxAcres != null && acres > f.maxAcres) continue;
    if (f.maxLandValue != null && num(r.land_value) > f.maxLandValue) continue;
    if (f.minScore != null && num(r.score) < f.minScore) continue;
    if (f.ownerScope === "absentee" && clean(r.mailing_state).toUpperCase() === "AZ") continue;
    if (f.ownerScope === "instate" && clean(r.mailing_state).toUpperCase() !== "AZ") continue;
    kept.push(r);
  }
  return { kept, skippedNoAddress: skipped, skippedGovOwner: skippedGov };
}

/** Sahip + posta adresi anahtarıyla dedupe → mektup listesi. */
export function buildCampaign(rows: MohaveRow[], f: CampaignFilter = {}): CampaignResult {
  const { kept, skippedNoAddress, skippedGovOwner } = filterRows(rows, f);
  const map = new Map<string, CampaignLetter>();
  for (const r of kept) {
    const key = [clean(r.owner), clean(r.mailing_address), clean(r.mailing_city), clean(r.mailing_state), clean(r.mailing_zip)]
      .join("|").toUpperCase();
    let g = map.get(key);
    if (!g) {
      g = {
        owner: clean(r.owner), address: clean(r.mailing_address), city: clean(r.mailing_city),
        state: clean(r.mailing_state), zip: clean(r.mailing_zip),
        parcelCount: 0, apns: [], totalAcres: 0, totalOffer: 0, regions: [], avgScore: 0,
      };
      map.set(key, g);
    }
    g.parcelCount++;
    if (clean(r.apn)) g.apns.push(clean(r.apn));
    g.totalAcres += num(r.acres);
    g.totalOffer += num(r.est_offer);
    // avgScore'u kümülatif toplamda tut, döngü bitince parcelCount'a böl (aşağıda).
    g.avgScore += num(r.offmarket_score);
    const reg = clean(r.region);
    if (reg && !g.regions.includes(reg)) g.regions.push(reg);
  }
  for (const g of map.values()) g.avgScore = g.parcelCount > 0 ? Math.round((g.avgScore / g.parcelCount) * 10) / 10 : 0;
  let letters = [...map.values()];
  if (f.minParcels != null && f.minParcels > 1) letters = letters.filter((l) => l.parcelCount >= f.minParcels!);
  // En değerli hedef üstte: çok parsel → çok acre.
  letters.sort((a, b) => b.parcelCount - a.parcelCount || b.totalAcres - a.totalAcres);
  return {
    letters,
    parcels: letters.reduce((a, l) => a + l.parcelCount, 0),
    totalAcres: letters.reduce((a, l) => a + l.totalAcres, 0),
    totalOffer: letters.reduce((a, l) => a + l.totalOffer, 0),
    skippedNoAddress,
    skippedGovOwner,
  };
}

// ─── Tekrar-mektup koruması: sahip+adres → deterministik owner_key ───────────
// FNV-1a 32-bit: bağımlılıksız, hızlı, log tablosunda kısa bir anahtar yeter
// (çakışma riski 20K ölçekte ihmal edilebilir; anahtar yine normalize metinle
// birlikte üretildiği için insan gözüyle de doğrulanabilir).
const normKey = (l: Pick<CampaignLetter, "owner" | "address" | "city" | "state" | "zip">): string =>
  [l.owner, l.address, l.city, l.state, l.zip].map((s) => clean(s).toUpperCase().replace(/\s+/g, " ")).join("|");

export function ownerKey(l: Pick<CampaignLetter, "owner" | "address" | "city" | "state" | "zip">): string {
  const s = normKey(l);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + "-" + s.length.toString(36);
}

/** Daha önce mektup atılan sahipleri (owner_key seti) listeden düşer. */
export function excludeMailed(
  letters: CampaignLetter[],
  mailedKeys: ReadonlySet<string>
): { kept: CampaignLetter[]; excluded: number } {
  if (mailedKeys.size === 0) return { kept: letters, excluded: 0 };
  const kept = letters.filter((l) => !mailedKeys.has(ownerKey(l)));
  return { kept, excluded: letters.length - kept.length };
}

// ─── Mektup gövdesi (portföy teklifi) ────────────────────────────────────────
// DİKKAT: est_offer / spread ASLA mektuba girmez — fiyat konuşması telefonda
// başlar. Gövde: sahip adı, APN listesi (uzunsa kısaltılır), toplam acre, iletişim.
export interface LetterContact {
  company: string;
  phone?: string;
  email?: string;
}

const MAX_APNS_IN_LETTER = 12;

export function buildLetterBody(l: CampaignLetter, c: LetterContact): string {
  const apns =
    l.apns.length <= MAX_APNS_IN_LETTER
      ? l.apns.join(", ")
      : `${l.apns.slice(0, MAX_APNS_IN_LETTER).join(", ")} (+${l.apns.length - MAX_APNS_IN_LETTER} more)`;
  const parcelWord = l.parcelCount === 1 ? "parcel" : "parcels";
  const contactLines = [c.phone && `Phone: ${c.phone}`, c.email && `Email: ${c.email}`].filter(Boolean).join("\n");
  return [
    `Dear ${l.owner},`,
    ``,
    `We are a land investment company actively buying vacant land in Mohave County, Arizona, and county records show you own ${l.parcelCount} ${parcelWord} there (approx. ${l.totalAcres.toFixed(1)} acres total):`,
    ``,
    `APN${l.apns.length > 1 ? "s" : ""}: ${apns}`,
    ``,
    `We would like to make you a cash offer for ${l.parcelCount > 1 ? "your entire portfolio or any individual parcel" : "your parcel"}. We buy as-is, cover all closing costs, and can typically close within 30 days — no fees, no commissions, no obligation.`,
    ``,
    `If you have ever considered selling, this is a simple way to do it. Call or email us and we will present a written offer within 48 hours.`,
    ``,
    `Sincerely,`,
    c.company,
    contactLines,
  ].filter((line) => line !== undefined).join("\n");
}

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Lob-uyumlu adres kolonları + admin merge alanları. Excel'de de direkt açılır. */
export function campaignToCsv(letters: CampaignLetter[]): string {
  const header = [
    "recipient_name", "address_line1", "address_city", "address_state", "address_zip",
    "parcel_count", "total_acres", "offer_total_usd", "regions", "apns", "avg_offmarket_score",
  ];
  const lines = [header.join(",")];
  for (const l of letters) {
    lines.push([
      csvCell(l.owner), csvCell(l.address), csvCell(l.city), csvCell(l.state), csvCell(l.zip),
      l.parcelCount, l.totalAcres.toFixed(2), Math.round(l.totalOffer),
      csvCell(l.regions.join("; ")), csvCell(l.apns.join("; ")), l.avgScore,
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

// ─── ⭐ Hazır reçete #4: "En İyi 750" ────────────────────────────────────────
// mohave-score.ts ile TÜM havuza 0-100 offmarket_score hesaplanır, skora göre
// azalan sıralanır, ilk N (varsayılan 750) parsel seçilir — SONRA aynı
// adres-hijyeni + kamu-sahip filtresi + sahip-dedupe uygulanır. Yani "750 parsel"
// her zaman 750 mektup ETMEZ (aynı sahibin birden çok parseli veya posta adresi
// eksik satırlar varsa mektup sayısı düşer) — bu düşüş raporda görünür kalır.
export interface Top750Result extends CampaignResult {
  /** İstenen üst sınır (varsayılan 750). */
  requestedTopN: number;
  /** Sıralamadan sonra fiilen seçilen parsel sayısı (havuz N'den küçükse hepsi). */
  consideredParcels: number;
  /** Seçilen top-N parselin offmarket_score ortalaması (dedupe ÖNCESİ). */
  avgScore: number;
  /** Seçilen top-N içindeki bölge dağılımı (dedupe ÖNCESİ, parsel bazlı). */
  regionBreakdown: Record<string, number>;
}

/**
 * Top-750 seçimine GİREBİLECEK satırlar: kamu sahipli ve kurumsal/balina sahipli
 * parseller mektup hedefi değildir (boşa posta). Harita katmanı ile kampanya
 * motoru aynı havuzu kullansın diye tek yerden döner.
 */
export function selectTop750EligibleRows(rows: MohaveRow[]): MohaveRow[] {
  return rows.filter(
    (r) => !isGovOwner(r.owner) && !isCorporateOrWhaleOwner(r.owner, r.mailing_address),
  );
}

export function buildTop750Campaign(rows: MohaveRow[], n = 750): Top750Result {
  const sorted = rankByOffmarketScore(selectTop750EligibleRows(rows));
  const top = sorted.slice(0, Math.max(0, n));
  const campaign = buildCampaign(top, {});
  const avgScore = top.length ? top.reduce((a, r) => a + r.offmarket_score, 0) / top.length : 0;
  const regionBreakdown: Record<string, number> = {};
  for (const r of top) {
    const reg = clean(r.region) || "(bilinmiyor)";
    regionBreakdown[reg] = (regionBreakdown[reg] ?? 0) + 1;
  }
  return {
    ...campaign,
    requestedTopN: n,
    consideredParcels: top.length,
    avgScore: Math.round(avgScore * 10) / 10,
    regionBreakdown,
  };
}
