// ─────────────────────────────────────────────────────────────────────────────
// YAYINLANMIŞ İLAN OVERRIDE DEPOSU — best-effort, degrade-çalışan.
//
// İlan Üreteci akışında admin composer çıktısını (title/description/bullets)
// düzenleyip "Yayınla" derse, override burada saklanır ve /p/[id] bunu tercih
// eder. Tablo (parcel_listings) YOKSA feature yine tam çalışır: /p composer'ın
// otomatik ürettiği içeriği gösterir, publish "persisted:false" döner.
//
// owner_finance/route.ts'teki isMissingTable kalıbının aynısı: HAM Postgres
// hatası dışarı sızmaz; tablo yoksa sessiz fallback.
//
// GÜVENLİK: burada saklanan alanlar SADECE buyer-facing metindir
// (title/description/bullets) — iç deal-ekonomisi buraya hiç girmez.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase";

const TABLE = "parcel_listings";

export interface PublishedListing {
  parcelRef: string;
  title: string;
  description: string;
  bullets: string[];
  status: string;
  updatedAt: string;
}

export interface PublishInput {
  parcelRef: string;
  title: string;
  description: string;
  bullets: string[];
  status?: string;
}

// Postgres "tablo yok" hatasını tanı (owner-finance/route.ts ile birebir aynı).
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    /schema cache|does not exist|could not find the table/i.test(error.message ?? "")
  );
}

type Row = {
  parcel_ref: string;
  title: string | null;
  description: string | null;
  bullets: unknown;
  status: string | null;
  updated_at: string | null;
};

function rowToListing(r: Row): PublishedListing {
  const bullets = Array.isArray(r.bullets)
    ? r.bullets.filter((x): x is string => typeof x === "string")
    : [];
  return {
    parcelRef: String(r.parcel_ref),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    bullets,
    status: String(r.status ?? "published"),
    updatedAt: String(r.updated_at ?? ""),
  };
}

/**
 * /p/[id] için yayınlanmış override'ı getir. Tablo yoksa / hata olursa / kayıt
 * yoksa null → çağıran composer'a düşer. ASLA throw etmez.
 */
export async function readPublishedListing(parcelRef: string): Promise<PublishedListing | null> {
  if (!parcelRef) return null;
  try {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("parcel_ref,title,description,bullets,status,updated_at")
      .eq("parcel_ref", parcelRef)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) return null;
    return rowToListing(data as Row);
  } catch {
    return null;
  }
}

export interface PublishResult {
  persisted: boolean;
  listing: PublishedListing;
  /** persisted=false nedeni (tablo yok / hata) — UI uyarısı için. */
  reason?: string;
}

/**
 * Override'ı upsert et. Tablo yoksa optimistik döner (persisted:false) — akış
 * kırılmaz. Kalıcı kayıt için sql/parcel_listings.sql Supabase'de çalıştırılmalı.
 */
export async function upsertPublishedListing(input: PublishInput): Promise<PublishResult> {
  const now = new Date().toISOString();
  const record = {
    parcel_ref: input.parcelRef,
    title: input.title,
    description: input.description,
    bullets: input.bullets,
    status: input.status ?? "published",
    updated_at: now,
  };
  const optimistic: PublishedListing = {
    parcelRef: input.parcelRef,
    title: input.title,
    description: input.description,
    bullets: input.bullets,
    status: record.status,
    updatedAt: now,
  };

  try {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .upsert(record, { onConflict: "parcel_ref" })
      .select("parcel_ref,title,description,bullets,status,updated_at")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) {
        return { persisted: false, listing: optimistic, reason: "table_missing" };
      }
      return { persisted: false, listing: optimistic, reason: error.message };
    }
    return { persisted: true, listing: data ? rowToListing(data as Row) : optimistic };
  } catch (e) {
    return { persisted: false, listing: optimistic, reason: e instanceof Error ? e.message : "unknown" };
  }
}
