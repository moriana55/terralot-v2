export type MarketStatus = "active" | "pilot" | "research" | "watch" | "blocked";
export type Readiness = "ready" | "partial" | "missing";

export interface MarketDefinition {
  id: string;
  name: string;
  state: string;
  stateCode: string;
  counties: string[];
  regions: string[];
  status: MarketStatus;
  source: string;
  sourceRows: number;
  updatedAt: string | null;
  inventoryHref?: string;
  campaignHref?: string;
  readiness: {
    parcelData: Readiness;
    ownerMailing: Readiness;
    countyVerification: Readiness;
    legalReview: Readiness;
    closingPartner: Readiness;
    campaign: Readiness;
  };
  nextAction: string;
}

export interface MarketSnapshots {
  mohave: { count: number; source: string; generatedAt: string | null };
  luna: { count: number; source: string; generatedAt: string | null };
  colorado: { count: number; source: string; generatedAt: string | null };
}

export function buildMarketRegistry(snapshots: MarketSnapshots): readonly MarketDefinition[] {
  return [
  {
    id: "az-mohave",
    name: "Mohave County",
    state: "Arizona",
    stateCode: "AZ",
    counties: ["Mohave"],
    regions: ["Meadview", "Golden Valley", "Dolan Springs", "Yucca"],
    status: "active",
    source: snapshots.mohave.source,
    sourceRows: snapshots.mohave.count,
    updatedAt: snapshots.mohave.generatedAt,
    inventoryHref: "/admin/mohave",
    campaignHref: "/admin/mohave/kampanya",
    readiness: {
      parcelData: "ready",
      ownerMailing: "ready",
      countyVerification: "partial",
      legalReview: "partial",
      closingPartner: "missing",
      campaign: "ready",
    },
    nextAction: "İlk 50–100 hedefi county kaydıyla doğrula; title/closing partnerini ekle.",
  },
  {
    id: "nm-luna",
    name: "Luna County",
    state: "New Mexico",
    stateCode: "NM",
    counties: ["Luna"],
    regions: ["Deming"],
    status: "pilot",
    source: snapshots.luna.source,
    sourceRows: snapshots.luna.count,
    updatedAt: snapshots.luna.generatedAt,
    inventoryHref: "/admin/all-deals?q=LUNA",
    readiness: {
      parcelData: "partial",
      ownerMailing: "partial",
      countyVerification: "missing",
      legalReview: "missing",
      closingPartner: "missing",
      campaign: "missing",
    },
    nextAction: "157 kaydı normalize et; 25 APN'yi Luna County kaydıyla örneklem doğrula.",
  },
  {
    id: "nv-nye",
    name: "Nye County",
    state: "Nevada",
    stateCode: "NV",
    counties: ["Nye"],
    regions: ["Pahrump", "Amargosa Valley"],
    status: "research",
    source: "Veri kaynağı seçilmedi",
    sourceRows: 0,
    updatedAt: null,
    readiness: {
      parcelData: "missing",
      ownerMailing: "missing",
      countyVerification: "missing",
      legalReview: "missing",
      closingPartner: "missing",
      campaign: "missing",
    },
    nextAction: "County assessor/parsel erişimini doğrula; önce 100 satırlık veri örneği çıkar.",
  },
  {
    id: "ut-southwest",
    name: "Southwest Utah",
    state: "Utah",
    stateCode: "UT",
    counties: ["Washington", "Iron"],
    regions: ["St. George çevresi", "Cedar City çevresi"],
    status: "watch",
    source: "Ulusal radar bekleniyor",
    sourceRows: 0,
    updatedAt: null,
    readiness: {
      parcelData: "missing",
      ownerMailing: "missing",
      countyVerification: "missing",
      legalReview: "missing",
      closingPartner: "missing",
      campaign: "missing",
    },
    nextAction: "County likiditesi ve ucuz boş arsa hacmini ulusal radarda karşılaştır.",
  },
  {
    id: "ca-desert",
    name: "California Desert",
    state: "California",
    stateCode: "CA",
    counties: ["San Bernardino", "Riverside"],
    regions: ["High Desert", "Coachella çevresi"],
    status: "watch",
    source: "Ulusal radar bekleniyor",
    sourceRows: 0,
    updatedAt: null,
    readiness: {
      parcelData: "missing",
      ownerMailing: "missing",
      countyVerification: "missing",
      legalReview: "missing",
      closingPartner: "missing",
      campaign: "missing",
    },
    nextAction: "Çevresel/buildability maliyetini ölçmeden kampanya açma; yalnız radar takibi yap.",
  },
  {
    id: "co-statewide",
    name: "Colorado",
    state: "Colorado",
    stateCode: "CO",
    counties: [],
    regions: [],
    status: "blocked",
    source: snapshots.colorado.source,
    sourceRows: snapshots.colorado.count,
    updatedAt: snapshots.colorado.generatedAt,
    readiness: {
      parcelData: "missing",
      ownerMailing: "missing",
      countyVerification: "missing",
      legalReview: "missing",
      closingPartner: "missing",
      campaign: "missing",
    },
    nextAction: "1031 tax-lien kaydı geldi ama posta adresi ve değer YOK → mektup atılamaz. Adres/skip-trace kaynağı eklenmeden market açılmaz.",
  },
  ] as const;
}

export const STATUS_LABELS: Record<MarketStatus, string> = {
  active: "Aktif",
  pilot: "Pilot",
  research: "Araştırma",
  watch: "İzleme",
  blocked: "Bloke",
};

export const READINESS_LABELS: Record<keyof MarketDefinition["readiness"], string> = {
  parcelData: "Parsel verisi",
  ownerMailing: "Malik & posta",
  countyVerification: "County doğrulama",
  legalReview: "Hukuki inceleme",
  closingPartner: "Title / closing",
  campaign: "Kampanya",
};
