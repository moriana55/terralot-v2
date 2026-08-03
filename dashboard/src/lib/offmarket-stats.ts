// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET SAYILARI — TEK GERÇEK KAYNAK (tek dosya).
// Canlı sayılar HER ZAMAN /api/admin/offmarket-breakdown'dan (Supabase
// offmarket_leads head-count) gelir. Buradaki FALLBACK değerleri yalnızca API
// cevabı gelene kadar / başarısız olursa gösterilir ve SADECE bu dosyada
// tanımlıdır — başka hiçbir sayfada hardcoded lead sayısı OLMAMALIDIR.
// Güncelleme: scraper export sonrası buradaki fallback'i canlı ile eşitle.
// Son doğrulama: 2026-08-01 (canlı offmarket_leads ile birebir — toplam 921.271;
// 3. dalga MT/WY/ID/KS/NE/SD/MS/AL/KY/WV eklendi → HEDEF-25-EYALET.md ile 25/25 hizalı).
// ─────────────────────────────────────────────────────────────────────────────

export const OFFMARKET_STATES = [
  // 1.–2. dalga (ilk 15)
  "AZ", "NM", "CO", "TX", "FL", "AR", "NC", "TN", "GA", "OK", "NV", "OR", "MO", "MI", "SC",
  // 3. dalga — HEDEF-25-EYALET.md'deki taksit-dostu 10 yeni eyalet
  "MT", "WY", "ID", "KS", "NE", "SD", "MS", "AL", "KY", "WV",
] as const;
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
  NM: { code: "NM", label: "New Mexico",     region: "Valencia + Luna",                           color: "#2563eb", bounds: [-109.1, 31.3, -103.0, 37.0], lat: 34.55, lng: -106.75, href: "/admin/luna", fallbackCount: 139683 },
  CO: { code: "CO", label: "Colorado",       region: "Costilla + Las Animas",                     color: "#dc2626", bounds: [-109.1, 36.99, -102.0, 41.0], lat: 37.28, lng: -104.6, fallbackCount: 40193 },
  TX: { code: "TX", label: "Texas",          region: "Trans-Pecos + statewide",                   color: "#d97706", bounds: [-106.7, 25.8, -93.5, 36.5],  lat: 31.3,  lng: -99.5,  fallbackCount: 200613 },
  FL: { code: "FL", label: "Florida",        region: "Charlotte + Highlands + statewide",         color: "#7c3aed", bounds: [-87.6, 24.5, -80.0, 31.0],   lat: 28.0,  lng: -81.6,  fallbackCount: 84360 },
  AR: { code: "AR", label: "Arkansas",       region: "Sharp + Izard + Van Buren",                 color: "#0891b2", bounds: [-94.6, 33.0, -89.6, 36.5],   lat: 35.9,  lng: -91.9,  fallbackCount: 71585 },
  NC: { code: "NC", label: "North Carolina", region: "Brunswick + Rutherford + Northampton",      color: "#be185d", bounds: [-84.3, 33.8, -75.4, 36.6],   lat: 35.3,  lng: -79.2,  fallbackCount: 64499 },
  TN: { code: "TN", label: "Tennessee",      region: "Cumberland Plateau",                        color: "#ea580c", bounds: [-90.3, 34.98, -81.65, 36.68], lat: 35.9, lng: -85.4,  fallbackCount: 3666 },
  GA: { code: "GA", label: "Georgia",        region: "Clayton + statewide",                       color: "#65a30d", bounds: [-85.6, 30.36, -80.8, 35.0],  lat: 32.65, lng: -83.45, fallbackCount: 16781 },
  OK: { code: "OK", label: "Oklahoma",       region: "Statewide kırsal",                          color: "#4f46e5", bounds: [-103.0, 33.62, -94.43, 37.0], lat: 35.5, lng: -97.5,  fallbackCount: 345 },
  NV: { code: "NV", label: "Nevada",         region: "Nye (Pahrump/Calvada)",                     color: "#a21caf", bounds: [-120.0, 35.0, -114.04, 42.0], lat: 37.0, lng: -116.5, fallbackCount: 52097 },
  OR: { code: "OR", label: "Oregon",         region: "Klamath + Lake (Christmas Valley)",         color: "#166534", bounds: [-124.57, 41.99, -116.46, 46.29], lat: 42.9, lng: -121.0, fallbackCount: 44246 },
  MO: { code: "MO", label: "Missouri",       region: "Camden (Lake of the Ozarks)",               color: "#92400e", bounds: [-95.77, 35.99, -89.1, 40.61],  lat: 38.03, lng: -92.77, fallbackCount: 10353 },
  // MI: UP county'leri kapalı sistem (BS&A/FetchGIS) — veri alt Michigan'ın göl/rekreasyon
  // kuşağından: Roscommon County resmi GIS (GeoParcelMaster AGOL), Houghton Lake lot pazarı.
  MI: { code: "MI", label: "Michigan",       region: "Roscommon (Houghton Lake)",                 color: "#0f766e", bounds: [-90.42, 41.69, -82.41, 48.31], lat: 44.34, lng: -84.6, fallbackCount: 6431 },
  SC: { code: "SC", label: "South Carolina", region: "Colleton (Lowcountry/ACE Basin)",           color: "#9f1239", bounds: [-83.36, 32.03, -78.54, 35.22], lat: 32.9, lng: -80.67, fallbackCount: 11958 },

  // ── 3. dalga — HEDEF-25-EYALET.md'deki taksit-dostu 10 yeni eyalet ─────────
  // Bölge etiketleri offmarket_leads'teki gerçek county kırılımından (2026-08-01).
  MT: { code: "MT", label: "Montana",        region: "Blaine + Phillips + Garfield + Hill",       color: "#0369a1", bounds: [-116.05, 44.36, -104.04, 49.0], lat: 47.0, lng: -109.6, fallbackCount: 23725 },
  WY: { code: "WY", label: "Wyoming",        region: "Lincoln + Fremont + Carbon",                color: "#7e22ce", bounds: [-111.06, 40.99, -104.05, 45.01], lat: 43.0, lng: -107.55, fallbackCount: 7120 },
  ID: { code: "ID", label: "Idaho",          region: "Elmore + Cassia + Owyhee + Lemhi",          color: "#b45309", bounds: [-117.24, 41.99, -111.04, 49.0], lat: 44.4, lng: -114.6, fallbackCount: 14642 },
  KS: { code: "KS", label: "Kansas",         region: "Douglas",                                   color: "#15803d", bounds: [-102.05, 36.99, -94.59, 40.0], lat: 38.5, lng: -98.3,  fallbackCount: 20978 },
  NE: { code: "NE", label: "Nebraska",       region: "Cass",                                      color: "#a16207", bounds: [-104.05, 39.99, -95.31, 43.0], lat: 41.5, lng: -99.7,  fallbackCount: 757 },
  SD: { code: "SD", label: "South Dakota",   region: "Pennington (Black Hills)",                  color: "#0e7490", bounds: [-104.06, 42.48, -96.44, 45.95], lat: 44.4, lng: -100.2, fallbackCount: 3731 },
  MS: { code: "MS", label: "Mississippi",    region: "Amite + Kemper + Wilkinson + Jefferson",    color: "#c2410c", bounds: [-91.66, 30.17, -88.1, 35.0],  lat: 32.7, lng: -89.7,  fallbackCount: 25401 },
  AL: { code: "AL", label: "Alabama",        region: "DeKalb + Talladega + Cullman + Greene",     color: "#b91c1c", bounds: [-88.47, 30.14, -84.89, 35.01], lat: 32.8, lng: -86.8,  fallbackCount: 46661 },
  KY: { code: "KY", label: "Kentucky",       region: "Pulaski + Campbell",                        color: "#6d28d9", bounds: [-89.57, 36.5, -81.96, 39.15],  lat: 37.8, lng: -85.8,  fallbackCount: 5394 },
  WV: { code: "WV", label: "West Virginia",  region: "Wirt + Clay + Calhoun + Webster",           color: "#047857", bounds: [-82.65, 37.2, -77.72, 40.64],  lat: 38.6, lng: -80.6,  fallbackCount: 5273 },
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
// (kuzey sınırı 49.1: MT/ID Kanada sınırına kadar uzanıyor.)
export const OFFMARKET_OVERVIEW_BOUNDS: [number, number, number, number] = [-124.7, 24.0, -74.5, 49.1];

export const OFFMARKET_STATE_COLORS: Record<string, string> = Object.fromEntries(
  OFFMARKET_STATES.map((s) => [s, OFFMARKET_STATE_META[s].color])
);
