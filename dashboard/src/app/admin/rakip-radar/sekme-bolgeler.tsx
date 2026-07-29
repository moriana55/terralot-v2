"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Swords,
  Flame,
  TrendingDown,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  Target,
  CheckCircle2,
  Building2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// BÖLGELER — eski /admin/rakip-istihbarat + /admin/pazar-ortusme BİRLEŞİMİ.
//
// İki veri ucu tek bölge tablosunda buluşur:
//   • /api/admin/rakip-istihbarat → COUNTY seviyesinde rakip yoğunluğu
//     (aktif ilan, muhtemel satış, ana rakip, medyan fiyat/$acre) + o county'de
//     BİZİM lead sayımız (offmarket_leads) + öncelik rozeti.
//   • /api/admin/market-overlap  → AZ/Mohave-Coconino YERLEŞİM seviyesinde
//     (Meadview, Kingman, Dolan Springs…) rakip ilanı + bizim envanterimiz
//     (offmarket + tax) + $/acre spread + KANIT LİNKLERİ + "kanıtlı pazar" rozeti.
//
// İki uç farklı çözünürlükte olduğu için birleştirme hiyerarşiktir: county satırı
// (istihbarat) + altında o county'nin yerleşim satırları (pazar-örtüşme). Hiçbir
// metrik ya da kanıt linki düşürülmedi; sayılar birbirine EKLENMEZ (çift sayım
// olurdu), yan yana gösterilir.
//
// DÜRÜSTLÜK: "satıldı" kesin değil → "muhtemel satış" (ilan snapshot'tan kayboldu).
// Salt-okunur; her iki uç da service role + gate arkasında.
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US");
const fmtDate = (ts: string | null | undefined) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
};
const relDays = (ts: string | null | undefined): number | null => {
  if (!ts) return null;
  const d = new Date(ts).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, Math.round((Date.now() - d) / 86_400_000));
};

// ── Rakip istihbaratı uç tipleri ──────────────────────────────────────────────
interface Sale {
  competitor: string | null;
  title: string | null;
  state: string | null;
  stateAbbr: string | null;
  county: string | null;
  acres: number | null;
  price: number | null;
  disappearedAt: string | null;
  domDays: number | null;
  url: string | null;
  verified: boolean;
}
interface CompSum {
  competitor: string;
  active: number;
  suspectedSold: number;
  verifiedSold: number;
}
interface HotRegion {
  state: string;
  county: string;
  countyNorm: string;
  active: number;
  sold: number;
  heat: number;
  topCompetitor: string | null;
  medianPrice: number | null;
  medianPpa: number | null;
  ourLeadsCounty: number;
  ourLeadsState: number;
  priority: "ONCELIK" | "IZLE" | "FIRSAT" | "RAKIP_ALANI" | string;
}
interface IstihbaratPayload {
  generatedAt: string;
  totals: {
    activeListings: number;
    suspectedSold: number;
    verifiedSold: number;
    lastScrapeAt: string | null;
  };
  competitorSummary: CompSum[];
  recentSales: Sale[];
  hotRegions: HotRegion[];
  ourLeadTotal: number;
  notes: string[];
}

// ── Pazar örtüşme uç tipleri ─────────────────────────────────────────────────
interface OrtusmeBolge {
  key: string;
  label: string;
  state: string;
  county: string;
  comp: {
    count: number;
    byCompetitor: Record<string, number>;
    medianPpa: number | null;
    priceMin: number | null;
    priceMax: number | null;
    flagged: number;
    samples: { competitor: string; url: string; price: number | null; acres: number | null; title: string }[];
    scrapedAt: string | null;
  };
  ours: { offmarket: number; tax: number; total: number; avgOffer: number | null; medianPpa: number | null };
  spreadPerAcre: number | null;
  badge: "proven" | "comp-only" | "inv-only" | "empty";
}
interface OrtusmePayload {
  regions: OrtusmeBolge[];
  other: { comp: number; offmarket: number; tax: number };
  scrapedAt: string | null;
  band: { ppaMin: number; ppaMax: number };
  notes: string[];
}

const ONCELIK: Record<string, { label: string; bg: string; fg: string }> = {
  ONCELIK: { label: "ÖNCELİK", bg: "var(--success)", fg: "#fff" },
  IZLE: { label: "İzle", bg: "var(--status-info)", fg: "#fff" },
  FIRSAT: { label: "Fırsat (eyalet)", bg: "var(--warn)", fg: "#000" },
  RAKIP_ALANI: { label: "Rakip alanı", bg: "var(--surface-high)", fg: "var(--muted)" },
};

const ORTUSME_ROZET: Record<string, { label: string; color: string; bg: string }> = {
  proven: { label: "✅ KANITLI PAZAR", color: "var(--grade-a)", bg: "rgba(34,197,94,0.12)" },
  "comp-only": { label: "Rakip satıyor · envanter yok", color: "var(--grade-c)", bg: "rgba(185,119,10,0.12)" },
  "inv-only": { label: "Envanterimiz var · rakip kanıtı yok", color: "var(--accent-ink)", bg: "rgba(14,125,151,0.12)" },
  empty: { label: "—", color: "var(--muted)", bg: "var(--surface-high)" },
};

const RAKIP_RENK: Record<string, string> = {
  "Rina Land": "var(--grade-c)",
  Rina: "var(--grade-c)",
  "Discount Lots": "var(--accent-ink)",
  Landio: "var(--grade-b)",
};

// County adını eşleştirme için sadeleştir ("Mohave County" → "mohave").
function countyNormalize(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .toLowerCase()
    .split("/")[0]
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bcounty\b|\bparish\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** County satırı + (varsa) o county'ye düşen pazar-örtüşme yerleşimleri. */
interface BirlesikBolge {
  anahtar: string;
  eyalet: string;
  countyEtiket: string;
  /** istihbarat ucunda bu county için satır var mı (yoksa sayılar sadece örtüşmeden) */
  istihbaratVar: boolean;
  aktif: number;
  muhtemelSatis: number | null;
  anaRakip: string | null;
  medyanFiyat: number | null;
  medyanPpa: number | null;
  leadCounty: number | null;
  leadEyalet: number | null;
  oncelik: string | null;
  isi: number;
  altBolgeler: OrtusmeBolge[];
}

function birlestir(ist: IstihbaratPayload | null, ovl: OrtusmePayload | null): BirlesikBolge[] {
  const satirlar = new Map<string, BirlesikBolge>();

  for (const r of ist?.hotRegions ?? []) {
    const anahtar = `${r.state.toUpperCase()}|${countyNormalize(r.county) || r.countyNorm}`;
    satirlar.set(anahtar, {
      anahtar,
      eyalet: r.state.toUpperCase(),
      countyEtiket: r.county,
      istihbaratVar: true,
      aktif: r.active,
      muhtemelSatis: r.sold,
      anaRakip: r.topCompetitor,
      medyanFiyat: r.medianPrice,
      medyanPpa: r.medianPpa,
      leadCounty: r.ourLeadsCounty,
      leadEyalet: r.ourLeadsState,
      oncelik: r.priority,
      isi: r.heat,
      altBolgeler: [],
    });
  }

  for (const b of ovl?.regions ?? []) {
    const anahtar = `${b.state.toUpperCase()}|${countyNormalize(b.county)}`;
    let satir = satirlar.get(anahtar);
    if (!satir) {
      // County istihbarat sıralamasına girmemiş (ör. rakip county alanı boş) —
      // yine de gösterilir, sayılar SADECE örtüşme ucundan gelir.
      satir = {
        anahtar,
        eyalet: b.state.toUpperCase(),
        countyEtiket: b.county,
        istihbaratVar: false,
        aktif: 0,
        muhtemelSatis: null,
        anaRakip: null,
        medyanFiyat: null,
        medyanPpa: null,
        leadCounty: null,
        leadEyalet: null,
        oncelik: null,
        isi: 0,
        altBolgeler: [],
      };
      satirlar.set(anahtar, satir);
    }
    satir.altBolgeler.push(b);
    if (!satir.istihbaratVar) {
      satir.aktif += b.comp.count;
      satir.isi += b.comp.count;
    }
  }

  return [...satirlar.values()].sort((a, b) => b.isi - a.isi || b.aktif - a.aktif);
}

// `?sekme=bolgeler` gövdesi (eski /admin/rakip-istihbarat + /admin/pazar-ortusme).
export default function SekmeBolgeler() {
  const [ist, setIst] = useState<IstihbaratPayload | null>(null);
  const [ovl, setOvl] = useState<OrtusmePayload | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [istHata, setIstHata] = useState<string | null>(null);
  const [ovlHata, setOvlHata] = useState<string | null>(null);

  // İki uç paralel çekilir — biri düşerse diğeri yine gösterilir.
  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setIstHata(null);
    setOvlHata(null);
    await Promise.all([
      (async () => {
        try {
          const res = await fetch("/api/admin/rakip-istihbarat", { cache: "no-store" });
          if (!res.ok) throw new Error(`API ${res.status}`);
          setIst((await res.json()) as IstihbaratPayload);
        } catch (e) {
          setIstHata(e instanceof Error ? e.message : "rakip istihbaratı yüklenemedi");
        }
      })(),
      (async () => {
        try {
          const res = await fetch("/api/admin/market-overlap");
          if (!res.ok) throw new Error(`Sunucu ${res.status} döndü (oturum/gate olabilir).`);
          setOvl((await res.json()) as OrtusmePayload);
        } catch (e) {
          setOvlHata(e instanceof Error ? e.message : "pazar örtüşmesi yüklenemedi");
        }
      })(),
    ]);
    setYukleniyor(false);
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const bolgeler = useMemo(() => birlestir(ist, ovl), [ist, ovl]);
  const kanitliPazar = (ovl?.regions ?? []).filter((r) => r.badge === "proven").length;
  const notlar = [...(ist?.notes ?? []), ...(ovl?.notes ?? [])];

  return (
    <div className="p-8">
      {/* Başlık */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="w-5 h-5" style={{ color: "var(--warn)" }} />
            Bölgeler — rakip yoğunluğu + bizim envanter
          </h1>
          <p className="text-sm mt-1 max-w-3xl" style={{ color: "var(--muted)" }}>
            Rakiplerin en yoğun olduğu county&apos;ler, o bölgedeki kendi lead sayımızla eşleştirilmiş; altlarında
            AZ yerleşim kırılımı (rakip ilanı, envanterimiz, $/acre spread, kanıt linkleri). Sourcing önceliğini bu belirler.
          </p>
        </div>
        <button
          onClick={yukle}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
        >
          <RefreshCw size={15} className={yukleniyor ? "animate-spin" : ""} />
          Yenile
        </button>
      </div>

      {/* Dürüstlük notu — iki ekranın notları birleşti */}
      <div
        className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs mb-4"
        style={{ background: "var(--surface)", border: "1px dashed var(--outline)", color: "var(--muted)" }}
      >
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--grade-a)" }} />
        <span>
          <strong style={{ color: "var(--foreground)" }}>Hiçbir &quot;satıldı&quot; kesin değil</strong> — ilan
          snapshot&apos;tan kaybolunca &quot;muhtemel satış&quot; sayılır.{" "}
          <strong style={{ color: "var(--foreground)" }}>&quot;✅ KANITLI PAZAR&quot; = rakip orada satıyor + bizde envanter var.</strong>{" "}
          Medyan $/acre, ham arsa için makul banda ({ovl ? `$${fmtNum(ovl.band.ppaMin)}–$${fmtNum(ovl.band.ppaMax)}/acre` : "—"})
          sığan ilanlardan hesaplanır; aykırı fiyatlar (ör. $750k/5acre = scraping hatası) medyana KATILMAZ, &quot;⚠ N doğrulanmamış&quot; olarak gösterilir.
          Envanterimiz ağırlıkla AZ/Mohave&apos;de — eyalet lead sayısı kesin, county eşleşmesi en-iyi-çaba.
          {ovl?.scrapedAt ? ` Rakip verisi çekim tarihi: ${fmtDate(ovl.scrapedAt)}.` : ""}
        </span>
      </div>

      {(istHata || ovlHata) && (
        <div
          className="flex flex-col gap-1 px-4 py-3 rounded-lg mb-4 text-sm"
          style={{ background: "rgba(186,26,26,0.08)", color: "var(--error)" }}
        >
          {istHata && <span className="flex items-center gap-2"><AlertCircle size={16} /> Rakip yoğunluğu: {istHata}</span>}
          {ovlHata && <span className="flex items-center gap-2"><AlertCircle size={16} /> Pazar örtüşmesi: {ovlHata}</span>}
        </div>
      )}

      {yukleniyor && !ist && !ovl && (
        <div className="flex items-center gap-2 py-20 justify-center" style={{ color: "var(--muted)" }}>
          <Loader2 className="animate-spin" size={18} /> Yükleniyor…
        </div>
      )}

      {(ist || ovl) && (
        <>
          {/* Özet kartları — iki ekranın sayaçları */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <Stat label="Aktif rakip ilanı" value={fmtNum(ist?.totals.activeListings)} icon={<Target size={16} />} />
            <Stat
              label="Muhtemel satış (kayboldu)"
              value={fmtNum(ist?.totals.suspectedSold)}
              icon={<TrendingDown size={16} />}
              accent="var(--warn)"
            />
            <Stat
              label="Doğrulanmış satış"
              value={fmtNum(ist?.totals.verifiedSold)}
              icon={<ShieldCheck size={16} />}
              accent="var(--success)"
            />
            <Stat label="Bizim lead (sıcak eyaletler)" value={fmtNum(ist?.ourLeadTotal)} icon={<Flame size={16} />} />
            <Stat
              label="Kanıtlı pazar (yerleşim)"
              value={ovl ? String(kanitliPazar) : "—"}
              icon={<CheckCircle2 size={16} />}
              accent="var(--grade-a)"
            />
          </div>

          <p className="text-xs mb-8" style={{ color: "var(--muted)" }}>
            Son scrape: {fmtDate(ist?.totals.lastScrapeAt)} · Rapor: {fmtDate(ist?.generatedAt)}
            {ovl && (
              <> · Eşleşmeyen (Diğer): rakip {fmtNum(ovl.other.comp)} · env {fmtNum(ovl.other.offmarket + ovl.other.tax)}</>
            )}
            {notlar.length > 0 && <span style={{ color: "var(--warn)" }}> · {notlar.join(" · ")}</span>}
          </p>

          {/* ── 1) TEK BÖLGE TABLOSU ─────────────────────────────────────── */}
          <Bolum
            title="Bölge tablosu — rakip yoğunluğu, bizim lead'imiz, spread, kanıt"
            subtitle="County satırı = rakip yoğunluğu sıralaması (aktif ilan + muhtemel satış×2). Altındaki girintili satırlar = AZ yerleşim kırılımı (pazar örtüşmesi): sayılar county toplamının bir alt kümesidir, ÜSTÜNE eklenmez."
            icon={<Flame size={18} style={{ color: "var(--warn)" }} />}
          >
            {bolgeler.length === 0 ? (
              <Bos text="Bölge verisi yok." />
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--outline)" }}>
                <table className="w-full text-sm" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                      <Th>Bölge</Th>
                      <Th>Ana rakip</Th>
                      <Th right>Aktif ilan</Th>
                      <Th right>Muhtemel satış</Th>
                      <Th right>Rakip medyan</Th>
                      <Th right>Bizim envanter</Th>
                      <Th right>Spread $/acre</Th>
                      <Th>Kanıt</Th>
                      <Th>Öncelik</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {bolgeler.map((r) => {
                      const p = r.oncelik ? ONCELIK[r.oncelik] || ONCELIK.RAKIP_ALANI : null;
                      return (
                        <Fragment key={r.anahtar}>
                          {/* County satırı — istihbarat ucundan */}
                          <tr style={{ borderTop: "1px solid var(--outline)" }}>
                            <Td>
                              <span className="font-medium capitalize">{r.countyEtiket}</span>{" "}
                              <span style={{ color: "var(--muted)" }}>{r.eyalet}</span>
                              {!r.istihbaratVar && (
                                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                                  county yoğunluk sıralamasında yok — sayılar yerleşim toplamı
                                </div>
                              )}
                            </Td>
                            <Td>{r.anaRakip || "—"}</Td>
                            <Td right>{fmtNum(r.aktif)}</Td>
                            <Td right style={{ color: (r.muhtemelSatis ?? 0) > 0 ? "var(--warn)" : undefined }}>
                              {fmtNum(r.muhtemelSatis)}
                            </Td>
                            <Td right>
                              {fmtMoney(r.medyanFiyat)}
                              <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                                {r.medyanPpa != null ? `${fmtMoney(r.medyanPpa)}/acre` : "—"}
                              </div>
                            </Td>
                            <Td right>
                              <span style={{ color: (r.leadCounty ?? 0) > 0 ? "var(--success)" : "var(--muted)" }}>
                                {fmtNum(r.leadCounty)} lead
                              </span>
                              <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                                eyalet: {fmtNum(r.leadEyalet)}
                              </div>
                            </Td>
                            <Td right style={{ color: "var(--muted)" }}>—</Td>
                            <Td style={{ color: "var(--muted)" }}>—</Td>
                            <Td>{p ? <Rozet bg={p.bg} fg={p.fg}>{p.label}</Rozet> : <span style={{ color: "var(--muted)" }}>—</span>}</Td>
                          </tr>

                          {/* Yerleşim alt satırları — pazar örtüşmesi ucundan */}
                          {r.altBolgeler.map((b) => {
                            const rozet = ORTUSME_ROZET[b.badge] ?? ORTUSME_ROZET.empty;
                            const rakipler = Object.entries(b.comp.byCompetitor).sort((x, y) => y[1] - x[1]);
                            return (
                              <tr key={`${r.anahtar}-${b.key}`} style={{ borderTop: "1px solid var(--outline)", background: "var(--surface)" }}>
                                <Td>
                                  <div className="flex items-center gap-1.5 pl-5">
                                    <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />
                                    <span className="font-medium">{b.label}</span>
                                  </div>
                                  <div className="pl-5">
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                                      style={{ background: rozet.bg, color: rozet.color }}
                                    >
                                      {b.badge === "proven" && <CheckCircle2 className="w-3 h-3" />}
                                      {rozet.label}
                                    </span>
                                  </div>
                                </Td>
                                <Td>
                                  <div className="flex flex-wrap gap-1">
                                    {rakipler.length === 0 && <span style={{ color: "var(--muted)" }}>—</span>}
                                    {rakipler.map(([ad, n]) => (
                                      <span
                                        key={ad}
                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                        style={{ background: "var(--surface-high)", color: RAKIP_RENK[ad] || "var(--foreground)" }}
                                      >
                                        {ad} {n}
                                      </span>
                                    ))}
                                  </div>
                                </Td>
                                <Td right>{fmtNum(b.comp.count)}</Td>
                                <Td right style={{ color: "var(--muted)" }}>—</Td>
                                <Td right>
                                  {b.comp.medianPpa != null ? (
                                    <span style={{ color: "var(--accent-ink)" }}>{fmtMoney(b.comp.medianPpa)}/acre</span>
                                  ) : (
                                    <span style={{ color: "var(--muted)" }}>comp gerekli</span>
                                  )}
                                  {b.comp.priceMin != null && (
                                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                                      {fmtMoney(b.comp.priceMin)} – {fmtMoney(b.comp.priceMax)}
                                    </div>
                                  )}
                                </Td>
                                <Td right>
                                  <span style={{ color: b.ours.total > 0 ? "var(--grade-a)" : "var(--muted)" }}>
                                    {fmtNum(b.ours.total)} alınabilir
                                  </span>
                                  <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                                    off-market {fmtNum(b.ours.offmarket)} · tax {fmtNum(b.ours.tax)}
                                  </div>
                                  <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                                    ort. alış {fmtMoney(b.ours.avgOffer)}
                                    {b.ours.medianPpa != null && <> · {fmtMoney(b.ours.medianPpa)}/acre</>}
                                  </div>
                                </Td>
                                <Td right>
                                  {b.spreadPerAcre != null ? (
                                    <span
                                      className="inline-flex items-center gap-1 font-bold"
                                      style={{ color: b.spreadPerAcre > 0 ? "var(--grade-a)" : "var(--grade-c)" }}
                                    >
                                      <TrendingUp className="w-3.5 h-3.5" />
                                      {b.spreadPerAcre > 0 ? "+" : ""}
                                      {fmtMoney(b.spreadPerAcre)}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--muted)" }}>iki taraflı $/acre gerekli</span>
                                  )}
                                </Td>
                                <Td>
                                  <div className="flex flex-wrap gap-1">
                                    {b.comp.samples.map((s, i) => (
                                      <a
                                        key={i}
                                        href={s.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold"
                                        style={{ background: "var(--surface-high)", color: "var(--foreground)" }}
                                        title={`${s.competitor}: ${s.title} (${s.acres ?? "?"} ac · ${fmtMoney(s.price)})`}
                                      >
                                        <ExternalLink className="w-3 h-3" /> {s.competitor} kanıt
                                      </a>
                                    ))}
                                    {b.comp.samples.length === 0 && <span style={{ color: "var(--muted)" }}>—</span>}
                                  </div>
                                  {b.comp.flagged > 0 && (
                                    <div className="text-[10px] mt-1" style={{ color: "var(--grade-c)" }}>
                                      ⚠ {fmtNum(b.comp.flagged)} aykırı (doğrulanmamış, medyan dışı)
                                    </div>
                                  )}
                                </Td>
                                <Td style={{ color: "var(--muted)" }}>—</Td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Bolum>

          {/* ── 2) RAKİP SON SATIŞLARI ───────────────────────────────────── */}
          <Bolum
            title="Rakip son satışları — muhtemel"
            subtitle="İlan snapshot'tan kayboldu = büyük olasılıkla satıldı (kesin değil). Kaybolma tarihine göre yeni→eski."
            icon={<TrendingDown size={18} style={{ color: "var(--warn)" }} />}
          >
            {(ist?.recentSales.length ?? 0) === 0 ? (
              <Bos text="Henüz kaybolan ilan yok — ilk diff sonrası birikir." />
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--outline)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                      <Th>Kaybolma</Th>
                      <Th>Rakip</Th>
                      <Th>Bölge</Th>
                      <Th right>Fiyat</Th>
                      <Th right>Acre</Th>
                      <Th right>DOM</Th>
                      <Th>Durum</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ist?.recentSales ?? []).map((s, i) => {
                      const rd = relDays(s.disappearedAt);
                      return (
                        <tr key={i} style={{ borderTop: "1px solid var(--outline)" }}>
                          <Td>
                            {fmtDate(s.disappearedAt)}
                            {rd != null && <span style={{ color: "var(--muted)" }}> · {rd}g önce</span>}
                          </Td>
                          <Td>{s.competitor || "—"}</Td>
                          <Td>
                            <span className="font-medium">{s.county || "—"}</span>
                            <span style={{ color: "var(--muted)" }}>
                              {" "}
                              {s.stateAbbr ? s.stateAbbr.toUpperCase() : s.state || ""}
                            </span>
                            {s.title && (
                              <div className="text-xs max-w-xs truncate" style={{ color: "var(--muted)" }}>
                                {s.title}
                              </div>
                            )}
                          </Td>
                          <Td right>{fmtMoney(s.price)}</Td>
                          <Td right>{s.acres ?? "—"}</Td>
                          <Td right>{s.domDays ?? "—"}</Td>
                          <Td>
                            {s.verified ? (
                              <Rozet bg="var(--success)" fg="#fff">Doğrulandı</Rozet>
                            ) : (
                              <Rozet bg="var(--warn)" fg="#000">Muhtemel</Rozet>
                            )}
                            {s.url && (
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex ml-1 align-middle"
                                style={{ color: "var(--accent)" }}
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Bolum>

          {/* ── 3) RAKİP BAŞINA ÖZET ─────────────────────────────────────── */}
          <Bolum
            title="Rakip başına özet"
            subtitle="Aktif ilan + muhtemel/doğrulanmış satış."
            icon={<Swords size={18} style={{ color: "var(--accent)" }} />}
          >
            {(ist?.competitorSummary.length ?? 0) === 0 ? (
              <Bos text="Rakip özeti yok." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(ist?.competitorSummary ?? []).map((c) => (
                  <div
                    key={c.competitor}
                    className="rounded-xl border p-4"
                    style={{ borderColor: "var(--outline)", background: "var(--surface)" }}
                  >
                    <div className="font-semibold mb-2">{c.competitor}</div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <div className="text-lg font-bold">{fmtNum(c.active)}</div>
                        <div style={{ color: "var(--muted)" }}>aktif</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: "var(--warn)" }}>{fmtNum(c.suspectedSold)}</div>
                        <div style={{ color: "var(--muted)" }}>muhtemel</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: "var(--success)" }}>{fmtNum(c.verifiedSold)}</div>
                        <div style={{ color: "var(--muted)" }}>doğrulanmış</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Bolum>
        </>
      )}
    </div>
  );
}

// ── Küçük bileşenler ──────────────────────────────────────────────────────────
function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--muted)" }}>
        {icon} {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Bolum({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">{icon} {title}</h2>
        <p className="text-xs mt-0.5 max-w-4xl" style={{ color: "var(--muted)" }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right, style }: { children: React.ReactNode; right?: boolean; style?: React.CSSProperties }) {
  return (
    <td className={`px-3 py-2 align-top ${right ? "text-right tabular-nums" : "text-left"}`} style={style}>
      {children}
    </td>
  );
}

function Rozet({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function Bos({ text }: { text: string }) {
  return (
    <div className="text-center py-12 rounded-xl border border-dashed text-sm" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
      {text}
    </div>
  );
}
