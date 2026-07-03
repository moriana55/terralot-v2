"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Radar,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Search,
  History,
  TrendingDown,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP RADAR — rakipler gerçekten SATIYOR mu, geçmiş satış performansları ne?
//
// competitor_listings tek başına "şu an ne görüyoruz"dur; bu ekran günlük
// snapshot + diff ile TARİH ekler: yeni ilan / fiyat indirimi / kaybolan ilan
// (= satış şüphesi) → Regrid malik kontrolü / Mohave Recorder ile doğrulama.
// Veri: /api/admin/rakip-radar (service role + gate). Salt gerçek veri —
// doğrulanmamış hiçbir şey "satış" diye gösterilmez.
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const fmtDate = (ts: string | null | undefined) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
};

interface PricePoint { at: string; price: number | null }
interface VerLink { label: string; url: string; note: string }
interface Row {
  listing_key: string;
  competitor: string | null;
  title: string | null;
  apn: string | null;
  url: string | null;
  state: string | null;
  county: string | null;
  acres: number | null;
  first_seen: string;
  last_seen: string;
  initial_price: number | null;
  current_price: number | null;
  price_history: PricePoint[];
  price_cuts: number;
  status: "ACTIVE" | "PENDING" | "SUSPECTED_SOLD" | "SOLD_VERIFIED" | "WITHDRAWN";
  disappeared_at: string | null;
  dom: number | null;
  sold_price: number | null;
  verification: { method: string; owner?: string | null; note?: string; checkedAt: string } | null;
  syntheticApn: boolean;
  links: VerLink[];
}
interface Perf {
  competitor: string; total: number; active: number; suspected: number;
  verifiedSold: number; withdrawn: number; avgDomAtSale: number | null;
  avgSoldPpa: number | null; cutShare: number; avgCutPct: number | null;
}
interface Bucket { label: string; sold: number; stale: number }
interface Ev { at: string; listing_key: string; type: string; delta: number | null }
interface Resp {
  summary: {
    activeCount: number; pendingCount: number; avgDomActive: number | null;
    lost30d: number; suspectedCount: number; verifiedSoldCount: number; withdrawnCount: number;
  };
  competitors: Perf[];
  histogram: Bucket[];
  listings: Row[];
  events: Ev[];
  lastRunAt: string | null;
  trackedCount: number;
  error?: string;
  hint?: string;
}

const STATUS_BADGE: Record<Row["status"], { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "AKTİF", color: "var(--accent-ink)", bg: "rgba(14,125,151,0.12)" },
  PENDING: { label: "PENDING", color: "var(--grade-c)", bg: "rgba(185,119,10,0.12)" },
  SUSPECTED_SOLD: { label: "SATIŞ ŞÜPHESİ", color: "var(--grade-c)", bg: "rgba(185,119,10,0.16)" },
  SOLD_VERIFIED: { label: "SATIŞ ✓", color: "var(--grade-a)", bg: "rgba(34,197,94,0.14)" },
  WITHDRAWN: { label: "ÇEKİLDİ", color: "var(--muted)", bg: "var(--surface-high)" },
};

// Fiyat geçmişi mini-sparkline (SVG). Tek nokta = düz çizgi.
function Sparkline({ history }: { history: PricePoint[] }) {
  const pts = history.filter((p) => p.price != null) as { at: string; price: number }[];
  if (pts.length === 0) return <span style={{ color: "var(--muted)" }}>—</span>;
  const w = 72, h = 20, pad = 2;
  const prices = pts.map((p) => p.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = max - min || 1;
  const xs = pts.length === 1 ? [w / 2] : pts.map((_, i) => pad + (i * (w - 2 * pad)) / (pts.length - 1));
  const ys = pts.map((p) => h - pad - ((p.price - min) / span) * (h - 2 * pad));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const falling = pts.length > 1 && pts[pts.length - 1].price < pts[0].price;
  return (
    <svg width={w} height={h} aria-label="fiyat geçmişi">
      <path d={pts.length === 1 ? `M${pad},${h / 2} L${w - pad},${h / 2}` : d} fill="none"
        stroke={falling ? "var(--grade-c)" : "var(--accent-ink)"} strokeWidth="1.5" />
      {pts.length > 1 && <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2" fill={falling ? "var(--grade-c)" : "var(--accent-ink)"} />}
    </svg>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="px-4 py-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
      <div className="text-2xl font-extrabold tabular-nums" style={{ color: warn ? "var(--grade-c)" : accent ? "var(--accent-ink)" : "var(--foreground)" }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function RakipRadarInner() {
  const params = useSearchParams();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // key of row being acted on / "refresh"
  const [flash, setFlash] = useState<string | null>(null);
  const [q, setQ] = useState(params.get("q") || "");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null); // expanded row

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/rakip-radar");
      const j = (await r.json()) as Resp;
      if (!r.ok) {
        setError(j.error ? `${j.error}${j.hint ? ` — ${j.hint}` : ""}` : `Sunucu ${r.status} döndü (oturum/gate olabilir).`);
      } else setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function refresh() {
    setBusy("refresh");
    setFlash(null);
    try {
      const r = await fetch("/api/admin/rakip-radar/refresh", { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        const parts = Object.entries(j.events as Record<string, number>).map(([k, n]) => `${k}: ${n}`);
        setFlash(`Snapshot alındı (${j.sourceCount} ilan). ${parts.length ? parts.join(" · ") : "Değişiklik yok."}`);
        await load();
      } else setFlash(`Hata: ${j.error || "refresh başarısız"}`);
    } catch (e) {
      setFlash(`Hata: ${e instanceof Error ? e.message : "refresh başarısız"}`);
    }
    setBusy(null);
  }

  async function verify(key: string) {
    setBusy(key);
    try {
      const r = await fetch("/api/admin/rakip-radar/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const j = await r.json();
      setFlash(j.ok ? `Regrid malik: ${j.owner} → ${j.ownerChanged ? "MALİK DEĞİŞMİŞ — satış doğrulandı" : "hâlâ rakip görünüyor"}` : `Doğrulanamadı: ${j.reason || j.error}`);
      await load();
    } catch (e) {
      setFlash(`Hata: ${e instanceof Error ? e.message : "verify başarısız"}`);
    }
    setBusy(null);
  }

  async function override(key: string, action: "sold" | "withdrawn" | "reopen") {
    let price: number | undefined;
    if (action === "sold") {
      const input = window.prompt("Satış fiyatı ($) — Recorder/Affidavit'te görülen (boş bırakılabilir):");
      if (input === null) return;
      const n = Number(input.replace(/[^0-9.]/g, ""));
      if (input.trim() && (!Number.isFinite(n) || n <= 0)) { setFlash("Geçersiz fiyat."); return; }
      if (input.trim()) price = n;
    }
    setBusy(key);
    try {
      const r = await fetch("/api/admin/rakip-radar/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, action, price }),
      });
      const j = await r.json();
      setFlash(j.ok ? "Kaydedildi." : `Hata: ${j.error}`);
      await load();
    } catch (e) {
      setFlash(`Hata: ${e instanceof Error ? e.message : "kaydedilemedi"}`);
    }
    setBusy(null);
  }

  const rows = useMemo(() => {
    let r = data?.listings ?? [];
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      r = r.filter((x) =>
        [x.title, x.competitor, x.apn, x.county, x.state]
          .some((f) => f && f.toLowerCase().includes(needle))
      );
    }
    if (statusFilter) r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [data, q, statusFilter]);

  const s = data?.summary;
  const historyAccumulating =
    !!data && data.summary.suspectedCount === 0 && data.summary.verifiedSoldCount === 0 &&
    data.events.every((e) => e.type === "NEW");
  const maxBar = Math.max(1, ...(data?.histogram ?? []).map((b) => Math.max(b.sold, b.stale)));
  const histEmpty = (data?.histogram ?? []).every((b) => b.sold === 0 && b.stale === 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Radar className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Rakip Radar — İlan Yaşam Döngüsü & Satış Doğrulama
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Rakip gerçekten SATIYOR mu? Kaybolan ilan = satış şüphesi → Regrid malik kontrolü + Mohave Recorder ile doğrula.
            {data?.lastRunAt ? ` Son snapshot: ${fmtDate(data.lastRunAt)}.` : ""}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={busy === "refresh"}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
        >
          {busy === "refresh" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Snapshot al & diff&apos;le
        </button>
      </div>

      {/* Dürüstlük notu */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-4"
        style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}>
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--grade-a)" }} />
        <span>
          <strong style={{ color: "var(--foreground)" }}>Kaybolan ilan otomatik &quot;satış&quot; SAYILMAZ</strong> — önce
          &quot;satış şüphesi&quot; olur. &quot;SATIŞ ✓&quot; yalnızca Regrid&apos;de malik değişimi görülünce ya da Recorder/Affidavit&apos;te
          deed bulunup manuel onaylanınca verilir. Rakip tapuya hiç girmeden satmış olabilir (assignment) — Recorder teyidi altın standart.
          Kaynak veri scraper&apos;dan gelir; scraper koşmadan alınan snapshot &quot;değişiklik yok&quot; gösterir.
        </span>
      </div>

      {historyAccumulating && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-4"
          style={{ background: "rgba(14,125,151,0.08)", border: "1px dashed var(--outline)", color: "var(--muted)" }}>
          <History className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent-ink)" }} />
          <span>
            <strong style={{ color: "var(--foreground)" }}>Tarih birikiyor</strong> — mevcut {data?.trackedCount} ilan ilk snapshot
            olarak kaydedildi. İlk gerçek diff (fiyat indirimi / kaybolan ilan) yarınki snapshot&apos;ta görünür; DOM sayaçları bugünden itibaren işler.
          </span>
        </div>
      )}

      {flash && (
        <div className="px-4 py-2.5 rounded-lg text-xs mb-4" style={{ background: "var(--surface-high)", border: "1px solid var(--outline)" }}>
          {flash}
        </div>
      )}

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

      {!loading && !error && data && s && (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Aktif rakip ilanı" value={String(s.activeCount + s.pendingCount)} accent />
            <Stat label="Ortalama DOM (aktif, gün)" value={s.avgDomActive != null ? String(s.avgDomActive) : "—"} />
            <Stat label="Son 30 gün kaybolan (satış şüphesi)" value={String(s.lost30d)} warn={s.lost30d > 0} />
            <Stat label="Doğrulanmış satış" value={String(s.verifiedSoldCount)} accent={s.verifiedSoldCount > 0} />
          </div>

          {/* Rakip geçmiş performans kartları */}
          <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
            <History className="w-4 h-4" style={{ color: "var(--muted)" }} /> Geçmiş Performans (rakip bazında)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {data.competitors.map((c) => (
              <div key={c.competitor} className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{c.competitor}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                    {c.total} ilan izleniyor
                  </span>
                </div>
                <div className="text-xs space-y-1" style={{ color: "var(--muted)" }}>
                  <div>Aktif: <strong style={{ color: "var(--foreground)" }}>{c.active}</strong> · Şüphe: <strong style={{ color: c.suspected ? "var(--grade-c)" : "var(--foreground)" }}>{c.suspected}</strong> · Çekildi: <strong style={{ color: "var(--foreground)" }}>{c.withdrawn}</strong></div>
                  <div>Doğrulanmış satış: <strong style={{ color: c.verifiedSold ? "var(--grade-a)" : "var(--foreground)" }}>{c.verifiedSold}</strong>
                    {c.avgDomAtSale != null && <> · Ort. satış süresi: <strong style={{ color: "var(--foreground)" }}>{c.avgDomAtSale} gün</strong></>}
                  </div>
                  <div>Satış $/acre: <strong style={{ color: "var(--foreground)" }}>{c.avgSoldPpa != null ? fmtMoney(c.avgSoldPpa) : "veri birikiyor"}</strong></div>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    İndirim davranışı: <strong style={{ color: "var(--foreground)" }}>
                      {c.cutShare > 0 ? `ilanların %${Math.round(c.cutShare * 100)}'i indirdi${c.avgCutPct != null ? ` (ort. %${c.avgCutPct})` : ""}` : "henüz indirim görülmedi"}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Fiyat bandı analizi */}
          <h2 className="text-sm font-bold mb-2">Fiyat Bandı Analizi — satılanlar vs çürüyenler ($/acre)</h2>
          <div className="rounded-xl border p-4 mb-6" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            {histEmpty ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Henüz veri yok — &quot;satılan&quot; için doğrulanmış satış, &quot;çürüyen&quot; için 60+ gün DOM gerekir.
                Snapshot&apos;lar biriktikçe bu grafik dolacak; hangi fiyat bandının gerçekten SATTIĞINI burada göreceksin.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.histogram.map((b) => (
                  <div key={b.label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 shrink-0 text-right tabular-nums" style={{ color: "var(--muted)" }}>{b.label}</span>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="h-2.5 rounded-sm" style={{ width: `${(b.sold / maxBar) * 100}%`, minWidth: b.sold ? 3 : 0, background: "var(--grade-a)" }} title={`Satılan: ${b.sold}`} />
                      <div className="h-2.5 rounded-sm" style={{ width: `${(b.stale / maxBar) * 100}%`, minWidth: b.stale ? 3 : 0, background: "var(--grade-c)" }} title={`Çürüyen: ${b.stale}`} />
                    </div>
                    <span className="w-14 shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>{b.sold}✓ / {b.stale}✗</span>
                  </div>
                ))}
                <div className="flex gap-4 pt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: "var(--grade-a)" }} />Satılan (doğrulanmış)</span>
                  <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: "var(--grade-c)" }} />Çürüyen (60+ gün, hâlâ listede)</span>
                </div>
              </div>
            )}
          </div>

          {/* Filtreler */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
              <Search className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ara: başlık / rakip / APN / county…"
                className="bg-transparent outline-none text-xs w-56"
                style={{ color: "var(--foreground)" }}
              />
            </div>
            {["", "SUSPECTED_SOLD", "ACTIVE", "PENDING", "SOLD_VERIFIED", "WITHDRAWN"].map((st) => (
              <button
                key={st || "all"}
                onClick={() => setStatusFilter(st)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{
                  background: statusFilter === st ? "var(--surface-high)" : "transparent",
                  border: "1px solid var(--outline)",
                  color: st ? STATUS_BADGE[st as Row["status"]].color : "var(--foreground)",
                }}
              >
                {st ? STATUS_BADGE[st as Row["status"]].label : "Tümü"}
              </button>
            ))}
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>{rows.length} / {data.trackedCount} ilan</span>
          </div>

          {/* Tablo */}
          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            <table className="w-full text-xs" style={{ minWidth: 900 }}>
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  <th className="px-4 py-2.5">İlan</th>
                  <th className="px-3 py-2.5">Fiyat</th>
                  <th className="px-3 py-2.5">Geçmiş</th>
                  <th className="px-3 py-2.5">DOM</th>
                  <th className="px-3 py-2.5">Durum</th>
                  <th className="px-3 py-2.5">Doğrulama / Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = STATUS_BADGE[r.status];
                  const suspicious = r.status === "SUSPECTED_SOLD";
                  const expanded = open === r.listing_key;
                  return (
                    <React.Fragment key={r.listing_key}>
                      <tr className="border-t" style={{ borderColor: "var(--outline)" }}>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                            {r.url ? (
                              <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
                                {r.title || "?"} <ExternalLink className="w-3 h-3" style={{ color: "var(--muted)" }} />
                              </a>
                            ) : (r.title || "?")}
                          </div>
                          <div style={{ color: "var(--muted)" }}>
                            {r.competitor} · {r.county ? `${r.county}, ` : ""}{r.state || "?"}
                            {r.acres ? ` · ${r.acres} ac` : ""}
                            {r.apn ? ` · APN ${r.apn}${r.syntheticApn ? " (sentetik)" : ""}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          <div className="font-semibold">{fmtMoney(r.sold_price ?? r.current_price)}</div>
                          {r.price_cuts > 0 && (
                            <div style={{ color: "var(--grade-c)" }}>{r.price_cuts} indirim{r.initial_price && r.current_price != null ? ` (ilk ${fmtMoney(r.initial_price)})` : ""}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5"><Sparkline history={r.price_history} /></td>
                        <td className="px-3 py-2.5 tabular-nums">{r.dom != null ? `${r.dom}g` : "—"}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: badge.bg, color: badge.color }}>
                            {r.status === "SOLD_VERIFIED" && <CheckCircle2 className="w-3 h-3" />}
                            {badge.label}
                          </span>
                          {r.verification && (
                            <div className="mt-1 text-[10px]" style={{ color: "var(--muted)" }} title={r.verification.note}>
                              {r.verification.method === "regrid-owner" ? `Regrid: ${r.verification.owner || "?"}` : "manuel"} · {fmtDate(r.verification.checkedAt)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {suspicious && (
                              <>
                                <button onClick={() => verify(r.listing_key)} disabled={busy === r.listing_key}
                                  className="px-2 py-1 rounded-md text-[10px] font-bold disabled:opacity-60"
                                  style={{ background: "rgba(14,125,151,0.12)", color: "var(--accent-ink)" }}
                                  title={r.syntheticApn ? "Gerçek APN yok — Regrid atlanır, manuel doğrula" : "Regrid'den güncel malik çek"}>
                                  {busy === r.listing_key ? "…" : "Regrid malik ✓"}
                                </button>
                                <button onClick={() => override(r.listing_key, "sold")} disabled={busy === r.listing_key}
                                  className="px-2 py-1 rounded-md text-[10px] font-bold disabled:opacity-60"
                                  style={{ background: "rgba(34,197,94,0.12)", color: "var(--grade-a)" }}>
                                  Satıldı onayla
                                </button>
                                <button onClick={() => override(r.listing_key, "withdrawn")} disabled={busy === r.listing_key}
                                  className="px-2 py-1 rounded-md text-[10px] font-bold disabled:opacity-60"
                                  style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                                  Çekildi
                                </button>
                              </>
                            )}
                            {(r.status === "SOLD_VERIFIED" || r.status === "WITHDRAWN") && (
                              <button onClick={() => override(r.listing_key, "reopen")} disabled={busy === r.listing_key}
                                className="px-2 py-1 rounded-md text-[10px] font-semibold disabled:opacity-60"
                                style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                                Geri al
                              </button>
                            )}
                            {r.links.length > 0 && (
                              <button onClick={() => setOpen(expanded ? null : r.listing_key)}
                                className="px-2 py-1 rounded-md text-[10px] font-semibold"
                                style={{ background: "var(--surface-high)", color: "var(--foreground)" }}>
                                {expanded ? "Linkleri gizle" : "Doğrulama linkleri"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-t" style={{ borderColor: "var(--outline)", background: "var(--surface-high)" }}>
                          <td colSpan={6} className="px-4 py-3">
                            <div className="space-y-2">
                              {r.links.map((l, i) => (
                                <div key={i} className="text-[11px]">
                                  <a href={l.url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-bold hover:underline"
                                    style={{ color: "var(--accent-ink)" }}>
                                    <ExternalLink className="w-3 h-3" /> {l.label}
                                  </a>
                                  <span style={{ color: "var(--muted)" }}> — {l.note}</span>
                                  {i === 0 && r.competitor && (
                                    <button
                                      onClick={() => { navigator.clipboard?.writeText(r.competitor || ""); setFlash(`"${r.competitor}" panoya kopyalandı — Recorder'da Grantor alanına yapıştır.`); }}
                                      className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                      style={{ background: "var(--surface)", border: "1px solid var(--outline)", color: "var(--foreground)" }}>
                                      Rakip adını kopyala
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--muted)" }}>Filtreye uyan ilan yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function RakipRadarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm" style={{ color: "var(--muted)" }}>Yükleniyor…</div>}>
      <RakipRadarInner />
    </Suspense>
  );
}
