// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET SAYILARI — TEK GERÇEK KAYNAK (tek dosya).
// Canlı sayılar HER ZAMAN /api/admin/offmarket-breakdown'dan (Supabase
// offmarket_leads head-count) gelir. Buradaki FALLBACK değerleri yalnızca API
// cevabı gelene kadar / başarısız olursa gösterilir ve SADECE bu dosyada
// tanımlıdır — başka hiçbir sayfada hardcoded lead sayısı OLMAMALIDIR.
// Güncelleme: scraper export sonrası buradaki fallback'i canlı ile eşitle.
// Son doğrulama: 2026-07-23 (canlı ile birebir — toplam 483.542).
// ─────────────────────────────────────────────────────────────────────────────

export const OFFMARKET_STATES = ["AZ", "NM", "CO", "TX", "FL", "AR", "NC", "TN", "GA", "OK", "NV", "OR", "MO"] as const;
export type OffmarketState = (typeof OFFMARKET_STATES)[number];

export type StateMeta = {
  code: OffmarketState;
  label: string;
  region: string;
  color: string;
  /** Harita "uç" hedefi: [batı, güney, doğu, kuzey] eyalet bbox'ı (coğrafi sabit). */
  bounds: [number, number, number, number];
  /** Fallback county-merkez pini için (yalnız cluster API çökerse). */
  lat: number;
  lng: number;
  /** İç envanter sayfası (varsa). */
  href?: string;
  /** API gelene kadar gösterilen fallback sayı — canlıyla en son eşitlenen değer. */
  fallbackCount: number;
};

export const OFFMARKET_STATE_META: Record<OffmarketState, StateMeta> = {
  AZ: { code: "AZ", label: "Arizona",        region: "Mohave",                                    color: "#059669", bounds: [-114.9, 31.3, -109.0, 37.0], lat: 35.2,  lng: -113.8, fallbackCount: 20000 },
  NM: { code: "NM", label: "New Mexico",     region: "Valencia + Luna",                           color: "#2563eb", bounds: [-109.1, 31.3, -103.0, 37.0], lat: 34.55, lng: -106.75, href: "/admin/luna", fallbackCount: 69162 },
  CO: { code: "CO", label: "Colorado",       region: "Costilla + Las Animas",                     color: "#dc2626", bounds: [-109.1, 36.99, -102.0, 41.0], lat: 37.28, lng: -104.6, fallbackCount: 33243 },
  TX: { code: "TX", label: "Texas",          region: "Trans-Pecos + statewide",                   color: "#d97706", bounds: [-106.7, 25.8, -93.5, 36.5],  lat: 31.3,  lng: -99.5,  fallbackCount: 153093 },
  FL: { code: "FL", label: "Florida",        region: "Charlotte + Highlands + statewide",         color: "#7c3aed", bounds: [-87.6, 24.5, -80.0, 31.0],   lat: 28.0,  lng: -81.6,  fallbackCount: 84044 },
  AR: { code: "AR", label: "Arkansas",       region: "Sharp + Izard + Van Buren",                 color: "#0891b2", bounds: [-94.6, 33.0, -89.6, 36.5],   lat: 35.9,  lng: -91.9,  fallbackCount: 71585 },
  NC: { code: "NC", label: "North Carolina", region: "Brunswick + Rutherford + Northampton",      color: "#be185d", bounds: [-84.3, 33.8, -75.4, 36.6],   lat: 35.3,  lng: -79.2,  fallbackCount: 38148 },
  TN: { code: "TN", label: "Tennessee",      region: "Cumberland Plateau",                        color: "#ea580c", bounds: [-90.3, 34.98, -81.65, 36.68], lat: 35.9, lng: -85.4,  fallbackCount: 3666 },
  GA: { code: "GA", label: "Georgia",        region: "Clayton + statewide",                       color: "#65a30d", bounds: [-85.6, 30.36, -80.8, 35.0],  lat: 32.65, lng: -83.45, fallbackCount: 10256 },
  OK: { code: "OK", label: "Oklahoma",       region: "Statewide kırsal",                          color: "#4f46e5", bounds: [-103.0, 33.62, -94.43, 37.0], lat: 35.5, lng: -97.5,  fallbackCount: 345 },
  NV: { code: "NV", label: "Nevada",         region: "Nye (Pahrump/Calvada)",                     color: "#a21caf", bounds: [-120.0, 35.0, -114.04, 42.0], lat: 37.0, lng: -116.5, fallbackCount: 30481 },
  OR: { code: "OR", label: "Oregon",         region: "Klamath + Lake (Christmas Valley)",         color: "#166534", bounds: [-124.57, 41.99, -116.46, 46.29], lat: 42.9, lng: -121.0, fallbackCount: 23264 },
  MO: { code: "MO", label: "Missouri",       region: "Camden (Lake of the Ozarks)",               color: "#92400e", bounds: [-95.77, 35.99, -89.1, 40.61],  lat: 38.03, lng: -92.77, fallbackCount: 10351 },
};

/** API gelene kadar kullanılan eyalet → sayı fallback haritası. */
export const OFFMARKET_FALLBACK_COUNTS: Record<string, number> = Object.fromEntries(
  OFFMARKET_STATES.map((s) => [s, OFFMARKET_STATE_META[s].fallbackCount])
);

/** Fallback toplam — ASLA elle yazma, eyaletlerden türetilir. */
export const OFFMARKET_FALLBACK_TOTAL = OFFMARKET_STATES.reduce(
  (sum, s) => sum + OFFMARKET_STATE_META[s].fallbackCount,
  0
);

/** Aktif eyaletlerin tamamını kapsayan genel bakış bbox'ı. */
export const OFFMARKET_OVERVIEW_BOUNDS: [number, number, number, number] = [-124.7, 24.0, -74.5, 48.4];

export const OFFMARKET_STATE_COLORS: Record<string, string> = Object.fromEntries(
  OFFMARKET_STATES.map((s) => [s, OFFMARKET_STATE_META[s].color])
);
