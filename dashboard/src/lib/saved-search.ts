// ─────────────────────────────────────────────────────────────────────────────
// SAVED SEARCH — SAF FİLTRE MOTORU (null-safe, deterministik, DB'siz test edilebilir)
//
// Bir kayıtlı aramanın filters_json setini bir lead satırına uygular. Hem
// /api/saved-searches/run (tekil) hem /api/saved-searches/run-all (cron) bunu
// kullanır — filtre mantığı TEK yerde, çift kopya yok.
// ─────────────────────────────────────────────────────────────────────────────

export interface Filters {
  states?: string[];
  srcContains?: string;
  minScore?: number;
  minAcres?: number;
  maxAcres?: number;
  minBid?: number;
  maxBid?: number;
  county?: string;
  hasOwner?: boolean;
  limit?: number;
}

export interface LeadRow {
  id: string;
  state: string | null;
  county: string | null;
  source: string | null;
  acres: number | null;
  minimum_bid: number | null;
  final_score: number | null;
  owner_name: string | null;
  property_address: string | null;
  scraped_at: string | null;
}

/** "Harris County" / "harris" → "HARRIS" — county karşılaştırması için normalize. */
export const normCounty = (c: string | null | undefined): string =>
  (c || "").toUpperCase().replace(/ COUNTY$/i, "").trim();

/** Bilinen "sahip yok" sineli metinleri — hasOwner filtresi bunları eler. */
const NO_OWNER = /unknown|no owner|county tax/i;

/** Tek bir lead satırı verilen filtreye uyuyor mu? Saf, yan etkisiz. */
export function matchesFilter(r: LeadRow, f: Filters): boolean {
  if (f.states?.length && !(r.state && f.states.map((x) => x.toUpperCase()).includes(r.state.toUpperCase()))) return false;
  if (f.srcContains && !((r.source || "").toLowerCase().includes(f.srcContains.toLowerCase()))) return false;
  if (f.county && normCounty(r.county) !== normCounty(f.county)) return false;
  if (f.minScore != null && (r.final_score ?? 0) < f.minScore) return false;
  if (f.minAcres != null && (r.acres ?? 0) < f.minAcres) return false;
  if (f.maxAcres != null && (r.acres ?? Infinity) > f.maxAcres) return false;
  if (f.minBid != null && (r.minimum_bid ?? 0) < f.minBid) return false;
  if (f.maxBid != null && (r.minimum_bid ?? Infinity) > f.maxBid) return false;
  if (f.hasOwner && !(r.owner_name && !NO_OWNER.test(r.owner_name))) return false;
  return true;
}

export interface RankedMatches {
  /** filtreye uyan TÜM satır sayısı (limit'ten önce). */
  total: number;
  /** skora göre sıralı + limit uygulanmış eşleşmeler. */
  capped: LeadRow[];
  /** capped içinde priorIds'te OLMAYAN (yeni) satırlar. */
  newMatches: LeadRow[];
}

/**
 * Bir lead havuzunu filtreye göre süz, skora göre sırala, limit uygula ve
 * priorIds'e (önceki çalıştırmanın baseline'ı) göre YENİ eşleşmeleri türet.
 */
export function rankMatches(rows: LeadRow[], filters: Filters, priorIds: Set<string>): RankedMatches {
  const all = rows.filter((r) => matchesFilter(r, filters));
  all.sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
  const limit = Math.min(500, filters.limit ?? 200);
  const capped = all.slice(0, limit);
  const newMatches = capped.filter((r) => !priorIds.has(r.id));
  return { total: all.length, capped, newMatches };
}

export const LEAD_SELECT = "id,state,county,source,acres,minimum_bid,final_score,owner_name,property_address,scraped_at";

// Supabase client'ın yalnızca kullandığımız alt kümesi. `range` gerçek Promise
// değil thenable döndürdüğü için PromiseLike ile eşleştiriyoruz (yapısal uyum).
interface MinimalQuery {
  from: (t: string) => {
    select: (c: string) => {
      range: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
    };
  };
}

/**
 * tax_delinquent_properties tablosunu 1000'lik sayfalarla süpürür ve TÜM
 * satırları döner. Tablo yoksa/erişilemezse hata fırlatmaz — boş dizi döner.
 * (Supabase client'ın minimal alt kümesini alır; test edilebilir kalsın diye.)
 */
export async function sweepLeads(s: MinimalQuery): Promise<{ rows: LeadRow[]; ok: boolean }> {
  const rows: LeadRow[] = [];
  try {
    let from = 0;
    for (;;) {
      const { data, error } = await s.from("tax_delinquent_properties").select(LEAD_SELECT).range(from, from + 999);
      if (error) return { rows: [], ok: false };
      if (!data || data.length === 0) break;
      for (const r of data as LeadRow[]) rows.push(r);
      if (data.length < 1000) break;
      from += 1000;
    }
  } catch {
    return { rows: [], ok: false };
  }
  return { rows, ok: true };
}
