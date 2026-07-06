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

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clean = (s: unknown): string => String(s ?? "").trim();

export function filterRows(rows: MohaveRow[], f: CampaignFilter): { kept: MohaveRow[]; skippedNoAddress: number; skippedGovOwner: number } {
  const kept: MohaveRow[] = [];
  let skipped = 0;
  let skippedGov = 0;
  for (const r of rows) {
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
        parcelCount: 0, apns: [], totalAcres: 0, totalOffer: 0, regions: [],
      };
      map.set(key, g);
    }
    g.parcelCount++;
    if (clean(r.apn)) g.apns.push(clean(r.apn));
    g.totalAcres += num(r.acres);
    g.totalOffer += num(r.est_offer);
    const reg = clean(r.region);
    if (reg && !g.regions.includes(reg)) g.regions.push(reg);
  }
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

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Lob-uyumlu adres kolonları + admin merge alanları. Excel'de de direkt açılır. */
export function campaignToCsv(letters: CampaignLetter[]): string {
  const header = [
    "recipient_name", "address_line1", "address_city", "address_state", "address_zip",
    "parcel_count", "total_acres", "offer_total_usd", "regions", "apns",
  ];
  const lines = [header.join(",")];
  for (const l of letters) {
    lines.push([
      csvCell(l.owner), csvCell(l.address), csvCell(l.city), csvCell(l.state), csvCell(l.zip),
      l.parcelCount, l.totalAcres.toFixed(2), Math.round(l.totalOffer),
      csvCell(l.regions.join("; ")), csvCell(l.apns.join("; ")),
    ].join(","));
  }
  return lines.join("\n") + "\n";
}
