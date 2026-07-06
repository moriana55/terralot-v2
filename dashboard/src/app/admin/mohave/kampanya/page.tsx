"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Loader2, Download, Filter, Users, MapPin, DollarSign, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE MEKTUP KAMPANYA KURUCU (admin, Türkçe)
// 20K off-market lead → segment seç → aynı sahip+adres TEK mektup (dedupe) →
// Lob-ready CSV indir. Rakamlar /api/admin/mohave-campaign'den (gerçek county
// verisi); uydurma yok. est_offer İÇ bilgidir, sadece bu gated ekranda.
// ─────────────────────────────────────────────────────────────────────────────

interface Letter {
  owner: string; address: string; city: string; state: string; zip: string;
  parcelCount: number; apns: string[]; totalAcres: number; totalOffer: number; regions: string[];
}
interface ApiResp {
  summary: { letters: number; parcels: number; totalAcres: number; totalOffer: number; skippedNoAddress: number; sourceRows: number };
  regions: string[];
  preview: Letter[];
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const GREEN = "#16a34a";

// Hazır segment reçeteleri — Ahmet tek tıkla anlamlı kampanya seçsin.
const PRESETS: { label: string; desc: string; f: Record<string, string> }[] = [
  { label: "🏜️ Absentee 1–5 acre", desc: "Eyalet dışı sahip, satılması en kolay boy", f: { ownerScope: "absentee", minAcres: "1", maxAcres: "5" } },
  { label: "📦 Toptancılar (5+ parsel)", desc: "Tek mektupla portföy teklifi", f: { minParcels: "5" } },
  { label: "💸 Ucuz lotlar (LV ≤ $1000)", desc: "Düşük vergi değeri → düşük teklif, hızlı evet", f: { maxLandValue: "1000", ownerScope: "absentee" } },
];

export default function MohaveKampanyaPage() {
  const [region, setRegion] = useState("");
  const [ownerScope, setOwnerScope] = useState("absentee");
  const [minAcres, setMinAcres] = useState("");
  const [maxAcres, setMaxAcres] = useState("");
  const [maxLandValue, setMaxLandValue] = useState("");
  const [minParcels, setMinParcels] = useState("");
  const [costPer, setCostPer] = useState("0.89");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (region) p.set("region", region);
    if (ownerScope !== "all") p.set("ownerScope", ownerScope);
    if (minAcres) p.set("minAcres", minAcres);
    if (maxAcres) p.set("maxAcres", maxAcres);
    if (maxLandValue) p.set("maxLandValue", maxLandValue);
    if (minParcels) p.set("minParcels", minParcels);
    return p.toString();
  }, [region, ownerScope, minAcres, maxAcres, maxLandValue, minParcels]);

  // setLoading(true) çağıranın sorumluluğunda (effect içinde senkron setState
  // lint'e takılır — tax-leads ile aynı desen).
  const load = useCallback(() => {
    fetch(`/api/admin/mohave-campaign?${qs()}`)
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((j: ApiResp) => { setData(j); setErr(null); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => { load(); /* ilk yük — loading zaten true başlar */ }, [load]);

  const applyPreset = (f: Record<string, string>) => {
    setRegion(f.region ?? "");
    setOwnerScope(f.ownerScope ?? "all");
    setMinAcres(f.minAcres ?? "");
    setMaxAcres(f.maxAcres ?? "");
    setMaxLandValue(f.maxLandValue ?? "");
    setMinParcels(f.minParcels ?? "");
  };

  const s = data?.summary;
  const cost = s ? s.letters * (Number(costPer) || 0) : 0;

  const inputCls = "w-full px-2.5 py-2 rounded-lg text-sm border bg-transparent outline-none";
  const inputStyle = { borderColor: "var(--outline)" } as const;

  return (
    <div className="space-y-6 p-6" style={{ color: "var(--foreground)" }}>
      <header>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GREEN }}>
          ✅ Gerçek Veri · Mektup Motoru
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <Mail className="h-6 w-6" style={{ color: GREEN }} /> Mohave Mektup Kampanya Kurucu
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          Segment seç → aynı sahip + aynı posta adresi <strong>tek mektupta birleşir</strong> (dedupe) →
          Lob-uyumlu CSV indir. Kaynak: <Link href="/admin/mohave" className="underline" style={{ color: GREEN }}>Mohave Off-Market envanteri</Link>{" "}
          ({s ? s.sourceRows.toLocaleString("en-US") : "…"} parsel).
        </p>
      </header>

      {/* Hazır segmentler */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p.f)} title={p.desc}
            className="rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-[var(--surface-high)]"
            style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            {p.label}
            <span className="block font-normal" style={{ color: "var(--muted)" }}>{p.desc}</span>
          </button>
        ))}
      </div>

      {/* Filtreler */}
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Filter className="h-4 w-4" style={{ color: GREEN }} /> Segment filtreleri
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Bölge</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Hepsi</option>
              {(data?.regions ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Sahip</span>
            <select value={ownerScope} onChange={(e) => setOwnerScope(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="all">Hepsi</option>
              <option value="absentee">Absentee (AZ dışı)</option>
              <option value="instate">AZ içi</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Min acre</span>
            <input value={minAcres} onChange={(e) => setMinAcres(e.target.value)} placeholder="örn. 1" inputMode="decimal" className={inputCls} style={inputStyle} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Max acre</span>
            <input value={maxAcres} onChange={(e) => setMaxAcres(e.target.value)} placeholder="örn. 5" inputMode="decimal" className={inputCls} style={inputStyle} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Max land value ($)</span>
            <input value={maxLandValue} onChange={(e) => setMaxLandValue(e.target.value)} placeholder="örn. 1000" inputMode="numeric" className={inputCls} style={inputStyle} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Sahip başına min parsel</span>
            <input value={minParcels} onChange={(e) => setMinParcels(e.target.value)} placeholder="örn. 2" inputMode="numeric" className={inputCls} style={inputStyle} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => { setLoading(true); load(); }} disabled={loading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent-ink)", color: "var(--background)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />} Segmenti hesapla
          </button>
          <a href={`/api/admin/mohave-campaign?${qs()}&format=csv`}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: GREEN, color: "#fff", pointerEvents: s && s.letters > 0 ? "auto" : "none", opacity: s && s.letters > 0 ? 1 : 0.4 }}>
            <Download className="h-4 w-4" /> Lob-ready CSV indir {s ? `(${s.letters.toLocaleString("en-US")} mektup)` : ""}
          </a>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            Mektup başı maliyet $
            <input value={costPer} onChange={(e) => setCostPer(e.target.value)} inputMode="decimal"
              className="w-16 rounded-md border bg-transparent px-1.5 py-1 text-xs outline-none" style={inputStyle} />
          </label>
        </div>
        {err && <p className="mt-3 text-xs" style={{ color: "var(--error)" }}>Hata: {err}</p>}
      </div>

      {/* Özet kartlar */}
      {s && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={<Mail className="h-4 w-4" />} label="Mektup (dedupe sonrası)" value={s.letters.toLocaleString("en-US")} accent />
          <Stat icon={<MapPin className="h-4 w-4" />} label="Kapsanan parsel" value={s.parcels.toLocaleString("en-US")} />
          <Stat icon={<Users className="h-4 w-4" />} label="Toplam acre" value={s.totalAcres.toLocaleString("en-US")} />
          <Stat icon={<DollarSign className="h-4 w-4" />} label={`Tahmini posta maliyeti (@$${costPer || "0"})`} value={usd(cost)} />
        </div>
      )}
      {s && s.parcels > 0 && s.letters < s.parcels && (
        <p className="text-xs" style={{ color: GREEN }}>
          🎯 Dedupe kazancı: {s.parcels.toLocaleString("en-US")} parsele {s.letters.toLocaleString("en-US")} mektupla ulaşıyorsun —{" "}
          {(s.parcels - s.letters).toLocaleString("en-US")} mektup tasarrufu.
        </p>
      )}
      {s && s.skippedNoAddress > 0 && (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--warn)" }}>
          <AlertTriangle className="h-3.5 w-3.5" /> {s.skippedNoAddress.toLocaleString("en-US")} satır posta adresi/zip eksik olduğu için atlandı (Lob&apos;da zaten başarısız olurdu).
        </p>
      )}

      {/* Önizleme tablosu */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
              <th className="px-3 py-2.5 font-bold">Sahip (mektup alıcısı)</th>
              <th className="px-3 py-2.5 font-bold">Posta adresi</th>
              <th className="px-3 py-2.5 text-right font-bold">Parsel</th>
              <th className="px-3 py-2.5 text-right font-bold">Acre</th>
              <th className="px-3 py-2.5 text-right font-bold">İç teklif toplamı</th>
              <th className="px-3 py-2.5 font-bold">Bölge(ler)</th>
            </tr>
          </thead>
          <tbody>
            {(data?.preview ?? []).map((l, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-medium">{l.owner}</td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{l.address}, {l.city} {l.state} {l.zip}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: GREEN }}>{l.parcelCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.totalAcres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{l.totalOffer > 0 ? usd(l.totalOffer) : "—"}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>{l.regions.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (data?.preview.length ?? 0) === 0 && (
          <p className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Bu segmentte mektup yok — filtreleri gevşet.</p>
        )}
      </div>
      {s && s.letters > 120 && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          İlk 120 mektup gösteriliyor — tam liste ({s.letters.toLocaleString("en-US")}) CSV&apos;de.
        </p>
      )}

      <div className="rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
        <strong style={{ color: "var(--warn)" }}>Not:</strong> &quot;İç teklif toplamı&quot; est_offer alanından gelir ve <strong>sadece bu admin ekranında</strong> görünür —
        müşteri satış sayfalarına sızmaz. CSV&apos;deki kolonlar Lob adres şemasıyla uyumlu; Lob kampanyası veya harici mail-house&apos;a direkt yüklenebilir.
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>{icon} {label}</div>
      <div className="mt-1 text-xl font-bold" style={accent ? { color: GREEN } : undefined}>{value}</div>
    </div>
  );
}
