import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { stateAbbr } from "@/lib/rakip-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP İSTİHBARATI — patronun iki sorusuna tek ekranda cevap:
//   1) "Rakiplerimiz EN SON ne sattı/ne yaptı?"  → competitor_tracked'te
//      SUSPECTED_SOLD / SOLD_VERIFIED olanlar, kaybolma tarihine göre sıralı.
//      "SUSPECTED_SOLD" = ilan snapshot'tan kayboldu → MUHTEMEL SATIŞ (kesin değil).
//   2) "Rakiplerin olduğu ARSA bölgelerine yoğunlaşalım." → competitor_listings +
//      tracked'ten county/state bazında rakip yoğunluğu (aktif ilan + muhtemel
//      satış) sıralaması + o bölgede BİZİM offmarket_leads sayımız → sourcing
//      önceliği.
//
// DÜRÜSTLÜK:
//   • Hiçbir "satıldı" kesin değil — hepsi "muhtemel satış" (ilan kayboldu).
//   • Rakip state alanı kirli ("Arizona", "AZ", "Arizona with desert…") →
//     stateAbbr ile 2 harfe normalize edilir; çözülemeyen kayıt "??" altında.
//   • offmarket_leads SALT-OKUNUR (yeniden scrape edilmez). Bizim envanterimiz
//     büyük oranda AZ/Mohave bölgesinde; county eşleşmesi ilçe/yer adı token'ı
//     ile en-iyi-çaba yapılır, eyalet sayısı her zaman güvenilirdir.
//   • Tablo yoksa/erişilemezse boş döner, çökmez.
// ─────────────────────────────────────────────────────────────────────────────

function isMissing(msg?: string): boolean {
  return /schema cache|does not exist|could not find|relation|column/i.test(msg ?? "");
}

// County/yer adını eşleşme için sadeleştir: küçük harf, "County/Parish", parantez
// içi ("(kırsal)"), "/" ayracının ilk parçası, fazla boşluk temizlenir.
function normalizeCounty(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let c = String(raw).toLowerCase();
  c = c.split("/")[0]; // "Golden Valley / Kingman" → "golden valley"
  c = c.replace(/\([^)]*\)/g, " "); // "(kırsal)" at
  c = c.replace(/\bcounty\b|\bparish\b/g, " ");
  c = c.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return c || null;
}

// Bir SOLD sayacı için ilçe token'ı (ilk anlamlı kelime) — offmarket ilike için.
function countyToken(norm: string | null): string | null {
  if (!norm) return null;
  const words = norm.split(" ").filter((w) => w.length >= 3);
  return words[0] || null;
}

interface SrcRow {
  competitor: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  price: number | null;
  raw_url: string | null;
  scraped_at: string | null;
}
interface TrackedRow {
  competitor: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  current_price: number | null;
  initial_price: number | null;
  status: string | null;
  disappeared_at: string | null;
  dom_days: number | null;
  url: string | null;
}

async function fetchAll<T>(
  s: ReturnType<typeof supabaseAdmin>,
  table: string,
  columns: string
): Promise<{ rows: T[]; missing: boolean; error?: string }> {
  const all: T[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await s.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) return { rows: all, missing: isMissing(error.message), error: error.message };
    all.push(...((data as unknown as T[]) ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
    if (from > 20000) break;
  }
  return { rows: all, missing: false };
}

interface RegionAgg {
  st: string; // 2 harf veya "??"
  countyNorm: string; // sadeleştirilmiş
  countyLabel: string; // gösterim (orijinal biçim)
  active: number;
  sold: number; // muhtemel + doğrulanmış satış
  byCompetitor: Record<string, number>;
  prices: number[];
  ppas: number[];
}

const median = (arr: number[]): number | null => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const notes: string[] = [];
  try {
    const s = supabaseAdmin();

    // 1) Aktif rakip ilanları (kaynak tablo)
    const cl = await fetchAll<SrcRow>(
      s,
      "competitor_listings",
      "competitor,title,state,county,acres,price,raw_url,scraped_at"
    );
    if (cl.missing) notes.push("competitor_listings tablosu yok.");

    // 2) İzlenen ilanlar (satış/kaybolma durumları)
    const tr = await fetchAll<TrackedRow>(
      s,
      "competitor_tracked",
      "competitor,title,state,county,acres,current_price,initial_price,status,disappeared_at,dom_days,url"
    );
    if (tr.missing) notes.push("competitor_tracked tablosu yok (önce rakip-radar/refresh koştur).");

    // ── Bölge yoğunluğu ────────────────────────────────────────────────────────
    const regions = new Map<string, RegionAgg>();
    const ensure = (st: string, countyNorm: string, label: string): RegionAgg => {
      const key = `${st}|${countyNorm}`;
      let r = regions.get(key);
      if (!r) {
        r = { st, countyNorm, countyLabel: label, active: 0, sold: 0, byCompetitor: {}, prices: [], ppas: [] };
        regions.set(key, r);
      }
      return r;
    };

    for (const r of cl.rows) {
      const st = stateAbbr(r.state) || "??";
      const norm = normalizeCounty(r.county);
      if (!norm) continue; // county'siz kayıt yoğunluğa girmez
      const agg = ensure(st, norm, r.county ? String(r.county) : norm);
      agg.active++;
      const comp = r.competitor || "Bilinmeyen";
      agg.byCompetitor[comp] = (agg.byCompetitor[comp] || 0) + 1;
      const price = typeof r.price === "number" ? r.price : null;
      const acres = typeof r.acres === "number" ? r.acres : null;
      if (price != null && price > 0) {
        agg.prices.push(price);
        if (acres != null && acres > 0) agg.ppas.push(price / acres);
      }
    }

    const SOLD_STATUSES = new Set(["SUSPECTED_SOLD", "SOLD_VERIFIED"]);
    for (const t of tr.rows) {
      if (!SOLD_STATUSES.has(t.status || "")) continue;
      const st = stateAbbr(t.state) || "??";
      const norm = normalizeCounty(t.county);
      if (!norm) continue;
      const agg = ensure(st, norm, t.county ? String(t.county) : norm);
      agg.sold++;
    }

    // ── Rakip son satışları (muhtemel satış) — kaybolma tarihine göre ────────────
    const recentSales = tr.rows
      .filter((t) => SOLD_STATUSES.has(t.status || ""))
      .sort((a, b) => (b.disappeared_at || "").localeCompare(a.disappeared_at || ""))
      .slice(0, 50)
      .map((t) => ({
        competitor: t.competitor,
        title: t.title,
        state: t.state,
        stateAbbr: stateAbbr(t.state),
        county: t.county,
        acres: t.acres,
        price: t.current_price,
        disappearedAt: t.disappeared_at,
        domDays: t.dom_days,
        url: t.url,
        verified: t.status === "SOLD_VERIFIED",
      }));

    // ── Rakip özeti (aktif ilan + muhtemel/doğrulanmış satış) ────────────────────
    const compActive: Record<string, number> = {};
    for (const r of cl.rows) {
      const c = r.competitor || "Bilinmeyen";
      compActive[c] = (compActive[c] || 0) + 1;
    }
    const compSold: Record<string, { suspected: number; verified: number }> = {};
    for (const t of tr.rows) {
      const c = t.competitor || "Bilinmeyen";
      compSold[c] ??= { suspected: 0, verified: 0 };
      if (t.status === "SUSPECTED_SOLD") compSold[c].suspected++;
      else if (t.status === "SOLD_VERIFIED") compSold[c].verified++;
    }
    const competitorSummary = Object.keys({ ...compActive, ...compSold })
      .map((c) => ({
        competitor: c,
        active: compActive[c] || 0,
        suspectedSold: compSold[c]?.suspected || 0,
        verifiedSold: compSold[c]?.verified || 0,
      }))
      .sort((a, b) => b.active - a.active || b.suspectedSold - a.suspectedSold);

    const totals = {
      activeListings: cl.rows.length,
      suspectedSold: tr.rows.filter((t) => t.status === "SUSPECTED_SOLD").length,
      verifiedSold: tr.rows.filter((t) => t.status === "SOLD_VERIFIED").length,
      lastScrapeAt:
        cl.rows.reduce<string | null>((mx, r) => {
          const ts = r.scraped_at ? String(r.scraped_at) : null;
          return ts && (!mx || ts > mx) ? ts : mx;
        }, null) ?? null,
    };

    // ── Sıcak bölgeler (rakip yoğunluğu) — sıralı ────────────────────────────────
    const rankedRegions = [...regions.values()]
      .filter((r) => r.st !== "??") // eyaleti çözülemeyen kayıtları sıralamaya alma
      .map((r) => ({
        state: r.st,
        county: r.countyLabel,
        countyNorm: r.countyNorm,
        active: r.active,
        sold: r.sold,
        heat: r.active + r.sold * 2, // satış aktif ilandan daha güçlü sinyal
        topCompetitor:
          Object.entries(r.byCompetitor).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        medianPrice: median(r.prices),
        medianPpa: r.ppas.length ? median(r.ppas) : null,
        ourLeadsCounty: 0 as number,
        ourLeadsState: 0 as number,
        priority: "" as string,
      }))
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 40);

    // ── BİZİM ENVANTER (offmarket_leads, SALT-OKUNUR) ────────────────────────────
    // Eyalet sayıları her zaman güvenilir; county sayıları en-iyi-çaba (ilike token).
    const hotStates = [...new Set(rankedRegions.map((r) => r.state))];
    const stateLeadCounts: Record<string, number> = {};
    let ourTableMissing = false;

    await Promise.all(
      hotStates.map(async (st) => {
        const { count, error } = await s
          .from("offmarket_leads")
          .select("*", { count: "exact", head: true })
          .eq("state", st.toUpperCase());
        if (error) {
          if (isMissing(error.message)) ourTableMissing = true;
          return;
        }
        stateLeadCounts[st] = count ?? 0;
      })
    );
    if (ourTableMissing) notes.push("offmarket_leads tablosu yok — bizim lead sayıları gösterilemiyor.");

    // County-seviye lead sayısı: sıralı bölgeler için paralel head-count (ilike).
    if (!ourTableMissing) {
      await Promise.all(
        rankedRegions.map(async (r) => {
          r.ourLeadsState = stateLeadCounts[r.state] ?? 0;
          const tok = countyToken(r.countyNorm);
          if (!tok || r.ourLeadsState === 0) return; // eyalette hiç lead yoksa county de 0
          const { count, error } = await s
            .from("offmarket_leads")
            .select("*", { count: "exact", head: true })
            .eq("state", r.state.toUpperCase())
            .ilike("county", `%${tok}%`);
          if (!error) r.ourLeadsCounty = count ?? 0;
        })
      );
    }

    // ── Öncelik etiketi ──────────────────────────────────────────────────────────
    for (const r of rankedRegions) {
      if (r.sold > 0 && r.ourLeadsCounty > 0) r.priority = "ONCELIK"; // rakip satıyor + county'de lead'imiz var
      else if (r.active > 0 && r.ourLeadsCounty > 0) r.priority = "IZLE"; // rakip aktif + lead'imiz var
      else if (r.active > 0 && r.ourLeadsState > 0) r.priority = "FIRSAT"; // eyalette lead var, county eşleşmedi
      else r.priority = "RAKIP_ALANI"; // rakip var, envanterimiz yok
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totals,
      competitorSummary,
      recentSales,
      hotRegions: rankedRegions,
      ourLeadTotal: Object.values(stateLeadCounts).reduce((a, b) => a + b, 0),
      notes,
    });
  } catch (e) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        totals: { activeListings: 0, suspectedSold: 0, verifiedSold: 0, lastScrapeAt: null },
        competitorSummary: [],
        recentSales: [],
        hotRegions: [],
        ourLeadTotal: 0,
        notes: [e instanceof Error ? e.message : "rakip-istihbarat failed"],
      },
      { status: 200 }
    );
  }
}
