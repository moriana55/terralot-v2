// ─────────────────────────────────────────────────────────────────────────────
// ARCGIS SAĞLAYICISI — ücretsiz, county'nin kendi parsel servisi.
//
// Tek bir generic sorgu + normalize mantığı; county farkları `ArcGisFieldMap`
// ile VERİ olarak ifade edilir. Yeni county = yeni kayıt, yeni kod değil.
//
// Bu dosya SAF: fetch dışında yan etkisi yok, sır içermez. Normalize
// fonksiyonları ayrı export edilir ki testten doğrudan çağrılabilsin.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ArcGisFieldMap, ArcGisSource, LiveCountyResult, LiveSearch, ProviderOutcome,
} from "./types";

// Eyalet geneli katmanlar (FL statewide gibi) 20sn'yi aşabiliyor — ölçümle
// 45sn'de yanıt verdikleri görüldü. Tavan buna göre.
const QUERY_TIMEOUT_MS = 45_000;

// ── Küçük yardımcılar ───────────────────────────────────────────────────────
const s = (v: unknown) => (v == null ? "" : String(v).trim());

/** "N/A" gibi anlamsız doldurmaları at — county verisinde çok yaygın. */
const anlamli = (v: string) => {
  const u = v.toUpperCase();
  return !!v && u !== "N/A" && u !== "NA" && u !== "NULL" && u !== "NONE" && u !== "UNKNOWN";
};

const numOr = (v: unknown, d: number | null = null): number | null => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : d;
};

/** İlk DOLU alanı döndür. */
function ilkDolu(a: Record<string, unknown>, keys: string[] | undefined): string {
  if (!keys) return "";
  for (const k of keys) {
    const v = s(a[k]);
    if (anlamli(v)) return v;
  }
  return "";
}

/** Dolu alanları ayraçla birleştir. */
function birlestir(a: Record<string, unknown>, keys: string[] | undefined, sep: string): string {
  if (!keys) return "";
  return keys.map((k) => s(a[k])).filter(anlamli).join(sep).trim();
}

/**
 * Tek alanda birleşik posta adresini ayrıştır.
 * Biçim: "STREET \nCITY, ST ZIP"  (NM Valencia OwnerAddre deseni)
 * Çok satır yoksa son satırdan şehir/eyalet/zip çekilir.
 */
export function parseBirlesikAdres(raw: unknown): {
  street: string; city: string; st: string; zip: string;
} {
  // Satır sonlarını virgüle çevir → tek bir "virgülle ayrılmış" biçime indirge.
  const t = String(raw ?? "").replace(/\r/g, "").replace(/\n/g, ", ").trim();
  const bos = { street: "", city: "", st: "", zip: "" };
  if (!t) return bos;

  // Boş segmentleri at ("414 OPAL ST, , KEMMERER, WY 83101" deseni).
  const segs = t.split(",").map((x) => x.trim()).filter(Boolean);
  if (segs.length === 0) return bos;

  let st = "", zip = "";
  const last = segs[segs.length - 1];
  const mStZip = last.match(/^([A-Za-z]{2})\.?\s*(\d{5}(?:-\d{4})?)?$/);
  if (mStZip) {
    st = mStZip[1].toUpperCase(); zip = mStZip[2] ?? ""; segs.pop();
  } else if (/^\d{5}(-\d{4})?$/.test(last)) {
    zip = last; segs.pop();
    const onceki = segs[segs.length - 1];
    const mSt = onceki?.match(/^([A-Za-z]{2})\.?$/);
    if (mSt) { st = mSt[1].toUpperCase(); segs.pop(); }
  }

  let city = "", street = "";
  if (segs.length >= 2) {
    city = segs[segs.length - 1];
    street = segs.slice(0, -1).join(", ");
  } else if (segs.length === 1) {
    // Tek segment: sokak ve şehir 2+ boşlukla ayrılmış olabilir (NC OneMap).
    const parts = segs[0].split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) { city = parts[parts.length - 1]; street = parts.slice(0, -1).join(" "); }
    else { street = segs[0]; }
  }
  return { street, city, st, zip };
}

function acreHesapla(a: Record<string, unknown>, f: ArcGisFieldMap): number | null {
  if (!f.acres) return null;
  const ham = a[f.acres];
  const prec = f.acresPrecision ?? 2;
  const pow = 10 ** prec;
  let acre: number | null;
  if (f.acresFrom === "shapeAreaSqft") {
    const sqft = Number(ham);
    acre = Number.isFinite(sqft) ? sqft / 43560 : null;
  } else {
    acre = numOr(ham);
  }
  if (acre == null || !Number.isFinite(acre)) return null;
  if (!f.acresAllowZero && acre <= 0) return null;
  return Math.round(acre * pow) / pow;
}

/**
 * PURE: bir ArcGIS attribute nesnesini normalize sonuca çevirir.
 * Sahip adı VEYA posta adresi eksikse `null` döner — mektup atılamayacak
 * kayıt sisteme SOKULMAZ (sahte veri yasağının somut hali).
 */
export function normalizeArcGis(
  a: Record<string, unknown>, f: ArcGisFieldMap, homeState: string,
): LiveCountyResult | null {
  const apn = ilkDolu(a, f.apn);
  const owner = birlestir(a, f.owner, " & ");
  if (!apn || !owner) return null;

  let mail = "", city = "", st = "", zip = "";
  if (f.mailCombined) {
    const ad = parseBirlesikAdres(a[f.mailCombined]);
    mail = ad.street; city = ad.city; st = ad.st; zip = ad.zip;
  } else {
    mail = birlestir(a, f.mailAddress, " ");
    city = f.mailCity ? s(a[f.mailCity]) : "";
    st = f.mailState ? s(a[f.mailState]).toUpperCase() : "";
    zip = f.mailZip ? s(a[f.mailZip]) : "";
    // "CITY, ST" biçiminde birleşik şehir alanı → ayrıştır.
    if (f.mailCityHasState && city) {
      // "PAHRUMP, NV"  veya  "EUREKA, KS 67045-4609"
      const m = city.match(/^(.*?),\s*([A-Za-z]{2})\b\s*(\d{5}(?:-\d{4})?)?\s*$/);
      if (m) { city = m[1].trim(); st = st || m[2].toUpperCase(); zip = zip || (m[3] ?? ""); }
    }
    // Şehir alanı boşsa adres alanı birleşik olabilir → ayrıştırmayı dene.
    if (f.mailCombinedFallback && !anlamli(city) && mail) {
      const ad = parseBirlesikAdres(mail);
      if (ad.city) { mail = ad.street; city = ad.city; st = st || ad.st; zip = zip || ad.zip; }
    }
  }
  if (!anlamli(mail) || !anlamli(city)) return null;

  const situs = birlestir(a, f.situs, f.situsJoin ?? " ");
  const use = ilkDolu(a, f.use) || f.useConst || "VACANT";
  const land_value = f.value ? numOr(a[f.value]) : null;

  return {
    apn, owner,
    mailing_address: mail,
    mailing_city: city,
    mailing_state: st.toUpperCase(),
    mailing_zip: zip,
    situs, use,
    acres: acreHesapla(a, f),
    land_value,
    absentee: !!(st && st.toUpperCase() !== homeState.toUpperCase()),
  };
}

// ── WHERE üretimi ───────────────────────────────────────────────────────────
const esc = (v: string) => v.replace(/'/g, "''");

export function buildArcGisWhere(src: ArcGisSource, search: LiveSearch): string {
  const clauses = [src.baseWhere];
  const sf = src.searchFields ?? {};
  const owner = search.owner?.trim();
  if (owner && sf.owner) clauses.push(`UPPER(${sf.owner}) LIKE '%${esc(owner.toUpperCase())}%'`);
  const apn = search.apn?.trim();
  if (apn && sf.apn) clauses.push(`${sf.apn} LIKE '%${esc(apn)}%'`);
  const mst = search.mailingState?.trim();
  if (mst && sf.mailState) clauses.push(`UPPER(${sf.mailState})='${esc(mst.toUpperCase())}'`);
  if (sf.value) {
    if (search.minValue != null && Number.isFinite(search.minValue)) {
      clauses.push(`${sf.value}>=${Math.round(search.minValue)}`);
    }
    if (search.maxValue != null && Number.isFinite(search.maxValue)) {
      clauses.push(`${sf.value}<=${Math.round(search.maxValue)}`);
    }
  }
  return clauses.filter(Boolean).join(" AND ");
}

/**
 * Sunucu-taraflı WHERE ile ifade EDİLEMEYEN filtreler için client-side eleme
 * (ör. birleşik adresten parse edilen posta eyaleti serverda filtrelenemez).
 */
export function clientFilter(rows: LiveCountyResult[], search: LiveSearch): LiveCountyResult[] {
  const mst = search.mailingState?.trim().toUpperCase();
  const min = search.minValue, max = search.maxValue;
  return rows.filter((r) => {
    if (mst && r.mailing_state.toUpperCase() !== mst) return false;
    // Değeri BİLİNMEYEN kaydı fiyat filtresiyle elemeyiz — "değeri yok" ile
    // "değeri aralık dışı" farklı şeyler. Değer alanı olmayan county'lerde
    // (ör. CO Las Animas) fiyat filtresi sessizce yok sayılır.
    if (r.land_value != null) {
      if (min != null && Number.isFinite(min) && r.land_value < min) return false;
      if (max != null && Number.isFinite(max) && r.land_value > max) return false;
    }
    return true;
  });
}

// ── Sorgu ───────────────────────────────────────────────────────────────────

/**
 * GET veya POST ile ArcGIS `/query` çağrısı. Uzun WHERE ifadeleri URL sınırını
 * aştığı için bazı servisler POST ister (kayıtta `method: "POST"`).
 * User-Agent bazı county servislerinde (CO, NM) ZORUNLU — hep gönderilir.
 */
async function arcgisFetch(
  src: ArcGisSource, params: URLSearchParams, timeoutMs: number, amac: string,
): Promise<Response> {
  // ⚠ HTTP başlıkları YALNIZCA ASCII olabilir (ByteString). Türkçe karakter
  // koyulursa fetch "Cannot convert argument to a ByteString" ile patlar.
  const ua = `Mozilla/5.0 (VegaLand ${amac.replace(/[^\x20-\x7E]/g, "")})`;
  // Bazı servisler proxy arkasında ve doğru `Referer` olmadan yanıt vermez
  // (ör. Idaho ISTC utility.arcgis.com uçları). Kayıtta tanımlanır.
  const ek = src.headers ?? {};
  if (src.method === "POST") {
    return fetch(src.endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": ua, "Content-Type": "application/x-www-form-urlencoded", ...ek },
      body: params.toString(),
    });
  }
  return fetch(`${src.endpoint}?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": ua, ...ek },
  });
}

export async function queryArcGis(
  src: ArcGisSource, homeState: string, label: string, search: LiveSearch, cap: number,
): Promise<ProviderOutcome> {
  const t0 = Date.now();
  const where = buildArcGisWhere(src, search);
  const params = new URLSearchParams({
    where,
    outFields: src.outFields,
    returnGeometry: "false",
    f: "json",
  });
  // Sayfalamayı desteklemeyen servislere tavan GÖNDERİLMEZ (400 döner);
  // sonuç aşağıda istemcide kırpılır.
  if (!src.noPagination) params.set("resultRecordCount", String(cap));
  // ⚠ Sıralama BAZI eyalet geneli katmanlarda (FL statewide) indekssiz alanda
  // yapılırsa sorgu 45sn'yi aşıp zaman aşımına uğruyor. Boş bırakılabilsin diye
  // parametre yalnızca doluysa gönderilir.
  if (src.orderBy) params.set("orderByFields", src.orderBy);

  const fail = (message: string): ProviderOutcome => ({
    provider: "arcgis", status: "servis-hatasi", rows: [], rawCount: 0, capped: false,
    message, where, durationMs: Date.now() - t0, cached: false, apiCalls: 0,
  });

  let json: { features?: { attributes: Record<string, unknown> }[]; error?: unknown };
  try {
    const res = await arcgisFetch(src, params, QUERY_TIMEOUT_MS, "live query");
    if (!res.ok) {
      return fail(`${label} servisi yanıt vermedi (HTTP ${res.status}). Servis geçici olarak engelli/yavaş olabilir.`);
    }
    json = await res.json();
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError"
      ? `${label} servisi ${QUERY_TIMEOUT_MS / 1000}sn içinde yanıt vermedi (zaman aşımı).`
      : `${label} servisine ulaşılamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}`;
    return fail(msg);
  }

  if (json.error) {
    return fail(`${label} ArcGIS hatası: ${JSON.stringify(json.error).slice(0, 200)}`);
  }

  const tumFeats = json.features ?? [];
  const feats = src.noPagination ? tumFeats.slice(0, cap) : tumFeats;
  const rows: LiveCountyResult[] = [];
  const seen = new Set<string>();
  for (const f of feats) {
    const r = normalizeArcGis(f.attributes, src.fields, homeState);
    if (!r || !r.apn || seen.has(r.apn)) continue;
    seen.add(r.apn);
    rows.push(r);
  }
  const filtered = clientFilter(rows, search);

  return {
    provider: "arcgis",
    status: filtered.length > 0 ? "ok" : "bos",
    rows: filtered,
    rawCount: feats.length,
    capped: feats.length >= cap,
    message: filtered.length === 0
      ? `${label}: servis çalıştı ama bu filtreye uyan kayıt bulunamadı (${feats.length} ham kayıt döndü).`
      : undefined,
    where,
    durationMs: Date.now() - t0,
    cached: false,
    apiCalls: 0,
  };
}

/**
 * Bir ArcGIS kaynağındaki TOPLAM kayıt sayısını ölçer (returnCountOnly).
 * Kapsam tablosu için — satır çekmez, ucuzdur.
 */
export async function countArcGis(src: ArcGisSource): Promise<{ count: number | null; error?: string }> {
  const params = new URLSearchParams({ where: src.baseWhere, returnCountOnly: "true", f: "json" });
  try {
    const res = await arcgisFetch(src, params, QUERY_TIMEOUT_MS, "coverage probe");
    if (!res.ok) return { count: null, error: `HTTP ${res.status}` };
    const j = await res.json();
    if (j.error) return { count: null, error: JSON.stringify(j.error).slice(0, 160) };
    return { count: typeof j.count === "number" ? j.count : null };
  } catch (e) {
    return { count: null, error: e instanceof Error ? `${e.name}: ${e.message}` : "bilinmeyen hata" };
  }
}
