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
  count: number; // temiz (scrub sonrası) comp sayısı
  rawCount: number; // ham satış kaydı
  bulkRemoved: number; // toplu/tekrar eden olarak elenen
  median: number | null; // temiz median
  comps: AttomComp[];
};

const median = (a: number[]) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2);
};

export type AttomTitle = {
  ok: boolean;
  reason?: string;
  owner: string;
  absentee: boolean | null;
  hasMortgage: boolean | null; // ATTOM ipotek kaydı (lien'in TAMAMI değil)
  deedType: string;
  mailing: string;
};

/** ATTOM tapu ÖN-KONTROL — sahip + absentee + ipotek sinyali + deed tipi.
 *  NOT: kesin tapu temizliği değil (vergi/yargı lien'leri kapsamaz) — title
 *  company kapanmadan teyit eder. Bu yalnızca ilk-elden sinyal. */
export async function fetchTitlePrecheck(
  address1: string,
  cityStateZip: string,
): Promise<AttomTitle> {
  const empty = (reason: string): AttomTitle =>
    ({ ok: false, reason, owner: "", absentee: null, hasMortgage: null, deedType: "", mailing: "" });
  const key = process.env.ATTOM_API_KEY;
  if (!key) return empty("ATTOM_API_KEY yok");
  if (!address1) return empty("adres yok");
  try {
    const url = `${ATTOM_BASE}/property/detailmortgageowner?address1=${encodeURIComponent(address1)}&address2=${encodeURIComponent(cityStateZip)}`;
    const res = await fetch(url, { headers: { apikey: key, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return empty(`ATTOM HTTP ${res.status}`);
    const j = await res.json();
    const p = j?.property?.[0];
    if (!p) return empty("ATTOM kaydı bulunamadı");
    const owner = p.owner?.owner1?.fullname ?? "";
    const absStatus = p.owner?.absenteeownerstatus;
    const mort = p.mortgage ?? {};
    const lender = mort.lender?.companycode;
    const amt = Number(mort.amount ?? 0);
    // ipotek var mı: geçerli lender kodu veya tutar > 0
    const hasMortgage = (lender && lender !== "-1") || amt > 0 ? true : false;
    return {
      ok: true,
      owner,
      absentee: absStatus === "A" ? true : absStatus ? false : null,
      hasMortgage,
      deedType: String(mort.deedtype ?? ""),
      mailing: String(p.owner?.mailingaddressoneline ?? ""),
    };
  } catch (e) {
    return empty(`ATTOM hata: ${(e as Error).message}`);
  }
}

/** Real recent vacant-land sales within `radiusMi` of a point. */
export async function fetchNearbySoldComps(
  lat: number,
  lng: number,
  radiusMi = 8,
  pageSize = 25,
): Promise<AttomCompsResult> {
  const empty = (reason: string): AttomCompsResult =>
    ({ ok: false, reason, count: 0, rawCount: 0, bulkRemoved: 0, median: null, comps: [] });
  const key = process.env.ATTOM_API_KEY;
  if (!key) return empty("ATTOM_API_KEY yok");

  try {
    const url =
      `${ATTOM_BASE}/sale/snapshot?latitude=${lat}&longitude=${lng}` +
      `&radius=${radiusMi}&pagesize=${pageSize}`;
    const res = await fetch(url, {
      headers: { apikey: key, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return empty(`ATTOM HTTP ${res.status}`);
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
    // Scrub: identical (saleAmt + saleDate) repeated → bulk/portfolio sale split
    // across parcels; collapse to one representative so it doesn't inflate the median.
    const seen = new Map<string, AttomComp>();
    let bulkRemoved = 0;
    for (const c of comps) {
      const k = `${c.saleAmt}|${c.saleDate}`;
      if (seen.has(k)) { bulkRemoved++; continue; }
      seen.set(k, c);
    }
    const clean = [...seen.values()].sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));
    return {
      ok: true,
      rawCount: comps.length,
      bulkRemoved,
      count: clean.length,
      median: median(clean.map((c) => c.saleAmt)),
      comps: clean.slice(0, 15),
    };
  } catch (e) {
    return empty(`ATTOM hata: ${(e as Error).message}`);
  }
}
