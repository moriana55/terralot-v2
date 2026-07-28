// ─────────────────────────────────────────────────────────────────────────────
// REGRID SAĞLAYICISI — ücretli, ülke geneli yedek.
//
// Kendi ArcGIS'i olmayan (veya çökmüş) county'ler için devreye girer.
// ÜCRETLİ olduğu için üç koruma katmanı vardır:
//   1) ÖNBELLEK  — aynı sorgu TTL içinde tekrar para harcamaz
//   2) GÜNLÜK KOTA — REGRID_DAILY_CAP (varsayılan 50) aşılırsa çağrı YAPILMAZ
//   3) SAYAÇ      — harcanan her çağrı sayılır, rapora yansır
//
// ⚠ DURUM NOTU (2026-07-28): env'deki REGRID_API_TOKEN'ın süresi 2026-07-20'de
// dolmuştur (JWT exp). API `401 Invalid token` döner. Bu sağlayıcı doğru
// çalışacak şekilde yazılmıştır ama anahtar yenilenene kadar `kimlik-hatasi`
// döner ve HİÇBİR SATIR ÜRETMEZ. Sahte veri üretmek yasak.
// ─────────────────────────────────────────────────────────────────────────────

import type { LiveCountyResult, LiveSearch, ProviderOutcome, RegridSource } from "./types";

const BASE = "https://app.regrid.com/api/v2";
const TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat
const CACHE_MAX = 200;

// ── Kota sayacı (süreç-içi; sunucusuz ortamda örnek başına) ─────────────────
function bugununAnahtari(): string {
  return new Date().toISOString().slice(0, 10); // UTC gün
}

const kota = { gun: bugununAnahtari(), harcanan: 0 };

export function gunlukTavan(): number {
  const n = Number(process.env.REGRID_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

export function kotaDurumu(): { gun: string; harcanan: number; tavan: number; kalan: number } {
  if (kota.gun !== bugununAnahtari()) { kota.gun = bugununAnahtari(); kota.harcanan = 0; }
  const tavan = gunlukTavan();
  return { gun: kota.gun, harcanan: kota.harcanan, tavan, kalan: Math.max(0, tavan - kota.harcanan) };
}

/** Yalnızca testte kullanılır — sayacı sıfırlar. */
export function kotayiSifirla(): void { kota.gun = bugununAnahtari(); kota.harcanan = 0; }

// ── Önbellek (süreç-içi LRU-benzeri) ────────────────────────────────────────
interface CacheKaydi { t: number; rows: LiveCountyResult[]; rawCount: number }
const cache = new Map<string, CacheKaydi>();

function cacheOku(key: string): CacheKaydi | null {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.t > CACHE_TTL_MS) { cache.delete(key); return null; }
  // LRU tazeleme
  cache.delete(key); cache.set(key, v);
  return v;
}

function cacheYaz(key: string, rows: LiveCountyResult[], rawCount: number): void {
  if (cache.size >= CACHE_MAX) {
    const ilk = cache.keys().next().value;
    if (ilk) cache.delete(ilk);
  }
  cache.set(key, { t: Date.now(), rows, rawCount });
}

export function onbellegiTemizle(): void { cache.clear(); }

// ── Kimlik devre kesici ─────────────────────────────────────────────────────
// Anahtar geçersizse HER county için tekrar 401 yemek boşuna kota harcar.
// İlk 401'den sonra bu süreçte Regrid'e bir daha ÇAĞRI YAPILMAZ.
let kimlikBozuk = false;
export function kimlikBozukMu(): boolean { return kimlikBozuk; }
export function kimligiSifirla(): void { kimlikBozuk = false; }

/** Aynı sorgunun iki kez para harcamaması için deterministik anahtar. */
export function cacheAnahtari(path: string, search: LiveSearch, cap: number): string {
  return JSON.stringify([
    path, cap,
    search.owner?.trim().toUpperCase() ?? "",
    search.apn?.trim().toUpperCase() ?? "",
    search.mailingState?.trim().toUpperCase() ?? "",
    search.minValue ?? "", search.maxValue ?? "",
  ]);
}

// ── Normalize ───────────────────────────────────────────────────────────────
const s = (v: unknown) => (v == null ? "" : String(v).trim());
const numOr = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * PURE: Regrid v2 parsel özelliklerini ortak sonuç tipine çevirir.
 * Regrid standart şeması: properties.fields.{parcelnumb, owner, mailadd,
 * mailcity, mailstate2, mailzip, address, usedesc, ll_gisacre, landval}.
 *
 * ⚠ Bu eşleme Regrid v2 belgelenmiş şemasına göre yazıldı; anahtar süresi
 * dolu olduğu için CANLI YANITLA DOĞRULANAMADI. Anahtar yenilenince ilk
 * gerçek yanıtla teyit edilmeli.
 */
export function normalizeRegrid(
  props: Record<string, unknown>, homeState: string,
): LiveCountyResult | null {
  const apn = s(props.parcelnumb) || s(props.parcelnumb_no_formatting) || s(props.ll_uuid);
  const owner = s(props.owner);
  const mail = [props.mailadd, props.mail_address2].map(s).filter(Boolean).join(" ").trim();
  const city = s(props.mailcity);
  if (!apn || !owner || !mail || !city) return null;
  const st = (s(props.mailstate2) || s(props.mailstate)).toUpperCase();
  const acres = numOr(props.ll_gisacre ?? props.gisacre ?? props.deeded_acres);
  return {
    apn, owner,
    mailing_address: mail,
    mailing_city: city,
    mailing_state: st,
    mailing_zip: s(props.mailzip),
    situs: [props.address, props.scity].map(s).filter(Boolean).join(", "),
    use: s(props.usedesc) || s(props.zoning) || "VACANT",
    acres: acres != null && acres > 0 ? Math.round(acres * 100) / 100 : null,
    land_value: numOr(props.landval ?? props.parval),
    absentee: !!(st && st !== homeState.toUpperCase()),
  };
}

/** Regrid GeoJSON yanıtından özellik listesini çıkarır (iki olası sarmalayıcı). */
export function regridOzellikleri(json: unknown): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const feats = (o.parcels as Record<string, unknown> | undefined)?.features ?? o.features;
  if (!Array.isArray(feats)) return [];
  return feats
    .map((f) => {
      const p = (f as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
      if (!p) return null;
      return (p.fields as Record<string, unknown> | undefined) ?? p;
    })
    .filter((x): x is Record<string, unknown> => !!x);
}

// ── Sorgu ───────────────────────────────────────────────────────────────────
export async function queryRegrid(
  src: RegridSource, homeState: string, label: string, search: LiveSearch, cap: number,
): Promise<ProviderOutcome> {
  const t0 = Date.now();
  const bitir = (
    status: ProviderOutcome["status"], message: string | undefined,
    rows: LiveCountyResult[] = [], rawCount = 0, cached = false, apiCalls = 0,
  ): ProviderOutcome => ({
    provider: "regrid", status, rows, rawCount, capped: rawCount >= cap,
    message, durationMs: Date.now() - t0, cached, apiCalls,
  });

  const token = (process.env.REGRID_API_TOKEN || "").trim();
  if (!token) {
    return bitir("kimlik-hatasi", "REGRID_API_TOKEN tanımlı değil — ülke geneli yedek kullanılamıyor.");
  }

  // 0) Devre kesici — anahtar bu süreçte zaten 401 verdiyse tekrar deneme.
  if (kimlikBozuk) {
    return bitir("kimlik-hatasi",
      "Regrid anahtarı geçersiz (daha önce 401 alındı) — boşuna çağrı yapılmadı. Anahtar yenilenmeli.");
  }

  // 1) Önbellek — para harcamadan önce bak.
  const key = cacheAnahtari(src.path, search, cap);
  const hit = cacheOku(key);
  if (hit) {
    return bitir(hit.rows.length > 0 ? "ok" : "bos",
      `${label}: önbellekten (Regrid çağrısı harcanmadı).`, hit.rows, hit.rawCount, true, 0);
  }

  // 2) Kota — tavan dolduysa çağrı YAPMA.
  const k = kotaDurumu();
  if (k.kalan <= 0) {
    return bitir("kota-doldu",
      `Regrid günlük çağrı tavanı doldu (${k.harcanan}/${k.tavan}). Yarın sıfırlanır veya REGRID_DAILY_CAP artırılabilir.`);
  }

  const params = new URLSearchParams({ token, path: src.path, limit: String(cap) });
  if (search.owner?.trim()) params.set("owner", search.owner.trim());
  if (search.apn?.trim()) params.set("parcelnumb", search.apn.trim());

  let json: unknown;
  try {
    kota.harcanan += 1; // çağrı YAPILMADAN önce say — başarısız çağrı da kotadan düşer
    const res = await fetch(`${BASE}/parcels/query?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      kimlikBozuk = true; // devre kes — sonraki county'ler için çağrı yapılmaz
      return bitir("kimlik-hatasi",
        `Regrid kimlik doğrulaması başarısız (HTTP ${res.status}) — anahtarın süresi dolmuş olabilir. Yenilenene kadar bu county için ülke geneli yedek YOK.`,
        [], 0, false, 1);
    }
    if (!res.ok) {
      return bitir("servis-hatasi", `Regrid yanıt vermedi (HTTP ${res.status}).`, [], 0, false, 1);
    }
    json = await res.json();
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError"
      ? `Regrid ${TIMEOUT_MS / 1000}sn içinde yanıt vermedi.`
      : `Regrid'e ulaşılamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}`;
    return bitir("servis-hatasi", msg, [], 0, false, 1);
  }

  const feats = regridOzellikleri(json);
  const kw = (src.vacantKeywords ?? []).map((x) => x.toUpperCase());
  const rows: LiveCountyResult[] = [];
  const seen = new Set<string>();
  for (const p of feats) {
    const r = normalizeRegrid(p, homeState);
    if (!r || seen.has(r.apn)) continue;
    if (kw.length > 0) {
      const u = `${r.use} ${s(p.zoning)}`.toUpperCase();
      if (!kw.some((k2) => u.includes(k2))) continue;
    }
    seen.add(r.apn);
    rows.push(r);
  }

  // İstemci filtresi (posta eyaleti / değer aralığı) — ArcGIS ile aynı kural.
  const mst = search.mailingState?.trim().toUpperCase();
  const filtered = rows.filter((r) => {
    if (mst && r.mailing_state.toUpperCase() !== mst) return false;
    if (r.land_value != null) {
      if (search.minValue != null && r.land_value < search.minValue) return false;
      if (search.maxValue != null && r.land_value > search.maxValue) return false;
    }
    return true;
  });

  cacheYaz(key, filtered, feats.length);
  return bitir(
    filtered.length > 0 ? "ok" : "bos",
    filtered.length === 0 ? `${label}: Regrid çalıştı ama filtreye uyan parsel bulunamadı.` : undefined,
    filtered, feats.length, false, 1,
  );
}
