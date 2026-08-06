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
  // 4. dalga - 2026-08-06 ulusal hasat (eyalet geneli + county kaynaklari)
  "WI", "NY", "MA", "CT", "OH", "ND", "VT", "IA", "VA", "IL", "CA", "ME", "HI", "MD", "LA", "IN", "MN", "PA", "WA", "NJ", "UT", "DE", "AK",
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

  // 4. dalga (2026-08-06) - sinir kutusu ve merkez Census TIGERweb kaynakli
  WI: { code: "WI", label: "Wisconsin", region: "ulusal hasat", color: "#059669", bounds: [-92.889, 42.492, -86.25, 47.31], lat: 44.6273, lng: -89.7098, fallbackCount: 1124060 },
  NY: { code: "NY", label: "New York", region: "ulusal hasat", color: "#2563eb", bounds: [-79.763, 40.477, -71.777, 45.016], lat: 42.9196, lng: -75.5941, fallbackCount: 979492 },
  MA: { code: "MA", label: "Massachusetts", region: "ulusal hasat", color: "#dc2626", bounds: [-73.508, 41.187, -69.859, 42.887], lat: 42.1618, lng: -71.4975, fallbackCount: 310266 },
  CT: { code: "CT", label: "Connecticut", region: "ulusal hasat", color: "#d97706", bounds: [-73.728, 40.951, -71.787, 42.051], lat: 41.5751, lng: -72.7393, fallbackCount: 143510 },
  OH: { code: "OH", label: "Ohio", region: "ulusal hasat", color: "#7c3aed", bounds: [-84.82, 38.403, -80.519, 42.327], lat: 40.4097, lng: -82.7169, fallbackCount: 95989 },
  ND: { code: "ND", label: "North Dakota", region: "ulusal hasat", color: "#0891b2", bounds: [-104.049, 45.935, -96.554, 49.001], lat: 47.4505, lng: -100.4661, fallbackCount: 75571 },
  VT: { code: "VT", label: "Vermont", region: "ulusal hasat", color: "#be185d", bounds: [-73.438, 42.727, -71.465, 45.017], lat: 44.0693, lng: -72.6661, fallbackCount: 58539 },
  IA: { code: "IA", label: "Iowa", region: "ulusal hasat", color: "#ea580c", bounds: [-96.639, 40.375, -90.14, 43.501], lat: 42.0754, lng: -93.4959, fallbackCount: 48410 },
  VA: { code: "VA", label: "Virginia", region: "ulusal hasat", color: "#0f766e", bounds: [-83.675, 36.541, -75.166, 39.466], lat: 37.5183, lng: -78.6759, fallbackCount: 45233 },
  IL: { code: "IL", label: "Illinois", region: "ulusal hasat", color: "#4338ca", bounds: [-91.513, 36.97, -87.02, 42.508], lat: 40.1006, lng: -89.1501, fallbackCount: 43446 },
  CA: { code: "CA", label: "California", region: "ulusal hasat", color: "#b91c1c", bounds: [-124.482, 32.53, -114.131, 42.01], lat: 37.1548, lng: -119.5278, fallbackCount: 42356 },
  ME: { code: "ME", label: "Maine", region: "ulusal hasat", color: "#a16207", bounds: [-71.084, 42.917, -66.885, 47.46], lat: 45.2611, lng: -69.2137, fallbackCount: 40926 },
  HI: { code: "HI", label: "Hawaii", region: "ulusal hasat", color: "#059669", bounds: [-178.444, 18.865, -154.756, 28.517], lat: 21.0509, lng: -157.9937, fallbackCount: 40181 },
  MD: { code: "MD", label: "Maryland", region: "ulusal hasat", color: "#2563eb", bounds: [-79.488, 37.887, -74.986, 39.723], lat: 38.9464, lng: -76.679, fallbackCount: 30707 },
  LA: { code: "LA", label: "Louisiana", region: "ulusal hasat", color: "#dc2626", bounds: [-94.043, 28.855, -88.758, 33.02], lat: 30.9026, lng: -91.7982, fallbackCount: 27175 },
  IN: { code: "IN", label: "Indiana", region: "ulusal hasat", color: "#d97706", bounds: [-88.098, 37.772, -84.785, 41.761], lat: 39.9059, lng: -86.2873, fallbackCount: 25313 },
  MN: { code: "MN", label: "Minnesota", region: "ulusal hasat", color: "#7c3aed", bounds: [-97.239, 43.499, -89.483, 49.384], lat: 46.3167, lng: -94.1982, fallbackCount: 20156 },
  PA: { code: "PA", label: "Pennsylvania", region: "ulusal hasat", color: "#0891b2", bounds: [-80.52, 39.72, -74.69, 42.516], lat: 40.9011, lng: -77.8369, fallbackCount: 15550 },
  WA: { code: "WA", label: "Washington", region: "ulusal hasat", color: "#be185d", bounds: [-124.849, 45.544, -116.916, 49.002], lat: 47.4149, lng: -120.5955, fallbackCount: 14671 },
  NJ: { code: "NJ", label: "New Jersey", region: "ulusal hasat", color: "#ea580c", bounds: [-75.564, 38.789, -73.885, 41.358], lat: 40.1049, lng: -74.6584, fallbackCount: 4749 },
  UT: { code: "UT", label: "Utah", region: "ulusal hasat", color: "#0f766e", bounds: [-114.053, 36.998, -109.042, 42.002], lat: 39.3063, lng: -111.6703, fallbackCount: 631 },
  DE: { code: "DE", label: "Delaware", region: "ulusal hasat", color: "#4338ca", bounds: [-75.789, 38.451, -74.984, 39.84], lat: 38.9933, lng: -75.4514, fallbackCount: 263 },
  AK: { code: "AK", label: "Alaska", region: "ulusal hasat", color: "#b91c1c", bounds: [-179.231, 51.175, 179.86, 71.44], lat: 63.4136, lng: -152.8789, fallbackCount: 31 },
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
