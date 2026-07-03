// ─────────────────────────────────────────────────────────────────────────────
// RAKİP RADAR — persist katmanı. Saf motor (rakip-radar.ts) ile Supabase
// arasındaki köprü. SupabaseClient parametre olarak alınır (dependency
// injection) ki hem API route'ları (supabaseAdmin) hem de günlük cron script'i
// (scripts/rakip-radar-refresh.mjs) aynı kodu kullansın.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  diffSnapshots,
  deriveSourceStatus,
  listingKey,
  type CompListing,
  type DiffEvent,
  type TrackedListing,
} from "./rakip-radar.ts";

// competitor_listings satırı (scraper'ın upsert ettiği kaynak tablo)
interface SourceRow {
  competitor: string | null;
  title: string | null;
  apn: string | null;
  raw_url: string | null;
  price: number | null;
  acres: number | null;
  state: string | null;
  county: string | null;
  notes: string | null;
}

export function sourceRowToListing(r: SourceRow): CompListing {
  const base = {
    competitor: r.competitor,
    title: r.title,
    apn: r.apn,
    url: r.raw_url,
    state: r.state,
    county: r.county,
  };
  return {
    ...base,
    key: listingKey(base),
    price: r.price,
    acres: r.acres,
    status: deriveSourceStatus(r.title, r.notes),
  };
}

export async function loadTracked(s: SupabaseClient): Promise<TrackedListing[]> {
  const all: TrackedListing[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await s
      .from("competitor_tracked")
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`competitor_tracked okunamadı: ${error.message}`);
    all.push(...((data ?? []) as TrackedListing[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export interface RefreshResult {
  runAt: string;
  sourceCount: number;
  events: Record<string, number>;
  totalEvents: number;
  firstRun: boolean;
}

/**
 * Bir "snapshot koşusu": competitor_listings'i oku → tracked ile diff'le →
 * snapshot + event + tracked upsert'lerini yaz. Idempotan değil (her çağrı yeni
 * snapshot koşusudur) — günde 1 kez çalıştırılması beklenir.
 */
export async function runRefresh(s: SupabaseClient, now = new Date()): Promise<RefreshResult> {
  // 1) Kaynak: şu an görünen rakip ilanları
  const src: SourceRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await s
      .from("competitor_listings")
      .select("competitor,title,apn,raw_url,price,acres,state,county,notes")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`competitor_listings okunamadı: ${error.message}`);
    src.push(...((data ?? []) as SourceRow[]));
    if (!data || data.length < PAGE) break;
  }
  const current = src.map(sourceRowToListing);

  // 2) İzlenen durumlar + diff
  const tracked = await loadTracked(s);
  const { events, upserts } = diffSnapshots(tracked, current, now);
  const runAt = now.toISOString();

  // 3) Snapshot satırları (bu koşuda görülen her ilan)
  const snapRows = current.map((c) => ({
    run_at: runAt,
    listing_key: c.key,
    competitor: c.competitor,
    title: c.title,
    apn: c.apn,
    url: c.url,
    price: c.price,
    acres: c.acres,
    state: c.state,
    county: c.county,
    status: c.status,
    seen_at: runAt,
  }));
  for (let i = 0; i < snapRows.length; i += 500) {
    const { error } = await s.from("competitor_snapshots").insert(snapRows.slice(i, i + 500));
    if (error) throw new Error(`snapshot yazılamadı: ${error.message}`);
  }

  // 4) Events
  const evRows = events.map((e: DiffEvent) => ({
    at: runAt,
    listing_key: e.listing_key,
    type: e.type,
    old_value: e.old_value,
    new_value: e.new_value,
    delta: e.delta,
  }));
  for (let i = 0; i < evRows.length; i += 500) {
    const { error } = await s.from("competitor_events").insert(evRows.slice(i, i + 500));
    if (error) throw new Error(`event yazılamadı: ${error.message}`);
  }

  // 5) Tracked upsert
  const upRows = upserts.map((t) => ({ ...t, updated_at: runAt }));
  for (let i = 0; i < upRows.length; i += 500) {
    const { error } = await s
      .from("competitor_tracked")
      .upsert(upRows.slice(i, i + 500), { onConflict: "listing_key" });
    if (error) throw new Error(`tracked upsert başarısız: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
  return {
    runAt,
    sourceCount: current.length,
    events: counts,
    totalEvents: events.length,
    firstRun: tracked.length === 0,
  };
}
