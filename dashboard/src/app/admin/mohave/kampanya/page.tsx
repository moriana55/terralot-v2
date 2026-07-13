"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Loader2, Download, Filter, Users, MapPin, DollarSign, AlertTriangle, Send, X, CheckCircle2, Star } from "lucide-react";
import { ScoreBadge } from "@/components/ScoreBadge";

// ─────────────────────────────────────────────────────────────────────────────
// MOHAVE MEKTUP KAMPANYA KURUCU (admin, Türkçe)
// 20K off-market lead → segment seç → aynı sahip+adres TEK mektup (dedupe) →
// Lob-ready CSV indir. Rakamlar /api/admin/mohave-campaign'den (gerçek county
// verisi); uydurma yok. est_offer İÇ bilgidir, sadece bu gated ekranda.
// ─────────────────────────────────────────────────────────────────────────────

interface Letter {
  owner: string; address: string; city: string; state: string; zip: string;
  parcelCount: number; apns: string[]; totalAcres: number; totalOffer: number; regions: string[];
  avgScore: number;
}
interface ApiResp {
  summary: {
    letters: number; parcels: number; totalAcres: number; totalOffer: number;
    skippedNoAddress: number; skippedGovOwner: number; excludedMailed: number; sourceRows: number;
    // ⭐ "En İyi 750" reçetesinde dolu gelir; diğer segmentlerde yok.
    requestedTopN?: number; consideredParcels?: number; avgScore?: number;
    regionBreakdown?: Record<string, number>;
  };
  /** true=log tablosu okundu, false=okunamadı (tablo/env yok), null=exclusion istenmedi. */
  exclusionAvailable: boolean | null;
  lobConfigured: boolean;
  regions: string[];
  preview: Letter[];
}

interface SendResult {
  dryRun: boolean;
  campaign: string;
  letters?: number;
  parcels?: number;
  sent?: number;
  failed?: number;
  failures?: { owner: string; error?: string }[];
  sample?: { owner: string; address: string; parcelCount: number }[];
  sampleBody?: string;
  message?: string;
  logWarning?: string | null;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const GREEN = "#16a34a";

// 🗺️ ?from=map ile gelindiyse haritadaki kampanya sepetinden sessionStorage'a
// yazılan APN listesini okur. Lazy useState initializer'da çağrılır (mount
// effect'i içinde SENKRON setState — lint'e takılıyor — YERİNE); SSR'da
// window yoksa boş döner.
function readMapSelection(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "map") return [];
    const raw = sessionStorage.getItem("terralot_map_selection");
    if (!raw) return [];
    const apns = JSON.parse(raw);
    return Array.isArray(apns) ? apns.map(String) : [];
  } catch {
    return []; // bozuk/eksik sessionStorage — sessizce yut, filtre moduna düş
  }
}

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
  const [excludeMailed, setExcludeMailed] = useState(true);
  // ⭐ "En İyi 750" modu: skora göre otomatik seçim — diğer filtreler yok sayılır.
  const [top750Mode, setTop750Mode] = useState(false);
  // 🗺️ "Haritadan Seçim": /admin/alinabilir-harita'daki kampanya sepetinden
  // sessionStorage üzerinden gelen APN listesi. from=map ile gelinirse otomatik
  // uygulanır (Yiğit demoda tek tıkla göstersin diye).
  const [mapApns] = useState<string[]>(() => readMapSelection());
  const [mapMode, setMapMode] = useState(() => readMapSelection().length > 0);
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Gönderim akışı
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (top750Mode) {
      // Diğer filtreler API tarafında yok sayılır — yine de temiz bir query için eklemiyoruz.
      p.set("top750", "1");
      if (excludeMailed) p.set("excludeMailed", "1");
      return p.toString();
    }
    if (mapMode) {
      // 🗺️ Haritadan seçim — sadece sepetteki APN'ler, diğer filtreler yok sayılır.
      p.set("apns", mapApns.join(","));
      if (excludeMailed) p.set("excludeMailed", "1");
      return p.toString();
    }
    if (region) p.set("region", region);
    if (ownerScope !== "all") p.set("ownerScope", ownerScope);
    if (minAcres) p.set("minAcres", minAcres);
    if (maxAcres) p.set("maxAcres", maxAcres);
    if (maxLandValue) p.set("maxLandValue", maxLandValue);
    if (minParcels) p.set("minParcels", minParcels);
    if (excludeMailed) p.set("excludeMailed", "1");
    return p.toString();
  }, [region, ownerScope, minAcres, maxAcres, maxLandValue, minParcels, excludeMailed, top750Mode, mapMode, mapApns]);

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
    setTop750Mode(false);
    setMapMode(false);
    setRegion(f.region ?? "");
    setOwnerScope(f.ownerScope ?? "all");
    setMinAcres(f.minAcres ?? "");
    setMaxAcres(f.maxAcres ?? "");
    setMaxLandValue(f.maxLandValue ?? "");
    setMinParcels(f.minParcels ?? "");
  };

  const startCampaign = async () => {
    if (!data) return;
    setSending(true);
    setSendErr(null);
    try {
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const res = await fetch("/api/admin/mohave-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_campaign",
          campaign: campaignName.trim(),
          filter: mapMode
            ? { apns: mapApns }
            : {
                region: region || undefined,
                ownerScope: ownerScope === "all" ? undefined : ownerScope,
                minAcres: num(minAcres), maxAcres: num(maxAcres),
                maxLandValue: num(maxLandValue), minParcels: num(minParcels),
              },
          top750: top750Mode,
          excludeMailed,
          expectedLetters: data.summary.letters,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || `API ${res.status}`);
      setSendResult(j as SendResult);
      setConfirmOpen(false);
      // Gerçek gönderim sonrası segmenti tazele — exclusion yeni logları görsün.
      if (!(j as SendResult).dryRun) { setLoading(true); load(); }
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const s = data?.summary;
  const cost = s ? s.letters * (Number(costPer) || 0) : 0;
  const lobReady = data?.lobConfigured ?? false;

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
        <button onClick={() => { setTop750Mode(true); setMapMode(false); }} title="offmarket_score'a göre azalan sıralı ilk 750 parsel — marj + boyut + bölge talebi + sahip motivasyonu"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-[var(--surface-high)]"
          style={{ borderColor: top750Mode ? GREEN : "var(--outline)", background: top750Mode ? "var(--surface-high)" : "var(--surface)" }}>
          <Star className="h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} />
          <span>
            ⭐ En İyi 750
            <span className="block font-normal" style={{ color: "var(--muted)" }}>Skora göre otomatik seçim — dedupe sonrası mektup sayısı düşebilir</span>
          </span>
        </button>
        {/* 🗺️ Haritadan Seçim — sadece haritadan sepetle gelindiyse görünür (5. seçenek). */}
        {mapApns.length > 0 && (
          <button onClick={() => { setMapMode(true); setTop750Mode(false); }} title="Alınabilir Harita'daki kampanya sepetinden gelen parseller"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-[var(--surface-high)]"
            style={{ borderColor: mapMode ? "#7c3aed" : "var(--outline)", background: mapMode ? "var(--surface-high)" : "var(--surface)" }}>
            <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "#7c3aed" }} />
            <span>
              🗺️ Haritadan Seçim ({mapApns.length})
              <span className="block font-normal" style={{ color: "var(--muted)" }}>Harita kokpitinde sepete eklenen parseller</span>
            </span>
          </button>
        )}
      </div>

      {mapMode && (
        <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs"
          style={{ borderColor: "#7c3aed", color: "var(--foreground)" }}>
          <span>
            <strong style={{ color: "#7c3aed" }}>🗺️ Haritadan Seçim modu aktif</strong> — segment filtreleri yok sayılır, haritada sepete
            eklenen {mapApns.length} parsel kullanılır.
          </span>
          <button onClick={() => setMapMode(false)} className="ml-3 shrink-0 underline" style={{ color: "var(--muted)" }}>
            filtrelere dön
          </button>
        </div>
      )}

      {top750Mode && (
        <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs"
          style={{ borderColor: GREEN, color: "var(--foreground)" }}>
          <span>
            <strong style={{ color: GREEN }}>⭐ En İyi 750 modu aktif</strong> — segment filtreleri yok sayılır, offmarket_score&apos;a
            göre azalan sıralı ilk {data?.summary.requestedTopN ?? 750} parsel seçilir.
          </span>
          <button onClick={() => setTop750Mode(false)} className="ml-3 shrink-0 underline" style={{ color: "var(--muted)" }}>
            filtrelere dön
          </button>
        </div>
      )}

      {/* Filtreler */}
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: (top750Mode || mapMode) ? 0.45 : 1 }}>
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Filter className="h-4 w-4" style={{ color: GREEN }} /> Segment filtreleri
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Bölge</span>
            <select disabled={top750Mode || mapMode} value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Hepsi</option>
              {(data?.regions ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Sahip</span>
            <select disabled={top750Mode || mapMode} value={ownerScope} onChange={(e) => setOwnerScope(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="all">Hepsi</option>
              <option value="absentee">Absentee (AZ dışı)</option>
              <option value="instate">AZ içi</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Min acre</span>
            <input disabled={top750Mode || mapMode} value={minAcres} onChange={(e) => setMinAcres(e.target.value)} placeholder="örn. 1" inputMode="decimal" className={inputCls} style={inputStyle} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Max acre</span>
            <input disabled={top750Mode || mapMode} value={maxAcres} onChange={(e) => setMaxAcres(e.target.value)} placeholder="örn. 5" inputMode="decimal" className={inputCls} style={inputStyle} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Max land value ($)</span>
            <input disabled={top750Mode || mapMode} value={maxLandValue} onChange={(e) => setMaxLandValue(e.target.value)} placeholder="örn. 1000" inputMode="numeric" className={inputCls} style={inputStyle} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Sahip başına min parsel</span>
            <input disabled={top750Mode || mapMode} value={minParcels} onChange={(e) => setMinParcels(e.target.value)} placeholder="örn. 2" inputMode="numeric" className={inputCls} style={inputStyle} />
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
          <button onClick={() => { setSendResult(null); setSendErr(null); setConfirmOpen(true); }}
            disabled={!s || s.letters === 0 || loading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
            style={{ background: "var(--warn)", color: "#000", opacity: s && s.letters > 0 && !loading ? 1 : 0.4 }}>
            <Send className="h-4 w-4" /> Kampanyayı Başlat {s ? `(${s.letters.toLocaleString("en-US")})` : ""}
          </button>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            Mektup başı maliyet $
            <input value={costPer} onChange={(e) => setCostPer(e.target.value)} inputMode="decimal"
              className="w-16 rounded-md border bg-transparent px-1.5 py-1 text-xs outline-none" style={inputStyle} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={excludeMailed} onChange={(e) => { setExcludeMailed(e.target.checked); setLoading(true); }} />
            Daha önce mektup atılan sahipleri hariç tut
          </label>
        </div>
        {err && <p className="mt-3 text-xs" style={{ color: "var(--error)" }}>Hata: {err}</p>}
      </div>

      {/* Lob durumu şeridi */}
      {data && !lobReady && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-semibold"
          style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          LOB_API_KEY tanımlı değil — &quot;Kampanyayı Başlat&quot; şu an <strong>DRY-RUN</strong>: gönderilecekler listelenir, mektup GİTMEZ. API key gelince aynı buton gerçek gönderim yapar.
        </div>
      )}
      {data && excludeMailed && data.exclusionAvailable === false && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs"
          style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Gönderim log tablosu okunamadı (mail_campaign_log yok ya da Supabase env eksik) — &quot;hariç tut&quot; şu an etkisiz. <code>scraper/sql/mail_campaign_log.sql</code>&apos;i Supabase&apos;de çalıştırın.
        </div>
      )}
      {s && excludeMailed && data?.exclusionAvailable === true && s.excludedMailed > 0 && (
        <p className="text-xs" style={{ color: GREEN }}>
          ✉️ {s.excludedMailed.toLocaleString("en-US")} sahip daha önce mektup aldığı için listeden düşüldü.
        </p>
      )}

      {/* Özet kartlar */}
      {s && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={<Mail className="h-4 w-4" />} label="Mektup (dedupe sonrası)" value={s.letters.toLocaleString("en-US")} accent />
          <Stat icon={<MapPin className="h-4 w-4" />} label="Kapsanan parsel" value={s.parcels.toLocaleString("en-US")} />
          <Stat icon={<Users className="h-4 w-4" />} label="Toplam acre" value={s.totalAcres.toLocaleString("en-US")} />
          <Stat icon={<DollarSign className="h-4 w-4" />} label={`Tahmini posta maliyeti (@$${costPer || "0"})`} value={usd(cost)} />
        </div>
      )}
      {top750Mode && s && s.avgScore != null && (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="mb-2 font-bold">⭐ En İyi 750 — seçim özeti (dedupe öncesi, {s.consideredParcels ?? 0} parsel)</div>
          <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
            <span>Ortalama offmarket_score: <strong style={{ color: GREEN }}>{s.avgScore}</strong>/100</span>
            {s.regionBreakdown && (
              <span className="flex flex-wrap gap-2">
                Bölge dağılımı:
                {Object.entries(s.regionBreakdown).sort((a, b) => b[1] - a[1]).map(([reg, n]) => (
                  <span key={reg} className="rounded-md px-2 py-0.5" style={{ background: "var(--surface-high)" }}>{reg}: <strong>{n}</strong></span>
                ))}
              </span>
            )}
          </div>
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

      {/* Gönderim sonucu */}
      {sendResult && (
        <div className="rounded-xl border p-4" style={{ borderColor: sendResult.dryRun ? "var(--warn)" : GREEN, background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              {sendResult.dryRun
                ? <><AlertTriangle className="h-4 w-4" style={{ color: "var(--warn)" }} /> DRY-RUN sonucu — mektup GÖNDERİLMEDİ</>
                : <><CheckCircle2 className="h-4 w-4" style={{ color: GREEN }} /> Kampanya gönderildi</>}
              <span className="font-normal" style={{ color: "var(--muted)" }}>· {sendResult.campaign}</span>
            </div>
            <button onClick={() => setSendResult(null)} aria-label="Kapat"><X className="h-4 w-4" style={{ color: "var(--muted)" }} /></button>
          </div>
          {sendResult.dryRun ? (
            <div className="mt-3 space-y-3 text-xs">
              <p>{sendResult.message}</p>
              <p><strong>{(sendResult.letters ?? 0).toLocaleString("en-US")}</strong> mektup gönderilecekti ({(sendResult.parcels ?? 0).toLocaleString("en-US")} parsel). İlk 10 alıcı:</p>
              <ul className="list-disc space-y-0.5 pl-5" style={{ color: "var(--muted)" }}>
                {(sendResult.sample ?? []).map((r, i) => (
                  <li key={i}><strong style={{ color: "var(--foreground)" }}>{r.owner}</strong> — {r.address} ({r.parcelCount} parsel)</li>
                ))}
              </ul>
              {sendResult.sampleBody && (
                <details>
                  <summary className="cursor-pointer font-semibold">Örnek mektup gövdesi</summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border p-3 text-[11px] leading-relaxed"
                    style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>{sendResult.sampleBody}</pre>
                </details>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              <p>
                <strong style={{ color: GREEN }}>{(sendResult.sent ?? 0).toLocaleString("en-US")} gönderildi</strong>
                {(sendResult.failed ?? 0) > 0 && <> · <strong style={{ color: "var(--error)" }}>{sendResult.failed} başarısız</strong></>}
                {" "}— log: mail_campaign_log.
              </p>
              {(sendResult.failures ?? []).length > 0 && (
                <ul className="list-disc pl-5" style={{ color: "var(--error)" }}>
                  {sendResult.failures!.map((f, i) => <li key={i}>{f.owner}: {f.error}</li>)}
                </ul>
              )}
              {sendResult.logWarning && <p style={{ color: "var(--warn)" }}>⚠ {sendResult.logWarning}</p>}
            </div>
          )}
        </div>
      )}

      {/* Önizleme tablosu */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
              <th className="px-3 py-2.5 text-center font-bold">Skor</th>
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
                <td className="px-3 py-2 text-center"><ScoreBadge score={top750Mode ? l.avgScore : null} size={28} /></td>
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

      {/* Onay modal'ı — yanlışlıkla 735 mektup gitmesin: sayı + maliyet + isim + açık onay */}
      {confirmOpen && s && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => !sending && setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border p-5" onClick={(e) => e.stopPropagation()}
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Send className="h-4 w-4" style={{ color: lobReady ? GREEN : "var(--warn)" }} /> Kampanyayı Başlat
              </h2>
              <button onClick={() => !sending && setConfirmOpen(false)} aria-label="Kapat">
                <X className="h-4 w-4" style={{ color: "var(--muted)" }} />
              </button>
            </div>

            {!lobReady && (
              <p className="mt-3 rounded-lg border border-dashed px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
                DRY-RUN modu: LOB_API_KEY yok — mektup gönderilmez, sadece gidecekler listelenir.
              </p>
            )}

            <div className="mt-4 space-y-1.5 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--outline)" }}>
              <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Mektup sayısı</span><strong>{s.letters.toLocaleString("en-US")}</strong></div>
              <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Kapsanan parsel</span><strong>{s.parcels.toLocaleString("en-US")}</strong></div>
              <div className="flex justify-between">
                <span style={{ color: "var(--muted)" }}>Tahmini maliyet (@${costPer || "0"}/mektup)</span>
                <strong style={{ color: lobReady ? "var(--warn)" : "var(--muted)" }}>{usd(cost)}</strong>
              </div>
              <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                <span>Önceden mektup alanlar hariç</span><span>{excludeMailed ? "Evet" : "Hayır"}</span>
              </div>
            </div>

            <label className="mt-4 block text-xs">
              <span className="mb-1 block font-semibold" style={{ color: "var(--muted)" }}>Kampanya adı (log&apos;a yazılır)</span>
              <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
                placeholder={`mohave-${new Date().toISOString().slice(0, 10)}`}
                className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none" style={{ borderColor: "var(--outline)" }} />
            </label>

            {sendErr && <p className="mt-3 text-xs" style={{ color: "var(--error)" }}>Hata: {sendErr}</p>}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} disabled={sending}
                className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--outline)" }}>
                Vazgeç
              </button>
              <button onClick={startCampaign} disabled={sending || campaignName.trim().length < 3}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
                style={{
                  background: lobReady ? GREEN : "var(--warn)", color: lobReady ? "#fff" : "#000",
                  opacity: sending || campaignName.trim().length < 3 ? 0.5 : 1,
                }}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {lobReady ? `Evet, ${s.letters.toLocaleString("en-US")} mektup gönder` : "Dry-run çalıştır"}
              </button>
            </div>
            {campaignName.trim().length < 3 && (
              <p className="mt-2 text-right text-[11px]" style={{ color: "var(--muted)" }}>Onay için kampanya adı gir (min 3 karakter).</p>
            )}
          </div>
        </div>
      )}
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
