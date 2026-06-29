"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Target,
  Loader2,
  AlertCircle,
  RefreshCw,
  Download,
  Map as MapIcon,
  ShieldCheck,
} from "lucide-react";
import { nearestRef } from "@/lib/geo-proximity";

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 SATILABİLİR ÇEKİRDEK — ~20K Mohave lead'inden GERÇEKTEN önce mektup
// atılacak / satılacak EN İYİ ~500 parseli süzer. 20K çöpe mektup atmak yerine
// kanıtlı-pazar + düz-ish + yol-erişimli + en iyi spread olanları öne çıkarır.
//
// DÜRÜSTLÜK: "düz" ve "erişim" YAKLAŞIK proxy'dir (platted subdivision +
// sabit-referans mesafe). Gerçek eğim ileride elevation API ile gelecek.
// Konum situs adresinden, yoksa region+state'ten kurulur. Uydurma değer yok —
// değer/teklif/spread doğrudan all-deals comp motorundan gelir.
// ─────────────────────────────────────────────────────────────────────────────

// ── CORE kriter sabitleri (ayarlanabilir) ──────────────────────────────────
// Kanıtlı-pazar bölge anahtar kelimeleri (region içinde, küçük harf eşleşme).
const PROVEN_MARKET_KEYWORDS = ["golden valley", "meadview", "dolan springs", "yucca"];
// Satılabilir parsel boyutu (dönüm aralığı).
const MIN_ACRES = 0.9;
const MAX_ACRES = 2.6;
// Yol/şehir erişimi: sabit-referans mesafe eşiği (mil).
const ACCESS_MILES = 25;
// Varsayılan çekirdek boyutu.
const DEFAULT_N = 500;

type MapPoint = {
  id: string;
  lat: number | null;
  lng: number | null;
  owner: string;
  region: string;
  acres: number;
  marketValue: number | null;
  estOffer: number;
  spread: number;
  dealGrade: string | null;
  absentee: boolean;
  apn: string;
  address: string;
  county: string;
  state: string;
  valBasis: string;
  comps: number;
};

type ApiResp = { total: number; mapped: number; points: MapPoint[] };

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const fmtAcres = (n: number) => (n > 0 ? `${n} ac` : "—");

function isProvenMarket(region: string): boolean {
  const r = (region || "").toLowerCase();
  return PROVEN_MARKET_KEYWORDS.some((k) => r.includes(k));
}

// Yol/şehir erişimi YAKLAŞIK: en yakın highway VEYA şehir referansı ≤ eşik mil.
function hasRoadAccess(lat: number, lng: number): boolean {
  const hwy = nearestRef(lat, lng, "highway");
  const city = nearestRef(lat, lng, "city");
  return (
    (hwy != null && hwy.miles <= ACCESS_MILES) ||
    (city != null && city.miles <= ACCESS_MILES)
  );
}

// Çekirdeğe giren parsel mi? (koordinat varsa).
function isCore(p: MapPoint): boolean {
  if (p.lat == null || p.lng == null) return false;
  if (!isProvenMarket(p.region)) return false;
  if (!(p.acres >= MIN_ACRES && p.acres <= MAX_ACRES)) return false;
  if (!hasRoadAccess(p.lat, p.lng)) return false;
  if (!(p.owner || "").trim()) return false; // mailable: sahip mevcut
  return true;
}

// Konum metni: situs adresi varsa onu, yoksa region + state.
function locationOf(p: MapPoint): string {
  const situs = (p.address || "").trim();
  const fallback = [p.region, p.state].filter(Boolean).join(", ");
  return situs || fallback || "—";
}

function buildCsv(rows: MapPoint[]): string {
  const head = [
    "sira",
    "owner",
    "situs",
    "region",
    "county",
    "state",
    "apn",
    "acres",
    "marketValue",
    "estOffer",
    "spread",
    "lat",
    "lng",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((p, i) =>
    [
      i + 1,
      p.owner,
      (p.address || "").trim(),
      p.region,
      p.county,
      p.state,
      p.apn,
      p.acres,
      p.marketValue ?? "",
      p.estOffer,
      p.spread,
      p.lat ?? "",
      p.lng ?? "",
    ]
      .map(esc)
      .join(",")
  );
  return [head.join(","), ...lines].join("\n");
}

export default function SatilabilirCekirdekPage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [totalApi, setTotalApi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topN, setTopN] = useState(DEFAULT_N);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/all-deals?map=1&sort=spread&dir=desc");
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: ApiResp = await res.json();
      setPoints(Array.isArray(data.points) ? data.points : []);
      setTotalApi(data.total ?? data.points?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri alınamadı");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }

  // Çekirdek: kriterleri geçenler → spread'e göre azalan → ilk N.
  const core = useMemo(() => {
    const filtered = points.filter(isCore);
    filtered.sort((a, b) => (b.spread || 0) - (a.spread || 0));
    return filtered;
  }, [points]);

  const shown = useMemo(
    () => core.slice(0, Math.max(0, topN || 0)),
    [core, topN]
  );

  function downloadCsv() {
    const csv = buildCsv(shown);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terralot-satilabilir-cekirdek-${shown.length}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Toplam taranan = haritaya gelen koordinatlı parsel sayısı (API map modu).
  const scanned = points.length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Target className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            🎯 Satılabilir Çekirdek — Önce Bunlara Mektup At
          </h1>
          <p className="text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
            20K çöp lead&apos;e mektup atmak yerine: kanıtlı-pazar + satılabilir
            boyut + yol-erişimli + en iyi spread olan EN İYİ {topN.toLocaleString("en-US")}{" "}
            parseli süzer. Mektup/satış listeniz budur.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
        >
          <RefreshCw className="w-4 h-4" /> Yenile
        </button>
      </div>

      {/* Dürüstlük notu */}
      <div
        className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-5"
        style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}
      >
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--grade-a)" }} />
        <span>
          <strong style={{ color: "var(--foreground)" }}>
            &quot;Düz&quot; ve &quot;erişim&quot; YAKLAŞIK proxy&apos;dir
          </strong>{" "}
          (platted subdivision + sabit-referans mesafe; gerçek eğim ileride
          elevation ile gelecek). Konum situs adresinden, yoksa region+state&apos;ten
          kurulur. Kriterler:{" "}
          <em>
            kanıtlı-pazar [{PROVEN_MARKET_KEYWORDS.join(", ")}] · {MIN_ACRES}–
            {MAX_ACRES} dönüm · highway veya şehir ≤ {ACCESS_MILES} mi · sahip mevcut
          </em>
          , sonra spread&apos;e göre sıralanıp ilk {topN.toLocaleString("en-US")} alınır.
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Parseller yükleniyor…
        </div>
      )}

      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}
        >
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Özet + kontroller */}
          <div className="flex items-center gap-3 mb-5 flex-wrap text-sm">
            <Stat
              label="parsel çekirdekte"
              value={`${core.length.toLocaleString("en-US")} / ${scanned.toLocaleString("en-US")}`}
              accent
            />
            <Stat label="listede gösterilen" value={shown.length.toLocaleString("en-US")} />
            <Stat label="taranan (API toplam)" value={totalApi.toLocaleString("en-US")} />

            <label
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{ color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--outline)" }}
            >
              Top N
              <input
                type="number"
                min={1}
                max={5000}
                value={topN}
                onChange={(e) => setTopN(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 px-2 py-1 rounded-md text-sm tabular-nums"
                style={{ background: "var(--surface-high)", border: "1px solid var(--outline)", color: "var(--foreground)" }}
              />
            </label>

            <button
              onClick={downloadCsv}
              disabled={shown.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: "rgba(57,128,244,0.1)", color: "var(--primary)" }}
              title="Mektuba hazır kolonlarla CSV indir"
            >
              <Download className="w-3.5 h-3.5" /> ⬇ CSV indir
            </button>
          </div>

          {/* Boş durum */}
          {shown.length === 0 ? (
            <div
              className="text-center py-20 rounded-xl border border-dashed"
              style={{ borderColor: "var(--outline)", color: "var(--muted)" }}
            >
              <p className="text-sm font-medium mb-1">Çekirdeğe giren parsel yok</p>
              <p className="text-xs">
                Kriterleri karşılayan koordinatlı parsel bulunamadı (kanıtlı-pazar +{" "}
                {MIN_ACRES}–{MAX_ACRES} dönüm + erişim + sahip). Veri büyüdükçe veya
                kriterleri gevşettikçe bu liste dolar.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                    {["#", "Sahip", "Konum", "Dönüm", "Piyasa Değeri", "Teklif", "Spread", "APN", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: "var(--muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => (
                    <tr
                      key={p.id}
                      className="border-b transition-colors hover:bg-white/[0.02] align-top"
                      style={{ borderColor: "var(--outline)" }}
                    >
                      <td className="px-4 py-3 tabular-nums" style={{ color: "var(--muted)" }}>
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{p.owner || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>{locationOf(p)}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                          {[p.region, p.county, p.state].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{fmtAcres(p.acres)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtMoney(p.marketValue)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtMoney(p.estOffer)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold" style={{ color: "var(--grade-a)" }}>
                          {p.spread > 0 ? fmtMoney(p.spread) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                        {p.apn || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href="/admin/alinabilir-harita"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                          style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
                          title="Alınabilir Harita'da gör"
                        >
                          <MapIcon className="w-3 h-3" /> haritada gör
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="px-3.5 py-2 rounded-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
    >
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color: accent ? "var(--accent-ink)" : "var(--foreground)" }}
      >
        {value}
      </span>{" "}
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}
