import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// PAZAR-ÖRTÜŞME — "Rakip burada SATIYOR + bizde envanter var = KANITLI PAZAR".
//
// BÖLGE (şehir) bazında, tek tabloda:
//   • Rakip satışı: competitor_listings → o bölgedeki ilan sayısı, rakip kırılımı
//     (Rina / Discount Lots / Landio), fiyat aralığı + medyan $/acre, örnek raw_url.
//   • Bizim envanter: offmarket_leads + tax_delinquent_properties sayısı +
//     ortalama alış maliyeti (est_offer / minimum_bid).
//   • Spread: bizim medyan alış $/acre → rakip retail medyan $/acre farkı.
//
// DÜRÜSTLÜK:
//   • Landio gibi aykırı fiyatlar ($750k / 5acre = scraping hatası) sane-band
//     dışında → medyana KATILMAZ, "flagged" sayılır.
//   • Bölge eşleşmesi anahtar-kelimeyle (region/county/title/adres) yapılır;
//     eşleşmeyen kayıtlar "Diğer" altında toplanır.
//   • Salt-okunur. Hiçbir değerleme/fiyat mantığına dokunmaz. Eksik tabloda çökmez.
// ─────────────────────────────────────────────────────────────────────────────

function isMissing(msg?: string): boolean {
  return /schema cache|does not exist|could not find|relation|column/i.test(msg ?? "");
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

// Ham arsa için makul $/acre bandı — dışı = scraping hatası / aykırı (Landio $150k/acre gibi).
const PPA_MIN = 150;
const PPA_MAX = 60000;
const sanePpa = (ppa: number) => ppa >= PPA_MIN && ppa <= PPA_MAX;

// Bilinen bölgeler (şehir) — kanıtlanmış Mohave/Coconino pazarları + anahtar kelimeler.
interface RegionDef {
  key: string;
  label: string;
  state: string;
  county: string;
  kw: string[];
}
const REGIONS: RegionDef[] = [
  { key: "meadview", label: "Meadview", state: "AZ", county: "Mohave", kw: ["meadview"] },
  { key: "golden-valley", label: "Golden Valley", state: "AZ", county: "Mohave", kw: ["golden valley", "golden vly"] },
  { key: "dolan-springs", label: "Dolan Springs", state: "AZ", county: "Mohave", kw: ["dolan springs", "dolan spgs", "dolan"] },
  { key: "topock", label: "Topock", state: "AZ", county: "Mohave", kw: ["topock"] },
  { key: "yucca", label: "Yucca", state: "AZ", county: "Mohave", kw: ["yucca"] },
  { key: "williams", label: "Williams", state: "AZ", county: "Coconino", kw: ["williams"] },
  { key: "kingman", label: "Kingman", state: "AZ", county: "Mohave", kw: ["kingman"] },
  { key: "fort-mohave", label: "Fort Mohave", state: "AZ", county: "Mohave", kw: ["fort mohave", "ft mohave", "ft. mohave"] },
  { key: "bullhead", label: "Bullhead City", state: "AZ", county: "Mohave", kw: ["bullhead"] },
  { key: "lake-havasu", label: "Lake Havasu", state: "AZ", county: "Mohave", kw: ["lake havasu", "havasu"] },
];

// Haystack içinde ilk eşleşen bölgeyi döndür; yoksa null ("Diğer").
function matchRegion(haystack: string): RegionDef | null {
  const h = haystack.toLowerCase();
  for (const r of REGIONS) {
    for (const k of r.kw) {
      if (h.includes(k)) return r;
    }
  }
  return null;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Paginated salt-okuma fetch (data-coverage deseni). Hata → { rows, missing }.
async function fetchAll(
  s: ReturnType<typeof supabaseAdmin>,
  table: string,
  columns: string,
  cap = 60000
): Promise<{ rows: Record<string, unknown>[]; missing: boolean; error?: string }> {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await s.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) return { rows: all, missing: isMissing(error.message), error: error.message };
    all.push(...((data as unknown as Record<string, unknown>[]) ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
    if (from > cap) break;
  }
  return { rows: all, missing: false };
}

interface CompAgg {
  count: number;
  byCompetitor: Record<string, number>;
  ppas: number[]; // sane $/acre
  prices: number[]; // sane listing price
  flagged: number; // aykırı/sane-band-dışı
  samples: { competitor: string; url: string; price: number | null; acres: number | null; title: string }[];
  maxScrapedAt: string | null;
}
interface OurAgg {
  offmarket: number;
  tax: number;
  offers: number[]; // est_offer / minimum_bid (parsel başına)
  ourPpas: number[]; // est_offer / acres
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const notes: string[] = [];
  try {
    const s = supabaseAdmin();

    const comp: Record<string, CompAgg> = {};
    const ours: Record<string, OurAgg> = {};
    const OTHER = "__other__";
    const ensureC = (k: string): CompAgg =>
      (comp[k] ??= { count: 0, byCompetitor: {}, ppas: [], prices: [], flagged: 0, samples: [], maxScrapedAt: null });
    const ensureO = (k: string): OurAgg =>
      (ours[k] ??= { offmarket: 0, tax: 0, offers: [], ourPpas: [] });

    // ── 1) competitor_listings (RLS → service role) ────────────────────────────
    const c = await fetchAll(
      s,
      "competitor_listings",
      "competitor,title,state,county,acres,price,raw_url,scraped_at",
      10000
    );
    if (c.missing) notes.push("competitor_listings tablosu yok.");
    else {
      for (const r of c.rows) {
        const title = String(r.title || "");
        const county = String(r.county || "");
        const hay = `${title} ${county} ${String(r.state || "")}`;
        const reg = matchRegion(hay);
        const k = reg ? reg.key : OTHER;
        const a = ensureC(k);
        a.count++;
        const competitor = String(r.competitor || "Bilinmeyen");
        a.byCompetitor[competitor] = (a.byCompetitor[competitor] || 0) + 1;
        const price = num(r.price);
        const acres = num(r.acres);
        const ppa = price != null && acres != null && acres > 0 ? price / acres : null;
        if (ppa != null) {
          if (sanePpa(ppa)) {
            a.ppas.push(ppa);
            if (price != null) a.prices.push(price);
          } else {
            a.flagged++;
          }
        } else if (price != null && price > 0) {
          a.prices.push(price);
        }
        const ts = r.scraped_at ? String(r.scraped_at) : null;
        if (ts && (!a.maxScrapedAt || ts > a.maxScrapedAt)) a.maxScrapedAt = ts;
        if (reg && a.samples.length < 4 && r.raw_url) {
          a.samples.push({ competitor, url: String(r.raw_url), price, acres, title });
        }
      }
    }

    // ── 2) offmarket_leads (bizim envanter) ────────────────────────────────────
    const o = await fetchAll(
      s,
      "offmarket_leads",
      "state,county,region,situs,acres,est_offer,land_value",
      40000
    );
    if (o.missing) notes.push("offmarket_leads tablosu yok.");
    else {
      for (const r of o.rows) {
        const hay = `${String(r.region || "")} ${String(r.situs || "")} ${String(r.county || "")}`;
        const reg = matchRegion(hay);
        const k = reg ? reg.key : OTHER;
        const a = ensureO(k);
        a.offmarket++;
        const offer = num(r.est_offer);
        const acres = num(r.acres);
        if (offer != null && offer > 0) {
          a.offers.push(offer);
          if (acres != null && acres > 0) {
            const ppa = offer / acres;
            if (sanePpa(ppa)) a.ourPpas.push(ppa);
          }
        }
      }
    }

    // ── 3) tax_delinquent_properties (bizim envanter, county-seviye) ────────────
    const t = await fetchAll(
      s,
      "tax_delinquent_properties",
      "state,county,property_address,acres,minimum_bid,judgment_amount",
      60000
    );
    if (t.missing) notes.push("tax_delinquent_properties tablosu yok.");
    else {
      for (const r of t.rows) {
        const hay = `${String(r.property_address || "")} ${String(r.county || "")}`;
        const reg = matchRegion(hay);
        const k = reg ? reg.key : OTHER;
        const a = ensureO(k);
        a.tax++;
        const bid = num(r.minimum_bid) ?? num(r.judgment_amount);
        if (bid != null && bid > 0) a.offers.push(bid);
      }
    }

    // ── Bölge satırlarını birleştir ────────────────────────────────────────────
    const regions = REGIONS.map((rd) => {
      const cA = comp[rd.key];
      const oA = ours[rd.key];
      const compCount = cA?.count ?? 0;
      const ourOff = oA?.offmarket ?? 0;
      const ourTax = oA?.tax ?? 0;
      const ourTotal = ourOff + ourTax;
      const compPpa = cA ? median(cA.ppas) : null;
      const ourPpa = oA ? median(oA.ourPpas) : null;
      const avgOffer = oA && oA.offers.length ? Math.round(oA.offers.reduce((x, y) => x + y, 0) / oA.offers.length) : null;
      const prices = cA?.prices ?? [];
      const badge =
        compCount > 0 && ourTotal > 0 ? "proven" : compCount > 0 ? "comp-only" : ourTotal > 0 ? "inv-only" : "empty";
      return {
        key: rd.key,
        label: rd.label,
        state: rd.state,
        county: rd.county,
        comp: {
          count: compCount,
          byCompetitor: cA?.byCompetitor ?? {},
          medianPpa: compPpa,
          priceMin: prices.length ? Math.min(...prices) : null,
          priceMax: prices.length ? Math.max(...prices) : null,
          flagged: cA?.flagged ?? 0,
          samples: cA?.samples ?? [],
          scrapedAt: cA?.maxScrapedAt ?? null,
        },
        ours: { offmarket: ourOff, tax: ourTax, total: ourTotal, avgOffer, medianPpa: ourPpa },
        spreadPerAcre: compPpa != null && ourPpa != null ? Math.round(compPpa - ourPpa) : null,
        badge,
      };
    })
      // Tamamen boş bölgeleri gizle (ne rakip ne envanter).
      .filter((r) => r.comp.count > 0 || r.ours.total > 0)
      // Önce KANITLI pazarlar, sonra rakip sayısına göre.
      .sort((a, b) => {
        const rank = (x: string) => (x === "proven" ? 0 : x === "comp-only" ? 1 : 2);
        return rank(a.badge) - rank(b.badge) || b.comp.count - a.comp.count || b.ours.total - a.ours.total;
      });

    const other = {
      comp: comp[OTHER]?.count ?? 0,
      offmarket: ours[OTHER]?.offmarket ?? 0,
      tax: ours[OTHER]?.tax ?? 0,
    };

    // En yeni rakip scrape tarihi (genel).
    let scrapedAt: string | null = null;
    for (const k of Object.keys(comp)) {
      const ts = comp[k].maxScrapedAt;
      if (ts && (!scrapedAt || ts > scrapedAt)) scrapedAt = ts;
    }

    return NextResponse.json({
      regions,
      other,
      scrapedAt,
      band: { ppaMin: PPA_MIN, ppaMax: PPA_MAX },
      notes,
    });
  } catch (e) {
    return NextResponse.json(
      { regions: [], other: { comp: 0, offmarket: 0, tax: 0 }, scrapedAt: null, band: { ppaMin: PPA_MIN, ppaMax: PPA_MAX }, notes: [e instanceof Error ? e.message : "market-overlap failed"] },
      { status: 200 }
    );
  }
}
