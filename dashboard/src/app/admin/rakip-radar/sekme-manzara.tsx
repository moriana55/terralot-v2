"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Radar,
  Loader2,
  AlertCircle,
  Search,
  Upload,
  FileSpreadsheet,
  TrendingDown,
  BadgeCheck,
  ArrowUpRight,
  MapPin,
} from "lucide-react";
import Dropdown from "@/components/Dropdown";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP SATIŞ RADARI — üç katmanlı rakip istihbaratı, tek ekran:
//   1) RAKİP MANZARASI  → her rakip ŞU AN ne satıyor, hangi fiyata (291 ilandan,
//      hemen çalışır — diff birikmesi beklemez).
//   2) SATIŞ SİNYALİ    → bu hafta yeni / kaybolan (≈satıldı) / tahmini hız +
//      "Muhtemelen Satıldı" tablosu (rakip-radar snapshot'ları biriktikçe dolar).
//   3) DOĞRULANMIŞ SATIŞLAR → PropStream deed export'u CSV yükle → gerçek satışlar.
// Derin ilan-bazlı yaşam döngüsü + Recorder doğrulama: "Radar" sekmesi (?sekme=radar).
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
};

interface Landscape {
  competitor: string;
  activeCount: number;
  medianPrice: number | null;
  medianPpa: number | null;
  acresMin: number | null;
  acresMedian: number | null;
  acresMax: number | null;
  states: { key: string; n: number }[];
  counties: { key: string; n: number }[];
}
interface Signal {
  competitor: string;
  tracked: number;
  newThisWeek: number;
  lostThisWeek: number;
  suspectedTotal: number;
  velocityPerWeek: number | null;
}
interface Sold {
  listing_key: string;
  competitor: string | null;
  title: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  lastPrice: number | null;
  disappearedAt: string | null;
  domDays: number | null;
}
interface SalesStat {
  competitor: string;
  count: number;
  medianPrice: number | null;
  medianPpa: number | null;
  firstSale: string | null;
  lastSale: string | null;
  salesPerMonth: number | null;
}
interface Resp {
  landscape: Landscape[];
  listingCount: number;
  signals: Signal[];
  likelySold: Sold[];
  trackedCount: number;
  sales: SalesStat[];
  salesCount: number;
  salesInstalled: boolean;
  warnings: string[];
  error?: string;
  hint?: string;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
      {children}
    </span>
  );
}

// `?sekme=manzara` gövdesi (eski /admin/competitor-radar ekranı).
export default function SekmeManzara() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comp, setComp] = useState<string>("");
  const [stateF, setStateF] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/competitor-radar");
      const j = (await r.json()) as Resp;
      if (!r.ok) setError(j.error ? `${j.error}${j.hint ? ` — ${j.hint}` : ""}` : `Sunucu ${r.status} döndü (oturum/gate olabilir).`);
      else setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const competitorNames = useMemo(() => {
    const set = new Set<string>();
    data?.landscape.forEach((l) => set.add(l.competitor));
    data?.sales.forEach((s) => set.add(s.competitor));
    return [...set].sort();
  }, [data]);
  const stateNames = useMemo(() => {
    const set = new Set<string>();
    data?.landscape.forEach((l) => l.states.forEach((s) => set.add(s.key)));
    return [...set].sort();
  }, [data]);

  const landscape = useMemo(() => {
    let ls = data?.landscape ?? [];
    if (comp) ls = ls.filter((l) => l.competitor === comp);
    if (stateF) ls = ls.filter((l) => l.states.some((s) => s.key === stateF));
    return ls;
  }, [data, comp, stateF]);
  const signals = useMemo(() => (comp ? (data?.signals ?? []).filter((s) => s.competitor === comp) : data?.signals ?? []), [data, comp]);
  const sold = useMemo(() => {
    let s = data?.likelySold ?? [];
    if (comp) s = s.filter((x) => x.competitor === comp);
    if (stateF) s = s.filter((x) => x.state === stateF);
    return s;
  }, [data, comp, stateF]);
  const sales = useMemo(() => (comp ? (data?.sales ?? []).filter((s) => s.competitor === comp) : data?.sales ?? []), [data, comp]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Radar className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Rakip Satış Radarı
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
            Her rakip <strong>şu an ne satıyor</strong> (canlı ilanlar), <strong>ne kayboluyor</strong> (≈satıldı sinyali) ve
            PropStream ile <strong>doğrulanmış satışlar</strong> — tek ekranda. İlan-bazlı yaşam döngüsü ve Recorder doğrulaması için{" "}
            <Link href="/admin/rakip-radar?sekme=radar" className="underline" style={{ color: "var(--accent-ink)" }}>Rakip Radar (satış takibi)</Link>.
          </p>
        </div>
      </div>

      {/* Filtreler — native <select> yerine ortak Dropdown bileşeni */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Dropdown
          className="w-52"
          size="sm"
          aria-label="Rakip filtresi"
          placeholder="Tüm rakipler"
          icon={<Search className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />}
          value={comp}
          onChange={setComp}
          options={[{ value: "", label: "Tüm rakipler" }, ...competitorNames.map((c) => ({ value: c, label: c }))]}
        />
        <Dropdown
          className="w-44"
          size="sm"
          aria-label="Eyalet filtresi"
          placeholder="Tüm eyaletler"
          icon={<MapPin className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />}
          value={stateF}
          onChange={setStateF}
          options={[{ value: "", label: "Tüm eyaletler" }, ...stateNames.map((s) => ({ value: s, label: s }))]}
        />
        {(comp || stateF) && (
          <button onClick={() => { setComp(""); setStateF(""); }} className="text-[11px] px-2 py-1 rounded-md" style={{ color: "var(--muted)", border: "1px solid var(--outline)" }}>
            Filtreyi temizle
          </button>
        )}
        {data && <span className="text-[11px]" style={{ color: "var(--muted)" }}>{data.listingCount} canlı ilan · {data.trackedCount} izleniyor · {data.salesCount} doğrulanmış satış</span>}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Radar yükleniyor…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4" style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.warnings.length > 0 && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-4" style={{ background: "rgba(185,119,10,0.08)", border: "1px dashed var(--outline)", color: "var(--muted)" }}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--grade-c)" }} />
              <ul className="space-y-0.5">{data.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          {/* ── 1) RAKİP MANZARASI ──────────────────────────────────────── */}
          <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5">
            <Radar className="w-4 h-4" style={{ color: "var(--accent-ink)" }} /> Rakip Manzarası — şu an ne satılıyor
          </h2>
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>Canlı scraper ilanlarından anlık kesit. Diff birikmesini beklemez.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {landscape.map((l) => (
              <Card key={l.competitor}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{l.competitor}</span>
                  <Chip>{l.activeCount} aktif ilan</Chip>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="px-2.5 py-2 rounded-lg" style={{ background: "var(--surface-high)" }}>
                    <div className="text-base font-extrabold tabular-nums" style={{ color: "var(--accent-ink)" }}>{fmtMoney(l.medianPrice)}</div>
                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>medyan fiyat</div>
                  </div>
                  <div className="px-2.5 py-2 rounded-lg" style={{ background: "var(--surface-high)" }}>
                    <div className="text-base font-extrabold tabular-nums" style={{ color: "var(--foreground)" }}>{l.medianPpa != null ? `${fmtMoney(l.medianPpa)}` : "—"}</div>
                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>medyan $/acre</div>
                  </div>
                </div>
                <div className="text-[11px] space-y-1" style={{ color: "var(--muted)" }}>
                  <div>Dönüm: <strong style={{ color: "var(--foreground)" }}>{l.acresMin ?? "—"} – {l.acresMax ?? "—"} ac</strong>{l.acresMedian != null && <> (medyan {l.acresMedian})</>}</div>
                  <div className="flex flex-wrap gap-1 items-center">Eyalet: {l.states.length ? l.states.map((s) => <Chip key={s.key}>{s.key} {s.n}</Chip>) : "—"}</div>
                  <div className="flex flex-wrap gap-1 items-center">County: {l.counties.length ? l.counties.map((c) => <Chip key={c.key}>{c.key} {c.n}</Chip>) : "—"}</div>
                </div>
              </Card>
            ))}
            {landscape.length === 0 && <div className="text-xs" style={{ color: "var(--muted)" }}>Filtreye uyan rakip yok.</div>}
          </div>

          {/* ── 2) SATIŞ SİNYALİ ────────────────────────────────────────── */}
          <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4" style={{ color: "var(--grade-c)" }} /> Satış Sinyali — kaybolan ilan ≈ satıldı
          </h2>
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
            Günlük snapshot diff&apos;lerinden. Kaybolan ilan otomatik &quot;satış&quot; sayılmaz — güçlü bir <strong>sinyaldir</strong>; kesin teyit için Recorder/PropStream.
          </p>
          {data.trackedCount === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-xs mb-8" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
              Henüz izleme geçmişi yok. <Link href="/admin/rakip-radar?sekme=radar" className="underline" style={{ color: "var(--accent-ink)" }}>Rakip Radar</Link>&apos;da &quot;Snapshot al &amp; diff&apos;le&quot; ile ilk snapshot alınınca DOM sayaçları başlar; kaybolan ilanlar ertesi koşudan itibaren burada görünür.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {signals.map((s) => (
                  <Card key={s.competitor}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{s.competitor}</span>
                      <Chip>{s.tracked} izleniyor</Chip>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-lg font-extrabold tabular-nums" style={{ color: "var(--accent-ink)" }}>{s.newThisWeek}</div><div className="text-[9px]" style={{ color: "var(--muted)" }}>bu hafta yeni</div></div>
                      <div><div className="text-lg font-extrabold tabular-nums" style={{ color: s.lostThisWeek ? "var(--grade-c)" : "var(--foreground)" }}>{s.lostThisWeek}</div><div className="text-[9px]" style={{ color: "var(--muted)" }}>hafta kaybolan</div></div>
                      <div><div className="text-lg font-extrabold tabular-nums" style={{ color: "var(--foreground)" }}>{s.velocityPerWeek ?? "—"}</div><div className="text-[9px]" style={{ color: "var(--muted)" }}>tah. satış/hafta</div></div>
                    </div>
                    {s.suspectedTotal > 0 && <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>Toplam satış şüphesi: <strong style={{ color: "var(--grade-c)" }}>{s.suspectedTotal}</strong></div>}
                  </Card>
                ))}
              </div>

              {/* Muhtemelen Satıldı tablosu */}
              <div className="rounded-xl border overflow-x-auto mb-8" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                <div className="px-4 py-2.5 text-xs font-bold border-b" style={{ borderColor: "var(--outline)" }}>Muhtemelen Satıldı ({sold.length})</div>
                <table className="w-full text-xs" style={{ minWidth: 720 }}>
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                      <th className="px-4 py-2">İlan</th><th className="px-3 py-2">Rakip</th><th className="px-3 py-2">Konum</th>
                      <th className="px-3 py-2">Dönüm</th><th className="px-3 py-2">Son fiyat</th><th className="px-3 py-2">Kaybolma</th><th className="px-3 py-2">DOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sold.map((r) => (
                      <tr key={r.listing_key} className="border-t" style={{ borderColor: "var(--outline)" }}>
                        <td className="px-4 py-2 font-semibold" style={{ color: "var(--foreground)" }}>{r.title || "?"}</td>
                        <td className="px-3 py-2">{r.competitor}</td>
                        <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{r.county ? `${r.county}, ` : ""}{r.state || "?"}</td>
                        <td className="px-3 py-2 tabular-nums">{r.acres ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums font-semibold">{fmtMoney(r.lastPrice)}</td>
                        <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{fmtDate(r.disappearedAt)}</td>
                        <td className="px-3 py-2 tabular-nums">{r.domDays != null ? `${r.domDays}g` : "—"}</td>
                      </tr>
                    ))}
                    {sold.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>Henüz kaybolan (satış şüpheli) ilan yok.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── 3) DOĞRULANMIŞ SATIŞLAR (PropStream) ─────────────────────── */}
          <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5">
            <BadgeCheck className="w-4 h-4" style={{ color: "var(--grade-a)" }} /> Doğrulanmış Satışlar — PropStream deed importu
          </h2>
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
            Bir rakip LLC&apos;nin PropStream deed/satış geçmişini export edip yükle → gerçek satışlar (adet, medyan fiyat, tarih aralığı, hız).
          </p>

          <ImportBox onDone={load} />

          {sales.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {sales.map((s) => (
                <Card key={s.competitor}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{s.competitor}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(34,197,94,0.14)", color: "var(--grade-a)" }}>
                      <BadgeCheck className="w-3 h-3" /> {s.count} satış ✓
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1" style={{ color: "var(--muted)" }}>
                    <div>Medyan fiyat: <strong style={{ color: "var(--foreground)" }}>{fmtMoney(s.medianPrice)}</strong>{s.medianPpa != null && <> · {fmtMoney(s.medianPpa)}/acre</>}</div>
                    <div>Tarih aralığı: <strong style={{ color: "var(--foreground)" }}>{fmtDate(s.firstSale)} – {fmtDate(s.lastSale)}</strong></div>
                    <div className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Satış hızı: <strong style={{ color: "var(--foreground)" }}>{s.salesPerMonth != null ? `${s.salesPerMonth}/ay` : "—"}</strong></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-5 text-xs mt-4" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
              {data.salesInstalled
                ? "Henüz doğrulanmış satış yok — yukarıdan bir PropStream CSV yükle."
                : "competitor_sales tablosu henüz yok. sql/competitor_sales.sql uygulandıktan sonra CSV yükleyebilirsin."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── PropStream CSV import kutusu ──────────────────────────────────────────────
function ImportBox({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File | null) {
    if (!f) return;
    setFileName(f.name);
    setCsv(await f.text());
    setMsg(null);
    setOk(null);
    // Dosya adından rakip adı tahmini (kullanıcı düzeltebilir)
    if (!competitor) {
      const guess = f.name.replace(/\.csv$/i, "").replace(/[_-]+/g, " ").trim();
      if (guess) setCompetitor(guess);
    }
  }

  async function submit() {
    if (!csv.trim()) { setMsg("Önce bir CSV seç."); setOk(false); return; }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/competitor-radar/import-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, competitor: competitor.trim() || undefined }),
      });
      const j = await r.json();
      if (j.ok) {
        setOk(true);
        setMsg(`${j.upserted} satış içe aktarıldı${j.skipped ? ` · ${j.skipped} satır atlandı` : ""}. Eşlenen kolonlar: ${Object.entries(j.detected || {}).map(([f, h]) => `${f}=${h}`).join(", ") || "—"}`);
        setCsv(""); setFileName(""); if (inputRef.current) inputRef.current.value = "";
        onDone();
      } else {
        setOk(false);
        setMsg(`${j.error}${j.hint ? ` — ${j.hint}` : ""}${j.detected ? ` (bulunan: ${Object.entries(j.detected).map(([f, h]) => `${f}=${h}`).join(", ")})` : ""}`);
      }
    } catch (e) {
      setOk(false);
      setMsg(e instanceof Error ? e.message : "yüklenemedi");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
      <div className="flex items-center gap-2 mb-3">
        <FileSpreadsheet className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
        <span className="text-sm font-bold">PropStream Satış İçe Aktar</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="text-xs"
          style={{ color: "var(--muted)" }}
        />
        <input
          value={competitor}
          onChange={(e) => setCompetitor(e.target.value)}
          placeholder="Rakip adı (ör. Rina Land) — boşsa Grantor kullanılır"
          className="text-xs px-3 py-1.5 rounded-lg outline-none w-72"
          style={{ background: "var(--surface-high)", border: "1px solid var(--outline)", color: "var(--foreground)" }}
        />
        <button
          onClick={submit}
          disabled={busy || !csv}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ background: "var(--accent-ink)", color: "var(--background)" }}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {busy ? "Yükleniyor…" : "İçe Aktar"}
        </button>
        {fileName && <span className="text-[11px]" style={{ color: "var(--muted)" }}>{fileName}</span>}
      </div>
      {msg && (
        <div className="text-[11px] px-3 py-2 rounded-lg mb-2" style={{ background: "var(--surface-high)", color: ok ? "var(--grade-a)" : "var(--grade-c)" }}>
          {msg}
        </div>
      )}
      <details className="text-[11px]" style={{ color: "var(--muted)" }}>
        <summary className="cursor-pointer">Beklenen CSV kolonları (esnek eşleme)</summary>
        <div className="mt-2 space-y-1">
          <p>PropStream export&apos;unda kolon adları değişebilir; aşağıdaki alanlar otomatik eşlenir (herhangi bir varyant yeterli):</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>Grantor / Seller</strong> — satıcı LLC (rakip). En kritik alan.</li>
            <li><strong>Sale Date / Recording Date / Transfer Date</strong> — satış tarihi.</li>
            <li><strong>Sale Price / Sale Amount</strong> — satış bedeli.</li>
            <li><strong>APN / Parcel Number</strong>, <strong>Acres / Acreage</strong>, <strong>County</strong>, <strong>State</strong>, <strong>Deed Type / Document Type</strong>, <strong>Grantee / Buyer</strong> (bilgi).</li>
          </ul>
          <p>En az (Grantor <em>veya</em> APN) + (Sale Date <em>veya</em> Sale Price) olmalı. Aynı satış (rakip+APN+tarih+fiyat) tekrar yüklenirse üzerine yazılır — güvenle tekrar yükleyebilirsin.</p>
        </div>
      </details>
    </div>
  );
}
