// Env-gated PAID adapters — honest "not connected" stubs.
//
// The live enrichment path uses ONLY free keyless sources. These paid adapters
// are clean integration points the OWNER can switch on by setting an env token.
// When the token is unset they return a transparent { connected: false } marker
// and the pipeline simply ignores them — we NEVER fabricate parcel/owner data.
//
//   • REGRID_API_TOKEN → Regrid parcel boundaries + owner-of-record.
//   • ATTOM_API_KEY    → ATTOM deep property data (assessments, sales history).

import { fetchJson, qs } from "./http";

export interface PaidResult<T> {
  connected: boolean;
  source: string;
  /** Present only when connected AND the call succeeded. */
  data: T | null;
  /** Owner-facing note (e.g. how to connect). */
  note: string;
}

export interface RegridParcel {
  apn: string | null;
  owner: string | null;
  acres: number | null;
  geoid: string | null;
}

export interface AttomProperty {
  assessedValue: number | null;
  marketValue: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
}

export function regridConnected(): boolean {
  return !!process.env.REGRID_API_TOKEN;
}
export function attomConnected(): boolean {
  return !!process.env.ATTOM_API_KEY;
}

/** PURE: normalize a Regrid parcel feature into RegridParcel. */
export function parseRegridParcel(json: unknown): RegridParcel | null {
  if (!json || typeof json !== "object") return null;
  const features = ((json as Record<string, unknown>).parcels as Record<string, unknown> | undefined)?.features
    ?? (json as Record<string, unknown>).features;
  const arr = Array.isArray(features) ? features : null;
  const f = arr && arr[0] && typeof arr[0] === "object" ? (arr[0] as Record<string, unknown>) : null;
  const props = (f?.properties as Record<string, unknown> | undefined)?.fields as Record<string, unknown> | undefined
    ?? (f?.properties as Record<string, unknown> | undefined);
  if (!props) return null;
  const numish = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    apn: props.parcelnumb != null ? String(props.parcelnumb) : null,
    owner: props.owner != null ? String(props.owner) : null,
    acres: numish(props.gisacre ?? props.ll_gisacre),
    geoid: props.geoid != null ? String(props.geoid) : null,
  };
}

/** PURE: normalize an ATTOM property detail response. */
export function parseAttomProperty(json: unknown): AttomProperty | null {
  if (!json || typeof json !== "object") return null;
  const props = (json as Record<string, unknown>).property;
  const p = Array.isArray(props) && props[0] && typeof props[0] === "object" ? (props[0] as Record<string, unknown>) : null;
  if (!p) return null;
  const assessment = p.assessment as Record<string, unknown> | undefined;
  const assessed = (assessment?.assessed as Record<string, unknown> | undefined)?.assdttlvalue;
  const market = (assessment?.market as Record<string, unknown> | undefined)?.mktttlvalue;
  const sale = p.sale as Record<string, unknown> | undefined;
  const amount = (sale?.amount as Record<string, unknown> | undefined)?.saleamt;
  const numish = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    assessedValue: numish(assessed),
    marketValue: numish(market),
    lastSalePrice: numish(amount),
    lastSaleDate: sale?.salesearchdate != null ? String(sale.salesearchdate) : null,
  };
}

/** Regrid parcel-by-point. No-op (connected:false) unless REGRID_API_TOKEN set. */
export async function regridParcelAtLatLng(lat: number, lng: number): Promise<PaidResult<RegridParcel>> {
  const note = "REGRID_API_TOKEN ayarlanınca parsel sınırı + tapudaki sahip bilgisi gelir.";
  const token = process.env.REGRID_API_TOKEN;
  if (!token) return { connected: false, source: "regrid", data: null, note };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { connected: true, source: "regrid", data: null, note };
  const url = "https://app.regrid.com/api/v2/parcels/point?" + qs({ lat, lon: lng, token, limit: 1 });
  const json = await fetchJson(url, { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 7 });
  return { connected: true, source: "regrid", data: parseRegridParcel(json), note };
}

/** ATTOM property detail by address. No-op unless ATTOM_API_KEY set. */
export async function attomPropertyByAddress(address: string): Promise<PaidResult<AttomProperty>> {
  const note = "ATTOM_API_KEY ayarlanınca değerleme + satış geçmişi gibi derin emlak verisi gelir.";
  const key = process.env.ATTOM_API_KEY;
  if (!key) return { connected: false, source: "attom", data: null, note };
  const a = address?.trim();
  if (!a) return { connected: true, source: "attom", data: null, note };
  const url = "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?" + qs({ address: a });
  const json = await fetchJson(url, { timeoutMs: 8000, revalidate: 60 * 60 * 24 * 7, headers: { apikey: key } });
  return { connected: true, source: "attom", data: parseAttomProperty(json), note };
}
