// ATTOM client — REAL nearby SOLD comparable sales for a parcel.
// Uses the sale/snapshot endpoint (confirmed working on the trial key) which
// returns actual recorded vacant-land sales near a lat/lng. No fabrication:
// if no key or no results, returns an empty list + a clear reason.

const ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

export type AttomComp = {
  address: string;
  saleAmt: number;
  saleDate: string;
  propType: string;
  apn: string;
};

export type AttomCompsResult = {
  ok: boolean;
  reason?: string;
  count: number;
  median: number | null;
  comps: AttomComp[];
};

const median = (a: number[]) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2);
};

/** Real recent vacant-land sales within `radiusMi` of a point. */
export async function fetchNearbySoldComps(
  lat: number,
  lng: number,
  radiusMi = 8,
  pageSize = 25,
): Promise<AttomCompsResult> {
  const key = process.env.ATTOM_API_KEY;
  if (!key) return { ok: false, reason: "ATTOM_API_KEY yok", count: 0, median: null, comps: [] };

  try {
    const url =
      `${ATTOM_BASE}/sale/snapshot?latitude=${lat}&longitude=${lng}` +
      `&radius=${radiusMi}&pagesize=${pageSize}`;
    const res = await fetch(url, {
      headers: { apikey: key, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, reason: `ATTOM HTTP ${res.status}`, count: 0, median: null, comps: [] };
    const j = await res.json();
    const rows: Record<string, unknown>[] = j?.property ?? [];

    const comps: AttomComp[] = [];
    for (const r of rows) {
      const summary = (r.summary ?? {}) as Record<string, unknown>;
      const sale = ((r.sale ?? {}) as Record<string, unknown>).amount as Record<string, unknown> | undefined;
      const propType = String(summary.propertyType ?? summary.propclass ?? "");
      const saleAmt = Number(sale?.saleamt ?? 0);
      // Vacant land only, with a real recorded sale amount.
      if (!/vacant|land/i.test(propType) || !(saleAmt > 0)) continue;
      const addr = (r.address ?? {}) as Record<string, unknown>;
      const id = (r.identifier ?? {}) as Record<string, unknown>;
      comps.push({
        address: String(addr.oneLine ?? addr.line1 ?? ""),
        saleAmt,
        saleDate: String(((r.sale ?? {}) as Record<string, unknown>).salesearchdate ?? ""),
        propType,
        apn: String(id.apn ?? ""),
      });
    }
    comps.sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));
    return {
      ok: true,
      count: comps.length,
      median: median(comps.map((c) => c.saleAmt)),
      comps: comps.slice(0, 15),
    };
  } catch (e) {
    return { ok: false, reason: `ATTOM hata: ${(e as Error).message}`, count: 0, median: null, comps: [] };
  }
}
