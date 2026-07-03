// ─────────────────────────────────────────────────────────────────────────────
// RAKİP RADAR — saf ilan yaşam döngüsü motoru (DB/network YOK, test edilebilir).
//
// Girdi: competitor_listings'ten gelen "şu anki" ilanlar + competitor_tracked'ten
// gelen izlenen durumlar. Çıktı: diff olayları (NEW / PRICE_CHANGED /
// STATUS_CHANGED / DISAPPEARED / REAPPEARED) + güncellenmiş tracked satırları.
//
// İki soruya veri ile cevap verir:
//   1) Rakip gerçekten SATIYOR mu? → kaybolan ilan = satış şüphesi → Regrid
//      malik kontrolü / Mohave Recorder ile doğrulama (rakip-radar/verify).
//   2) Geçmiş satış performansı? → doğrulanmış satış sayısı, satıştaki DOM,
//      $/acre, fiyat indirim davranışı (competitorStats).
// ─────────────────────────────────────────────────────────────────────────────

export type TrackedStatus =
  | "ACTIVE"
  | "PENDING"
  | "SUSPECTED_SOLD"
  | "SOLD_VERIFIED"
  | "WITHDRAWN";

export interface CompListing {
  key: string;
  competitor: string | null;
  title: string | null;
  apn: string | null;
  url: string | null;
  price: number | null;
  acres: number | null;
  state: string | null;
  county: string | null;
  /** Kaynaktan türetilen durum — başlıkta "pending/under contract" varsa PENDING. */
  status: "ACTIVE" | "PENDING";
}

export interface PricePoint {
  at: string; // ISO
  price: number | null;
}

export interface Verification {
  method: "regrid-owner" | "manual";
  owner?: string | null;
  ownerChanged?: boolean;
  checkedAt: string;
  note?: string;
}

export interface TrackedListing {
  listing_key: string;
  competitor: string | null;
  title: string | null;
  apn: string | null;
  url: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  first_seen: string;
  last_seen: string;
  initial_price: number | null;
  current_price: number | null;
  price_history: PricePoint[];
  price_cuts: number;
  status: TrackedStatus;
  disappeared_at: string | null;
  dom_days: number | null;
  sold_price: number | null;
  verification: Verification | null;
}

export type DiffEventType =
  | "NEW"
  | "PRICE_CHANGED"
  | "STATUS_CHANGED"
  | "DISAPPEARED"
  | "REAPPEARED";

export interface DiffEvent {
  type: DiffEventType;
  listing_key: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  /** PRICE_CHANGED için yeni − eski (negatif = indirim). */
  delta: number | null;
}

export interface DiffResult {
  events: DiffEvent[];
  /** Yazılacak/upsert edilecek tracked satırları (sadece değişenler + yeniler). */
  upserts: TrackedListing[];
}

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.max(0, Math.round((to.getTime() - from) / DAY_MS));
}

// ── Kimlik ───────────────────────────────────────────────────────────────────
// Kaynak upsert edilen bir tablo olduğundan Supabase row id'si stabil DEĞİL
// varsayılır; içerikten deterministik anahtar üretilir. Öncelik: gerçek APN >
// url > competitor+title+bölge.
export function isSyntheticApn(apn: string | null | undefined): boolean {
  if (!apn) return true;
  // Scraper bazı sitelerde "FL_Orange_00001" gibi uydurma APN üretir.
  return /^[A-Z]{2}_[A-Za-z .-]+_\d+$/.test(apn.trim());
}

export function listingKey(l: {
  competitor?: string | null;
  title?: string | null;
  apn?: string | null;
  url?: string | null;
  state?: string | null;
  county?: string | null;
}): string {
  const comp = (l.competitor || "?").trim().toLowerCase();
  const apn = l.apn?.trim();
  if (apn && !isSyntheticApn(apn)) return `${comp}|apn:${apn.toLowerCase()}`;
  const url = l.url?.trim();
  if (url) return `${comp}|url:${url.toLowerCase()}`;
  return `${comp}|t:${(l.title || "?").trim().toLowerCase()}|${(l.state || "").trim().toLowerCase()}|${(l.county || "").trim().toLowerCase()}`;
}

/** Başlık/notlardan PENDING türet (kaynak tabloda ayrı durum kolonu yok). */
export function deriveSourceStatus(title: string | null | undefined, notes?: string | null): "ACTIVE" | "PENDING" {
  const hay = `${title || ""} ${notes || ""}`;
  return /\bpending\b|under contract|sale pending/i.test(hay) ? "PENDING" : "ACTIVE";
}

// ── Diff motoru ──────────────────────────────────────────────────────────────
export function diffSnapshots(
  tracked: TrackedListing[],
  current: CompListing[],
  now: Date
): DiffResult {
  const nowIso = now.toISOString();
  const events: DiffEvent[] = [];
  const upserts = new Map<string, TrackedListing>();
  const byKey = new Map(tracked.map((t) => [t.listing_key, t]));
  const seen = new Set<string>();

  for (const c of current) {
    if (seen.has(c.key)) continue; // kaynak dupe'ları tek say
    seen.add(c.key);
    const t = byKey.get(c.key);

    if (!t) {
      // NEW — ilk kez görüldü
      const fresh: TrackedListing = {
        listing_key: c.key,
        competitor: c.competitor,
        title: c.title,
        apn: c.apn,
        url: c.url,
        state: c.state,
        county: c.county,
        acres: c.acres,
        first_seen: nowIso,
        last_seen: nowIso,
        initial_price: c.price,
        current_price: c.price,
        price_history: [{ at: nowIso, price: c.price }],
        price_cuts: 0,
        status: c.status,
        disappeared_at: null,
        dom_days: null,
        sold_price: null,
        verification: null,
      };
      upserts.set(c.key, fresh);
      events.push({
        type: "NEW",
        listing_key: c.key,
        old_value: null,
        new_value: { price: c.price, status: c.status },
        delta: null,
      });
      continue;
    }

    let changed = false;
    const next: TrackedListing = { ...t, price_history: [...t.price_history] };

    // REAPPEARED — kaybolmuş/kapatılmış ilan geri geldi (satış şüphesi düşer)
    if (t.disappeared_at || ["SUSPECTED_SOLD", "SOLD_VERIFIED", "WITHDRAWN"].includes(t.status)) {
      events.push({
        type: "REAPPEARED",
        listing_key: c.key,
        old_value: { status: t.status },
        new_value: { status: c.status },
        delta: null,
      });
      next.status = c.status;
      next.disappeared_at = null;
      next.dom_days = null;
      changed = true;
    } else if (t.status !== c.status) {
      // STATUS_CHANGED (ör. ACTIVE → PENDING)
      events.push({
        type: "STATUS_CHANGED",
        listing_key: c.key,
        old_value: { status: t.status },
        new_value: { status: c.status },
        delta: null,
      });
      next.status = c.status;
      changed = true;
    }

    // PRICE_CHANGED
    if (c.price != null && t.current_price != null && c.price !== t.current_price) {
      const delta = c.price - t.current_price;
      events.push({
        type: "PRICE_CHANGED",
        listing_key: c.key,
        old_value: { price: t.current_price },
        new_value: { price: c.price },
        delta,
      });
      next.current_price = c.price;
      next.price_history.push({ at: nowIso, price: c.price });
      if (delta < 0) next.price_cuts = t.price_cuts + 1;
      changed = true;
    } else if (c.price != null && t.current_price == null) {
      next.current_price = c.price;
      next.price_history.push({ at: nowIso, price: c.price });
      changed = true;
    }

    // last_seen her koşuda güncellenir
    next.last_seen = nowIso;
    if (changed || t.last_seen !== nowIso) upserts.set(c.key, next);
  }

  // DISAPPEARED — izlenen aktif/pending ilan bu koşuda yok
  for (const t of tracked) {
    if (seen.has(t.listing_key)) continue;
    if (t.status !== "ACTIVE" && t.status !== "PENDING") continue; // zaten kapalı
    const dom = daysBetween(t.first_seen, now);
    events.push({
      type: "DISAPPEARED",
      listing_key: t.listing_key,
      old_value: { status: t.status, price: t.current_price },
      new_value: { status: "SUSPECTED_SOLD", dom_days: dom },
      delta: null,
    });
    upserts.set(t.listing_key, {
      ...t,
      status: "SUSPECTED_SOLD",
      disappeared_at: nowIso,
      dom_days: dom,
    });
  }

  return { events, upserts: [...upserts.values()] };
}

// ── Toplulaştırma (UI kartları) ──────────────────────────────────────────────
export interface RadarSummary {
  activeCount: number;
  pendingCount: number;
  avgDomActive: number | null;
  lost30d: number; // son 30 günde kaybolan (satış şüphesi + doğrulanmışlar dahil)
  suspectedCount: number;
  verifiedSoldCount: number;
  withdrawnCount: number;
}

const isSold = (t: TrackedListing) => t.status === "SOLD_VERIFIED";

export function radarSummary(tracked: TrackedListing[], now: Date): RadarSummary {
  const active = tracked.filter((t) => t.status === "ACTIVE" || t.status === "PENDING");
  const doms = active.map((t) => daysBetween(t.first_seen, now));
  const lost30d = tracked.filter(
    (t) => t.disappeared_at && daysBetween(t.disappeared_at, now) <= 30
  ).length;
  return {
    activeCount: tracked.filter((t) => t.status === "ACTIVE").length,
    pendingCount: tracked.filter((t) => t.status === "PENDING").length,
    avgDomActive: doms.length ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length) : null,
    lost30d,
    suspectedCount: tracked.filter((t) => t.status === "SUSPECTED_SOLD").length,
    verifiedSoldCount: tracked.filter(isSold).length,
    withdrawnCount: tracked.filter((t) => t.status === "WITHDRAWN").length,
  };
}

export interface CompetitorPerf {
  competitor: string;
  total: number;
  active: number;
  suspected: number;
  verifiedSold: number;
  withdrawn: number;
  /** Doğrulanmış satışlarda kaybolma anındaki ortalama DOM (gün). */
  avgDomAtSale: number | null;
  /** Doğrulanmış satışların ortalama $/acre (satış fiyatı yoksa son liste fiyatı). */
  avgSoldPpa: number | null;
  /** En az 1 indirim yapmış ilan oranı (0-1). */
  cutShare: number;
  /** Ortalama toplam indirim yüzdesi (indirim yapanlarda, ilk → son fiyat). */
  avgCutPct: number | null;
}

export function competitorStats(tracked: TrackedListing[]): CompetitorPerf[] {
  const groups = new Map<string, TrackedListing[]>();
  for (const t of tracked) {
    const name = t.competitor || "Bilinmeyen";
    const g = groups.get(name) || [];
    g.push(t);
    groups.set(name, g);
  }
  const out: CompetitorPerf[] = [];
  for (const [competitor, items] of groups) {
    const sold = items.filter(isSold);
    const soldDoms = sold.map((t) => t.dom_days).filter((d): d is number => d != null);
    const soldPpas = sold
      .map((t) => {
        const price = t.sold_price ?? t.current_price;
        return price != null && t.acres && t.acres > 0 ? price / t.acres : null;
      })
      .filter((p): p is number => p != null);
    const cutters = items.filter((t) => t.price_cuts > 0);
    const cutPcts = cutters
      .map((t) =>
        t.initial_price && t.current_price != null && t.initial_price > 0
          ? ((t.initial_price - t.current_price) / t.initial_price) * 100
          : null
      )
      .filter((p): p is number => p != null && p > 0);
    out.push({
      competitor,
      total: items.length,
      active: items.filter((t) => t.status === "ACTIVE" || t.status === "PENDING").length,
      suspected: items.filter((t) => t.status === "SUSPECTED_SOLD").length,
      verifiedSold: sold.length,
      withdrawn: items.filter((t) => t.status === "WITHDRAWN").length,
      avgDomAtSale: soldDoms.length
        ? Math.round(soldDoms.reduce((a, b) => a + b, 0) / soldDoms.length)
        : null,
      avgSoldPpa: soldPpas.length
        ? Math.round(soldPpas.reduce((a, b) => a + b, 0) / soldPpas.length)
        : null,
      cutShare: items.length ? cutters.length / items.length : 0,
      avgCutPct: cutPcts.length ? Math.round((cutPcts.reduce((a, b) => a + b, 0) / cutPcts.length) * 10) / 10 : null,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

// ── Fiyat bandı histogramı: satılanlar vs çürüyenler ($/acre) ────────────────
export interface PpaBucket {
  label: string; // "$0–1k" gibi
  min: number;
  max: number; // Infinity son bucket
  sold: number;
  stale: number;
}

export const STALE_DOM_DAYS = 60;

export function ppaHistogram(tracked: TrackedListing[], now: Date): PpaBucket[] {
  const edges = [0, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, Infinity];
  const label = (a: number, b: number) =>
    b === Infinity ? `$${a / 1000}k+` : `$${a >= 1000 ? a / 1000 + "k" : a}–${b / 1000}k`;
  const buckets: PpaBucket[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    buckets.push({ label: label(edges[i], edges[i + 1]), min: edges[i], max: edges[i + 1], sold: 0, stale: 0 });
  }
  const put = (ppa: number, field: "sold" | "stale") => {
    const b = buckets.find((x) => ppa >= x.min && ppa < x.max);
    if (b) b[field]++;
  };
  for (const t of tracked) {
    const price = t.sold_price ?? t.current_price;
    if (price == null || !t.acres || t.acres <= 0) continue;
    const ppa = price / t.acres;
    if (isSold(t)) put(ppa, "sold");
    else if (
      (t.status === "ACTIVE" || t.status === "PENDING") &&
      daysBetween(t.first_seen, now) >= STALE_DOM_DAYS
    )
      put(ppa, "stale");
  }
  return buckets;
}

// ── Doğrulama linkleri ───────────────────────────────────────────────────────
export const STATE_ABBR: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms",
  missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
  "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok",
  oregon: "or", pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc",
  "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi", wyoming: "wy",
};

export function stateAbbr(state: string | null | undefined): string | null {
  if (!state) return null;
  const s = state.trim().toLowerCase();
  if (s.length === 2) return s;
  return STATE_ABBR[s] || null;
}

/** Regrid v2 APN sorgusu için path: /us/az/mohave gibi. */
export function regridPath(state: string | null, county: string | null): string | null {
  const st = stateAbbr(state);
  if (!st || !county) return null;
  const c = county.trim().toLowerCase().replace(/\s+county$/i, "").replace(/\s+/g, "-");
  return c ? `/us/${st}/${c}` : null;
}

// Mohave County Recorder = Tyler Eagle self-service (eaglerss.mohave.gov) —
// oturum tabanlı, grantor/grantee query'si URL ile taşınamıyor. Link + panoya
// kopyalanacak arama adımları veririz. AZ satışlarında ayrıca Affidavit of
// Property Value dosyalanır → Mohave Assessor "Affidavit of Value Search".
export const MOHAVE_RECORDER_URL = "https://eaglerss.mohave.gov/web/";
export const MOHAVE_AFFIDAVIT_URL =
  "https://www.mohave.gov/departments/assessor/affidavit-of-value-search/";

export function verificationLinks(t: {
  state: string | null;
  county: string | null;
  competitor: string | null;
  apn: string | null;
}): { label: string; url: string; note: string }[] {
  const links: { label: string; url: string; note: string }[] = [];
  const st = stateAbbr(t.state);
  const isMohave = st === "az" && /mohave/i.test(t.county || "");
  if (isMohave) {
    links.push({
      label: "Mohave Recorder (tapu)",
      url: MOHAVE_RECORDER_URL,
      note: `Document Search → Grantor alanına "${t.competitor || "rakip adı"}" yaz, tarih aralığını kaybolma tarihine göre daralt. Deed/Warranty Deed kayıtları satışı kanıtlar. (URL parametresi taşımıyor — arama sitede yapılır.)`,
    });
    links.push({
      label: "AZ Affidavit of Value (satış fiyatı)",
      url: MOHAVE_AFFIDAVIT_URL,
      note: `Arizona'da her satışta Affidavit of Property Value dosyalanır — APN${t.apn && !isSyntheticApn(t.apn) ? ` (${t.apn})` : ""} ile arayınca gerçek satış fiyatı görünür.`,
    });
  } else if (st) {
    links.push({
      label: `${(t.county || "?")} County Recorder'da ara`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${t.county || ""} county ${t.state || ""} recorder official records search`)}`,
      note: `İlçe recorder sitesinde Grantor = "${t.competitor || "rakip adı"}" araması deed kaydını gösterir.`,
    });
  }
  return links;
}
