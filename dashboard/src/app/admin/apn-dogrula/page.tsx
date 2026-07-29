"use client";

/**
 * APN + TRS DOĞRULAMA — müşteri toplantısında "bu veriyi nereden biliyorsun?"
 * sorusuna canlı kanıtla cevap vermek için.
 *
 * İki mod:
 *   - APN girilirse: SOL "bizim kayıtlarımız" (rakip-satislar.json + mohave-
 *     offmarket.json + varsa rakip-ilan-fiyat.json, /api/admin/apn-dogrula'dan)
 *     vs SAĞ "resmî county kaydı" (Mohave ArcGIS, TARAYICIDAN — apn-sorgula
 *     sayfasıyla AYNI dürüst kısıt: residential IP gerekir, sunucudan timeout
 *     olur) + ALT "uyum kontrolü" (compareWithCounty).
 *   - TRS (Township-Range-Section, örn "26N 19W 31") girilirse: önceden
 *     hesaplanmış bölge özeti (trs-ozet.json, scraper/trs-ozet-uret.mjs ile
 *     tam county dökümünden üretilir).
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ShieldCheck, Loader2, Search, AlertTriangle, CheckCircle2, XCircle, HelpCircle, MapPin,
  Satellite, Map as MapIcon,
} from "lucide-react";
import type { Feature, FeatureCollection } from "geojson";
import {
  normalizeApnCandidates,
  detectQueryKind,
  buildOurRecordSummary,
  compareWithCounty,
  type RakipSatisLike,
  type MohaveOffmarketLike,
  type OurRecordSummary,
  type ComparisonRow,
  type TrsOzetKaydi,
} from "@/lib/apn-dogrula";
import { isPaketTapu, formatPaketAlimAciklama } from "@/lib/paket-tapu";

const ParcelMap = dynamic(() => import("../apn-sorgula/parcel-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

const QUERY_BASE = "https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/38/query";
const ACCENT = "#0891b2";

// Toplantıda hızlı demo için 3 gerçek APN (rakip-satislar.json'dan): tapulu satış / taksitte / stok.
const ORNEK_APNLER = [
  { apn: "313-46-122", label: "Tapulu satış" },
  { apn: "209-02-149", label: "Taksitli satış" },
  { apn: "207-02-037B", label: "Stokta (envanter)" },
];
const ORNEK_TRS = "26N 19W 31";

type ParcelProps = Record<string, string | number | null>;

function pick(props: ParcelProps, keys: string[]): string | number | null {
  for (const k of keys) {
    const hit = Object.keys(props).find((pk) => pk.toUpperCase() === k);
    if (hit != null && props[hit] != null && props[hit] !== "") return props[hit];
  }
  return null;
}

function centroidOf(feature: Feature): [number, number] | null {
  const coords: [number, number][] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      coords.push([c[0] as number, c[1] as number]);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  if (feature.geometry && "coordinates" in feature.geometry) {
    walk((feature.geometry as { coordinates: unknown }).coordinates);
  }
  if (!coords.length) return null;
  const sum = coords.reduce((a, [lng, lat]) => [a[0] + lng, a[1] + lat], [0, 0]);
  return [sum[1] / coords.length, sum[0] / coords.length];
}

async function queryMohave(field: string, value: string): Promise<FeatureCollection> {
  const where = `${field}='${value.replace(/'/g, "''")}'`;
  const params = new URLSearchParams({ where, outFields: "*", returnGeometry: "true", outSR: "4326", f: "geojson" });
  const res = await fetch(`${QUERY_BASE}?${params}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as FeatureCollection & { error?: { message?: string } };
  if (j?.error) throw new Error(j.error.message || "ArcGIS sorgu hatası");
  return j;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// ── County kaydının insan-okur alan projeksiyonu (eski /admin/apn-sorgula'dan taşındı) ──
// Sağ sütunda zaten OWNER / SALEP / SALEDT / PARCEL_SIZE / LANDVALUE satır satır
// gösteriliyor (uyum kontrolünün beslendiği 5 alan). Aşağıdaki liste bunların
// DIŞINDA kalan, sahip/adres/kullanım tarafındaki alanları etiketleyerek getirir.
const HIGHLIGHTS: { keys: string[]; label: string; fmt?: (v: string | number) => string }[] = [
  { keys: ["PARCEL", "APN", "PARCELNUM"], label: "APN / Parsel" },
  { keys: ["OWNER"], label: "Sahip" },
  { keys: ["OWNER_2"], label: "Sahip 2" },
  { keys: ["SITE_ADDRESS"], label: "Site (situs) adresi" },
  { keys: ["MAILING_ADDRESS"], label: "Posta adresi" },
  { keys: ["PARCEL_SIZE"], label: "Dönüm (acre)" },
  { keys: ["LANDVALUE"], label: "Arazi değeri", fmt: (v) => usd(Number(v)) },
  { keys: ["FULL_CASH_VALUE"], label: "Tam değer (full cash)", fmt: (v) => usd(Number(v)) },
  { keys: ["PROPUSE", "USE_CODE"], label: "Kullanım" },
  { keys: ["LEGAL_DESCRIPTION"], label: "Yasal tanım" },
];

// Yukarıdaki 5 karşılaştırma satırında zaten görünen alanlar — iki kez basmayalım.
const KARSILASTIRMADA_GOSTERILEN = new Set(["OWNER", "PARCEL_SIZE", "LANDVALUE", "SALEP", "SALEDT"]);

interface OurApiResponse {
  kind: "apn";
  apn: string;
  candidates: string[];
  rakipSatis: RakipSatisLike | null;
  mohave: MohaveOffmarketLike | null;
  ilan: { apn?: string | null } | null;
  summary: OurRecordSummary;
}

interface TrsApiResponse {
  kind: "trs";
  trs: string;
  ozet: TrsOzetKaydi | null;
}

const STATUS_ICON: Record<ComparisonRow["status"], React.ReactNode> = {
  match: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
  mismatch: <XCircle className="h-3.5 w-3.5 text-amber-600" />,
  unknown: <HelpCircle className="h-3.5 w-3.5 text-slate-300" />,
};

const ASSESSOR_URL = "https://www.mohavecounty.us/ContentPage.aspx?id=112&cid=1041"; // Assessor public search
const RECORDER_URL = "https://www.mohavecounty.us/ContentPage.aspx?id=112&cid=356"; // Recorder public search

export default function ApnDogrulaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Yükleniyor…</div>}>
      <ApnDogrulaInner />
    </Suspense>
  );
}

function ApnDogrulaInner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loadingOurs, setLoadingOurs] = useState(false);
  const [loadingCounty, setLoadingCounty] = useState(false);
  const [errorOurs, setErrorOurs] = useState<string | null>(null);
  const [errorCounty, setErrorCounty] = useState<string | null>(null);
  const [kind, setKind] = useState<"apn" | "trs" | null>(null);
  const [ourData, setOurData] = useState<OurApiResponse | null>(null);
  const [trsData, setTrsData] = useState<TrsApiResponse | null>(null);
  const [feature, setFeature] = useState<Feature | null>(null);
  const [usedQuery, setUsedQuery] = useState<string | null>(null);

  // overrideQuery: dışarıdan (ör. ?apn=... mount efekti, örnek butonlar) doğrudan
  // değer geçmek için — `query` state'inin re-render'ını beklemeden (stale closure
  // riskinden kaçınır: setQuery + hemen ardından onSearch çağrısı aynı event/efekt
  // içinde olduğunda state henüz güncellenmemiş olabilir).
  async function onSearch(e?: React.FormEvent, overrideQuery?: string) {
    e?.preventDefault();
    const q = overrideQuery ?? query;
    setErrorOurs(null);
    setErrorCounty(null);
    setOurData(null);
    setTrsData(null);
    setFeature(null);
    setUsedQuery(null);

    const k = detectQueryKind(q);
    if (k === "empty") {
      setErrorOurs("Lütfen bir APN (209-09-019) veya TRS (26N 19W 31) girin.");
      setKind(null);
      return;
    }
    setKind(k);

    if (k === "trs") {
      setLoadingOurs(true);
      try {
        const res = await fetch(`/api/admin/apn-dogrula?trs=${encodeURIComponent(q)}`);
        const j = (await res.json()) as TrsApiResponse;
        setTrsData(j);
        if (!j.ozet) setErrorOurs("Bu TRS için önceden hesaplanmış özet bulunamadı (trs-ozet.json'da yok).");
      } catch (err) {
        setErrorOurs("Bölge özeti alınamadı: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoadingOurs(false);
      }
      return;
    }

    // APN modu: bizim veri (server) + county (tarayıcı) PARALEL.
    setLoadingOurs(true);
    setLoadingCounty(true);

    const oursPromise = fetch(`/api/admin/apn-dogrula?apn=${encodeURIComponent(q)}`)
      .then((res) => res.json() as Promise<OurApiResponse>)
      .then((j) => setOurData(j))
      .catch((err) => setErrorOurs("Bizim veri sorgulanamadı: " + (err instanceof Error ? err.message : String(err))))
      .finally(() => setLoadingOurs(false));

    const candidates = normalizeApnCandidates(q);
    const countyPromise = (async () => {
      const attempts: { field: string; value: string }[] = [];
      for (const v of candidates) attempts.push({ field: "PARCEL", value: v });
      for (const v of candidates) attempts.push({ field: "APN", value: v });
      let lastErr: Error | null = null;
      let anySuccess = false;
      try {
        for (const a of attempts) {
          try {
            const fc = await queryMohave(a.field, a.value);
            anySuccess = true;
            if (fc.features && fc.features.length > 0) {
              setFeature(fc.features[0] as Feature);
              setUsedQuery(`${a.field}='${a.value}'`);
              return;
            }
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
          }
        }
        if (anySuccess) {
          setErrorCounty("Bu APN için county'de kayıt bulunamadı. Numarayı elle doğrulayın (linkler aşağıda).");
        } else if (lastErr?.name === "TimeoutError" || lastErr?.message?.includes("aborted")) {
          setErrorCounty("Sorgu zaman aşımına uğradı (Mohave GIS residential IP ister — VPN/ad-blocker kapatıp tekrar deneyin).");
        } else {
          setErrorCounty("Mohave GIS'e ulaşılamadı: " + (lastErr?.message ?? "bilinmiyor") + ". County sitesinde elle doğrulayın.");
        }
      } finally {
        setLoadingCounty(false);
      }
    })();

    await Promise.all([oursPromise, countyPromise]);
  }

  // Dış sayfalardan (ör. harita/lead popup'ı "🔍 APN Doğrula") ?apn=... veya ?trs=...
  // ile gelindiğinde otomatik sorgula — elle kopyala-yapıştır derdi olmasın.
  useEffect(() => {
    const fromApn = searchParams.get("apn");
    const fromTrs = searchParams.get("trs");
    const q = fromApn || fromTrs;
    if (!q) return;
    setQuery(q);
    onSearch(undefined, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function onOrnekApn(apn: string) {
    setQuery(apn);
    onSearch(undefined, apn);
  }
  function onOrnekTrs() {
    setQuery(ORNEK_TRS);
    onSearch(undefined, ORNEK_TRS);
  }

  const props = (feature?.properties ?? {}) as ParcelProps;
  const centroid = feature ? centroidOf(feature) : null;
  const countyOwner = pick(props, ["OWNER"]);
  const countySalep = pick(props, ["SALEP"]);
  const countySaledt = pick(props, ["SALEDT"]);
  const countySize = pick(props, ["PARCEL_SIZE"]);
  const countyLandValue = pick(props, ["LANDVALUE"]);

  // Uydu görüntüsü için parselin ağırlık merkezi (eski /admin/apn-sorgula'dan taşındı).
  const googleUrl = centroid
    ? `https://www.google.com/maps/search/?api=1&query=${centroid[0]},${centroid[1]}`
    : null;

  const comparison: ComparisonRow[] | null =
    ourData && feature
      ? compareWithCounty(ourData.summary, {
          owner: countyOwner,
          salep: countySalep,
          saledt: countySaledt,
          parcelSize: countySize,
          landValue: countyLandValue,
        })
      : null;

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
          <ShieldCheck className="h-3.5 w-3.5" /> APN / TRS Doğrulama · Bizim Veri vs Canlı County Kaydı
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">&quot;Bu veriyi nereden biliyorsun?&quot;</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bir <span className="font-semibold text-slate-700">APN</span> (parsel no) ya da{" "}
          <span className="font-semibold text-slate-700">TRS</span> (Township-Range-Section, örn &quot;26N 19W 31&quot;) girin —
          bizim kayıtlarımızı, <span className="font-semibold text-slate-700">Mohave County</span>&apos;nin canlı resmî kaydıyla
          yan yana görün.
        </p>

        {/* Arama kutusu */}
        <form onSubmit={onSearch} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="209-09-019  veya  26N 19W 31"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <button
            type="submit"
            disabled={loadingOurs || loadingCounty}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#0f172a" }}
          >
            {loadingOurs || loadingCounty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Doğrula
          </button>
        </form>

        {/* Örnek APN/TRS hızlı butonlar */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400">Örnekler:</span>
          {ORNEK_APNLER.map((o) => (
            <button
              key={o.apn}
              onClick={() => onOrnekApn(o.apn)}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono font-semibold text-slate-700 hover:bg-slate-50"
              title={o.label}
            >
              {o.apn} <span className="font-sans font-normal text-slate-400">· {o.label}</span>
            </button>
          ))}
          <button
            onClick={onOrnekTrs}
            type="button"
            className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 font-mono font-semibold hover:bg-cyan-100"
            style={{ color: ACCENT }}
          >
            {ORNEK_TRS} <span className="font-sans font-normal text-slate-400">· TRS bölge özeti</span>
          </button>
        </div>

        {/* Kaynak + dürüst not */}
        <div className="mt-3 space-y-1 text-[11px] text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Kaynak:</span> Mohave County Assessor —{" "}
            <a href={ASSESSOR_URL} target="_blank" rel="noopener noreferrer" className="underline">
              county sayfasında elle doğrula
            </a>
          </div>
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-amber-500" />
            <span>
              Sağ sütun tarayıcıdan yüklenir (residential IP); datacenter&apos;dan timeout olabilir. Şu an yalnızca Mohave County.
            </span>
          </div>
        </div>

        {errorOurs && !trsData && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorOurs}</div>
        )}

        {/* ── TRS modu: bölge özeti ─────────────────────────────────────── */}
        {kind === "trs" && trsData && trsData.ozet && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Bölge Özeti — {trsData.ozet.trs}</h2>
              <a
                href="/admin/alinabilir-harita"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MapPin className="h-3 w-3" /> Haritada gör
              </a>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Kaynak: Mohave County ParcelQueryLayer tam döküm (build-time önceden hesaplanmış — scraper/trs-ozet-uret.mjs)
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Toplam parsel" value={String(trsData.ozet.total)} />
              <Stat label="Boş arsa" value={String(trsData.ozet.vacant)} />
              <Stat label="Eyalet-dışı sahip" value={`${trsData.ozet.absentee} (${trsData.ozet.absenteePct}%)`} />
              <Stat label="Bizim lead havuzumuzdan" value={String(trsData.ozet.leadPoolCount)} />
              <Stat label="Medyan dönüm (acre)" value={trsData.ozet.medianAcres != null ? String(trsData.ozet.medianAcres) : "—"} />
              <Stat
                label="Medyan arazi değeri"
                value={trsData.ozet.medianLandValue != null ? usd(trsData.ozet.medianLandValue) : "—"}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold text-slate-700">En çok parselli sahipler</h3>
                <table className="mt-2 w-full text-[12px]">
                  <tbody>
                    {trsData.ozet.topOwners.map((o) => (
                      <tr key={o.owner} className="border-b border-slate-100 last:border-0">
                        <td className="py-1 pr-2 text-slate-700">{o.owner}</td>
                        <td className="py-1 text-right font-semibold text-slate-900">{o.count} parsel</td>
                      </tr>
                    ))}
                    {trsData.ozet.topOwners.length === 0 && (
                      <tr><td className="py-1 text-slate-400">Kayıt yok</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-700">Son satışlar (en yeni 10)</h3>
                <table className="mt-2 w-full text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400">
                      <th className="pb-1 text-left font-semibold">APN</th>
                      <th className="pb-1 text-left font-semibold">Alıcı</th>
                      <th className="pb-1 text-right font-semibold">Fiyat</th>
                      <th className="pb-1 text-right font-semibold">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trsData.ozet.recentSales.map((s) => (
                      <tr key={s.apn} className="border-b border-slate-100 last:border-0">
                        <td className="py-1 pr-2 font-mono text-slate-700">{s.apn}</td>
                        <td className="py-1 pr-2 text-slate-700">{s.owner}</td>
                        <td className="py-1 text-right font-semibold text-slate-900">
                          {usd(s.salep)}
                          {isPaketTapu(s.deedParcelCount) && s.birimFiyatTahmini != null && (
                            <div className="mt-0.5 text-[10px] font-normal text-amber-700">
                              {s.deedParcelCount} parsellik paket · birim ~{usd(s.birimFiyatTahmini)}
                            </div>
                          )}
                        </td>
                        <td className="py-1 text-right text-slate-500">{s.saledt.slice(0, 10)}</td>
                      </tr>
                    ))}
                    {trsData.ozet.recentSales.length === 0 && (
                      <tr><td className="py-1 text-slate-400" colSpan={4}>Kayıt yok</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {kind === "trs" && trsData && !trsData.ozet && !loadingOurs && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Bu TRS için özet bulunamadı. Format &quot;26N 19W 31&quot; gibi olmalı; veya bu bölge trs-ozet.json&apos;da yok (boş
            arsa yoğunluklu TRS&apos;ler tutuluyor).
          </div>
        )}

        {/* ── APN modu: sol/sağ + uyum kontrolü ────────────────────────────── */}
        {kind === "apn" && (loadingOurs || loadingCounty || ourData || feature) && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {/* SOL: Bizim kayıtlarımız */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Bizim Kayıtlarımız</h2>
                {loadingOurs && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
              {ourData?.summary && (
                <>
                  {ourData.summary.found ? (
                    <>
                      <dl className="mt-3 space-y-1.5">
                        <Row label="Sahip / karşı taraf" value={ourData.summary.ownerName} />
                        <Row label="Son satış fiyatı" value={ourData.summary.lastSalePrice != null ? usd(ourData.summary.lastSalePrice) : null} />
                        <Row label="Son satış tarihi" value={ourData.summary.lastSaleDate} />
                        <Row label="Dönüm (acre)" value={ourData.summary.acres != null ? String(ourData.summary.acres) : null} />
                        <Row label="Arazi değeri" value={ourData.summary.landValue != null ? usd(ourData.summary.landValue) : null} />
                      </dl>
                      {isPaketTapu(ourData.summary.deedParcelCount) &&
                        ourData.summary.lastSalePrice != null &&
                        ourData.summary.birimFiyatTahmini != null && (
                          <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                            {formatPaketAlimAciklama(
                              ourData.summary.lastSalePrice,
                              ourData.summary.lastSaleDate,
                              ourData.summary.deedParcelCount as number,
                              ourData.summary.birimFiyatTahmini,
                            )}
                          </div>
                        )}
                      {ourData.rakipSatis && (
                        <div className="mt-2 text-[11px] text-slate-500">
                          Kayıt tipi: <span className="font-semibold text-slate-700">{ourData.rakipSatis.kayitTipi}</span>
                          {ourData.rakipSatis.recordingNo && <> · Recording no: {ourData.rakipSatis.recordingNo}</>}
                        </div>
                      )}
                      {ourData.mohave && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          Posta adresi: {ourData.mohave.mailing_address}, {ourData.mohave.mailing_city} {ourData.mohave.mailing_state}
                          {ourData.mohave.mailing_zip} {ourData.mohave.score != null && <> · off-market skor: {ourData.mohave.score}</>}
                        </div>
                      )}
                      <div className="mt-3 text-[10px] text-slate-400">Kaynaklar: {ourData.summary.sources.join(", ")}</div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Bu APN hiçbir veri kaynağımızda bulunamadı.</p>
                  )}
                </>
              )}
            </div>

            {/* SAĞ: Resmî county kaydı (canlı) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Resmî County Kaydı (canlı)</h2>
                <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold" style={{ color: ACCENT }}>
                  authoritative
                </span>
              </div>
              {loadingCounty && (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Mohave GIS sorgulanıyor (tarayıcıdan)…
                </div>
              )}
              {errorCounty && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  {errorCounty}
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <a href={ASSESSOR_URL} target="_blank" rel="noopener noreferrer" className="underline">Assessor arama</a>
                    <a href={RECORDER_URL} target="_blank" rel="noopener noreferrer" className="underline">Recorder arama</a>
                  </div>
                </div>
              )}
              {feature && (
                <>
                  {usedQuery && <p className="mt-1 text-[10px] text-slate-400">eşleşen sorgu: <code>{usedQuery}</code></p>}
                  <dl className="mt-2 space-y-1.5">
                    <Row label="Sahip (OWNER)" value={countyOwner != null ? String(countyOwner) : null} />
                    <Row label="Son satış (SALEP)" value={countySalep != null ? usd(Number(countySalep)) : null} />
                    <Row label="Son satış tarihi (SALEDT)" value={countySaledt != null ? String(countySaledt) : null} />
                    <Row label="Dönüm (PARCEL_SIZE)" value={countySize != null ? String(countySize) : null} />
                    <Row label="Arazi değeri (LANDVALUE)" value={countyLandValue != null ? usd(Number(countyLandValue)) : null} />
                  </dl>

                  {/* Diğer county alanları — etiketli projeksiyon (apn-sorgula'dan taşındı) */}
                  {(() => {
                    const ekstra = HIGHLIGHTS.filter(
                      (h) => !h.keys.some((k) => KARSILASTIRMADA_GOSTERILEN.has(k)),
                    )
                      .map((h) => ({ h, v: pick(props, h.keys) }))
                      .filter((x) => x.v != null);
                    if (!ekstra.length) return null;
                    return (
                      <dl className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                        {ekstra.map(({ h, v }) => (
                          <Row
                            key={h.label}
                            label={h.label}
                            value={h.fmt ? h.fmt(v as string | number) : String(v)}
                          />
                        ))}
                      </dl>
                    );
                  })()}

                  {centroid && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ height: 220 }}>
                      <ParcelMap feature={feature} center={centroid} />
                    </div>
                  )}

                  {/* Aksiyon butonları (apn-sorgula'dan taşındı) */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {googleUrl && (
                      <a
                        href={googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Satellite className="h-3.5 w-3.5" /> 🛰️ Google&apos;da aç
                      </a>
                    )}
                    <a
                      href="/admin/alinabilir-harita"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <MapIcon className="h-3.5 w-3.5" /> 🗺️ Ana haritada gör
                    </a>
                  </div>

                  {/* Ham alanlar (dürüstlük: county'den gelen her şey) — apn-sorgula'dan taşındı */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
                      Tüm alanlar (ham GIS kaydı)
                    </summary>
                    <div className="mt-2 max-h-52 overflow-auto rounded-lg bg-slate-50 p-2">
                      <table className="w-full text-[11px]">
                        <tbody>
                          {Object.entries(props).map(([k, v]) => (
                            <tr key={k} className="border-b border-slate-100 last:border-0">
                              <td className="py-0.5 pr-3 font-mono text-slate-400">{k}</td>
                              <td className="py-0.5 text-slate-700">{v == null ? "—" : String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>
        )}

        {/* ALT: Uyum kontrolü */}
        {kind === "apn" && comparison && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Uyum Kontrolü</h2>
            <table className="mt-3 w-full text-[13px]">
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3 text-slate-500">{row.label}</td>
                    <td className="py-1.5 pr-3 text-slate-700">{row.ours ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-slate-700">{row.county ?? "—"}</td>
                    <td className="py-1.5 text-right">{STATUS_ICON[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Kaynak:</span> Mohave County Assessor —{" "}
              <a href={ASSESSOR_URL} target="_blank" rel="noopener noreferrer" className="underline">county sayfasına git</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}
