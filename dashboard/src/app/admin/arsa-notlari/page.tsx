"use client";

/**
 * ARSA NOTLARI — A+ VİTRİN (Ahmet demo sayfası).
 * 565K off-market yığınından not motorunun (A+..F) seçtiği GERÇEKTEN satılabilir
 * arsalar. Kartın ana mesajı ARSANIN CAZİBESİ: yol / elektrik / su / kasaba
 * mesafeleri (OSM Overpass gerçek verisi) + satıcı motivasyonu. Rakip bilgisi
 * yalnız "bu county'de pazar var" kanıtı olarak küçük gösterilir.
 * DÜRÜSTLÜK: her not, gerekçe bayraklarıyla (grade_flags) birlikte gösterilir;
 * tahmin/eksik veri açıkça işaretlenir, comp yoksa comp gösterilmez.
 */

import { useEffect, useMemo, useState } from "react";
import { Award, Loader2, AlertTriangle, MapPin, Layers, Filter } from "lucide-react";
import GradeBadge from "@/components/GradeBadge";
import NotKalibrasyon from "@/components/NotKalibrasyon";
import { GRADES, GRADE_LABELS, gradeColor, parseFlags, splitFlags, breakdownTitle } from "@/lib/offmarket-grade";
import { OFFMARKET_STATE_META } from "@/lib/offmarket-stats";

const ACCENT = "#059669";

type Card = {
  lead_id: string; state: string; county: string | null; region: string | null;
  apn: string | null; owner: string | null; situs: string | null; use: string | null;
  acres: number | null; land_value: number | null; est_offer: number | null;
  est_retail: number | null; est_margin: number | null; absentee: boolean | null;
  mailing_city: string | null; mailing_state: string | null;
  grade: string; grade_score: number; grade_flags: unknown; grade_breakdown?: unknown;
  dist_road_m: number | null; dist_power_m: number | null; dist_water_m: number | null;
  dist_town_m: number | null; geo_enriched_at: string | null; lat: number | null; lng: number | null;
  comp: { n: number; competitors: string[]; medPpa: number | null } | null;
};
type MxRow = { state: string; grade: string | null; n: number; geo_n: number };
type Payload = {
  schemaReady: boolean; note?: string; error?: string;
  funnel?: { total: number; graded: number; geoDone: number; aPlus: number; a: number; b: number };
  matrix?: MxRow[]; cards?: Card[];
};

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const fmt = (n: number) => n.toLocaleString("tr-TR");

export default function ArsaNotlari() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stFilter, setStFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/arsa-notlari")
      .then((r) => r.json())
      .then((d: Payload) => (d.error ? setErr(d.error) : setData(d)))
      .catch(() => setErr("ağ hatası"));
  }, []);

  const matrix = useMemo(() => {
    const by = new Map<string, Record<string, number>>();
    for (const r of data?.matrix ?? []) {
      if (!by.has(r.state)) by.set(r.state, {});
      const key = r.grade ?? "N/A"; // grade null = derecelendirilemedi (F değil)
      by.get(r.state)![key] = (by.get(r.state)![key] ?? 0) + r.n;
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const cards = useMemo(
    () => (data?.cards ?? []).filter((c) => !stFilter || c.state === stFilter),
    [data, stFilter]
  );
  const cardStates = useMemo(
    () => [...new Set((data?.cards ?? []).map((c) => c.state))].sort(),
    [data]
  );

  if (err)
    return (
      <div className="p-8">
        <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#d97706" }}>
          <AlertTriangle size={16} /> Yüklenemedi: {err}
        </p>
      </div>
    );
  if (!data)
    return (
      <div className="p-8 flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
        <Loader2 size={16} className="animate-spin" /> Not motoru özeti yükleniyor…
      </div>
    );
  if (!data.schemaReady)
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold">Arsa Notları</h1>
        <div className="mt-4 rounded-xl border p-5 text-sm" style={{ borderColor: "#d9770655", background: "#d977060f" }}>
          <p className="font-bold" style={{ color: "#d97706" }}>Not şeması henüz kurulmadı.</p>
          <p className="mt-2">
            Owner aksiyonu: <code className="font-mono">scraper/sql/offmarket_grades.sql</code> dosyasını
            psql/Supabase SQL Editor'da çalıştır, sonra <code className="font-mono">node scraper/grade-offmarket.mjs</code>.
          </p>
        </div>
      </div>
    );

  const f = data.funnel!;
  const gradedPct = f.total ? Math.round((f.graded / f.total) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Başlık */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span className="inline-grid place-items-center w-10 h-10 rounded-xl" style={{ background: `${ACCENT}1c` }}>
              <Award size={20} style={{ color: ACCENT }} />
            </span>
            Arsa Notları · A+ Vitrin
          </h1>
          <p className="mt-1 text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
            Not motoru {fmt(f.total)} off-market kaydı Amerikalı arsa alıcısının aradığı özelliklere göre
            puanlar: <b>yol erişimi, elektrik, su/göl yakınlığı, kasaba mesafesi</b> (OSM gerçek verisi) +
            pazar likiditesi + satıcı motivasyonu. Her notun gerekçesi kartta görünür.
          </p>
        </div>
      </div>

      {/* Huni şeridi */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ["Toplam lead", fmt(f.total), "15 eyalet, county kayıtlarından"],
          ["Puanlanan", `${fmt(f.graded)} (%${gradedPct})`, "not motoru — percentile eşikli"],
          ["Geo-doğrulanan", fmt(f.geoDone), "OSM yol/elektrik/su taraması"],
          ["A notu", fmt(f.a), GRADE_LABELS["A"]],
          ["A+ vitrin", fmt(f.aPlus), GRADE_LABELS["A+"]],
        ].map(([k, v, sub], i) => (
          <div key={i} className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: i >= 3 ? `${ACCENT}0d` : "var(--surface)" }}>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{k}</div>
            <div className="text-xl font-extrabold mt-1" style={{ color: i >= 3 ? ACCENT : "inherit" }}>{v}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {f.geoDone === 0 && (
        <div className="mt-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2" style={{ border: "1.5px solid #0891b255", background: "#0891b20f", color: "#0891b2" }}>
          <Layers size={15} /> Geo-doğrulama (OSM yol/elektrik/su taraması) henüz tamamlanmadı —
          A+/A notları geo verisi geldikçe açılır (<code className="font-mono">scraper/geo-enrich-offmarket.mjs</code> çalışıyor/çalıştırılmalı).
        </div>
      )}

      {/* Eyalet × not matrisi */}
      <div className="mt-6 rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--outline)" }}>
          Eyalet × not dağılımı — county-içi percentile: A+ ≈ %1 · A ≈ %4 · B %15 · C %30 · D %30 · F kalan · N/A = derecelendirilemedi (kamu sahipli / veri geçersiz)
        </div>
        <table className="w-full text-sm" style={{ minWidth: 560 }}>
          <thead>
            <tr style={{ color: "var(--muted)" }}>
              <th className="text-left px-4 py-2 font-bold text-xs">Eyalet</th>
              {[...GRADES, "N/A"].map((g) => (
                <th key={g} className="text-right px-3 py-2 font-bold text-xs" title={GRADE_LABELS[g]} style={{ color: gradeColor(g) }}>{g}</th>
              ))}
              <th className="text-right px-4 py-2 font-bold text-xs">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(([st, g]) => {
              const total = Object.values(g).reduce((a, b) => a + b, 0);
              const meta = OFFMARKET_STATE_META[st as keyof typeof OFFMARKET_STATE_META];
              return (
                <tr key={st} style={{ borderTop: "1px solid var(--outline)" }}>
                  <td className="px-4 py-2 font-bold">
                    <span style={{ color: meta?.color }}>{st}</span>
                    <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--muted)" }}>{meta?.region ?? ""}</span>
                  </td>
                  {[...GRADES, "N/A"].map((gr) => (
                    <td key={gr} className="text-right px-3 py-2 tabular-nums" style={{ color: g[gr] ? "inherit" : "var(--muted)", fontWeight: gr === "A+" || gr === "A" ? 700 : 400 }}>
                      {g[gr] ? fmt(g[gr]) : "·"}
                    </td>
                  ))}
                  <td className="text-right px-4 py-2 tabular-nums font-bold">{fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Kalibrasyon kanıtı — notun gerçekleşmiş satışlarla sınanması */}
      <NotKalibrasyon />

      {/* Vitrin kartları */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">A+ / A vitrin kartları</h2>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Filter size={13} style={{ color: "var(--muted)" }} />
          <button onClick={() => setStFilter("")} className="rounded-full px-3 py-1.5 font-bold" style={{ border: `1.5px solid ${!stFilter ? ACCENT : "var(--outline)"}`, color: !stFilter ? ACCENT : "var(--muted)" }}>Tümü</button>
          {cardStates.map((st) => (
            <button key={st} onClick={() => setStFilter(st)} className="rounded-full px-3 py-1.5 font-bold" style={{ border: `1.5px solid ${stFilter === st ? ACCENT : "var(--outline)"}`, color: stFilter === st ? ACCENT : "var(--muted)" }}>{st}</button>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="mt-4 text-sm rounded-xl border p-5" style={{ borderColor: "var(--outline)", background: "var(--surface)", color: "var(--muted)" }}>
          Henüz A+/A kartı yok. A+/A notu yalnız geo-doğrulanmış (OSM yol/elektrik/su) parsele verilir —
          geo taraması ilerledikçe vitrin dolacak. Dürüstlük kuralı: doğrulanmamış parsel vitrine çıkmaz.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c) => {
            const flags = parseFlags(c.grade_flags);
            const { appeal, other } = splitFlags(flags);
            const net =
              c.est_retail != null && c.est_offer != null
                ? c.est_retail - c.est_offer - 2000
                : c.est_margin != null ? c.est_margin - 2000 : null;
            return (
              <div key={c.lead_id} className="rounded-xl border p-5 flex flex-col gap-3" style={{ borderColor: c.grade === "A+" ? `${ACCENT}66` : "var(--outline)", background: "var(--surface)" }}>
                <div className="flex items-start gap-3">
                  <GradeBadge grade={c.grade} size="lg" title={breakdownTitle(c.grade_breakdown, c.grade_score) ?? GRADE_LABELS[c.grade]} />
                  <div className="min-w-0">
                    <div className="font-bold truncate">{c.owner ?? "—"}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {(c.county ?? c.region ?? "—")}, {c.state} · {c.acres != null ? `${c.acres} acre` : "acre —"} · APN {c.apn ?? "—"}
                    </div>
                  </div>
                  <span className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: "var(--muted)" }}>skor {c.grade_score}</span>
                </div>

                {/* CAZİBE ROZETLERİ — kartın ana mesajı */}
                {appeal.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {appeal.map((a, i) => (
                      <span key={i} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: a.startsWith("⛔") ? "#dc26261a" : `${ACCENT}12`, color: a.startsWith("⛔") ? "#dc2626" : ACCENT, border: `1px solid ${a.startsWith("⛔") ? "#dc262644" : `${ACCENT}33`}` }}>
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                {/* Ekonomi — ikincil satır */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[["Alış teklifi", usd(c.est_offer)], ["Hedef satış", usd(c.est_retail)], ["Net marj*", usd(net)]].map(([k, v]) => (
                    <div key={k} className="rounded-lg px-2 py-2" style={{ background: "var(--surface-high, rgba(0,0,0,0.03))" }}>
                      <div className="text-[10px] font-bold uppercase" style={{ color: "var(--muted)" }}>{k}</div>
                      <div className="text-sm font-bold tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Pazar kanıtı — sadece varsa, küçük */}
                {c.comp && (
                  <div className="text-[11px] rounded-lg px-3 py-2" style={{ background: "#0891b20d", color: "#0891b2", border: "1px solid #0891b226" }}>
                    Pazar kanıtı: {c.comp.competitors.join(" + ")} bu county'de {c.comp.n} ilan taşıyor
                    {c.comp.medPpa != null ? ` (ort. ~$${c.comp.medPpa.toLocaleString("en-US")}/acre)` : ""} → alıcı talebi kanıtlı.
                  </div>
                )}

                {/* Diğer gerekçe bayrakları */}
                {other.length > 0 && (
                  <ul className="text-[11px] space-y-0.5" style={{ color: "var(--muted)" }}>
                    {other.map((o, i) => (
                      <li key={i}>• {o}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
                  <span>{c.situs || c.use || ""}</span>
                  {c.lat != null && c.lng != null && (
                    <a
                      className="inline-flex items-center gap-1 font-bold"
                      style={{ color: ACCENT }}
                      href={`https://www.google.com/maps/@${c.lat},${c.lng},1200m/data=!3m1!1e3`}
                      target="_blank" rel="noreferrer"
                    >
                      <MapPin size={12} /> uydu görüntüsü
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-[11px]" style={{ color: "var(--muted)" }}>
        * Net marj = hedef satış − alış teklifi − ~$2.000 sabit gider (kapanış+vergi+outreach). Mesafeler OSM
        Overpass verisinden yaklaşık (~) değerdir. "Değer TAHMİNİ" bayraklı kartlarda county değerlemesi yoktur;
        rakip $/acre comp'undan tahmin edilmiştir. "Assessed bazlı spread" bayraklı kartlarda county assessor'ın
        assessed değeri kullanılmıştır — assessed değer piyasa değeri DEĞİLDİR; ikisi de satın almadan önce doğrulanmalıdır.
      </p>
    </div>
  );
}
