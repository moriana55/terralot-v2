// ─────────────────────────────────────────────────────────────────────────────
// MÜŞTERİ SUNUM SAYFASI — tek giriş noktası, "3 ekranda tak tak" anlatım.
// Panel çok sayfalı + veri-yoğun; Ahmet'e (müşteri) canlı demoda kafa karıştırıyor.
// Bu sayfa hikâyeyi anlatır (huni → maliyet → 2 aksiyon) ve oradan mevcut
// gerçek sayfalara (harita, kampanya kurucu) yönlendirir. Veri tablosu YOK.
//
// Rakamlar HARD-CODE DEĞİL: aynı motor (mohave-score.ts + mohave-campaign.ts)
// runtime'da hesaplanır — mohave/page.tsx ve mohave/kampanya/page.tsx ile aynı
// kaynaktan (src/data/mohave-offmarket.json). Sadece "63.192 uygun parsel"
// (Mohave taraması, snapshot'tan ÖNCEKİ geniş havuz) ve cevap oranı bandı
// (%1-3, sektör kıyaslaması) sabit metindir — snapshot içi rakamlar değildir.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import data from "@/data/mohave-offmarket.json";
import { scoreAllRows } from "@/lib/mohave-score";
import { buildTop750Campaign, type MohaveRow } from "@/lib/mohave-campaign";
import { Map as MapIcon, Send, Sparkles } from "lucide-react";

export const metadata = { title: "Sunum — Mohave Operasyonu — Terralot" };

const GREEN = "#16a34a";

// Sabit iş kuralı: Lob mektup başına posta maliyeti + aylık Lob abonelik ücreti.
// Parsel/skor verisinden TÜRETİLMEZ (fiyatlandırma sabiti) — bu yüzden burada
// sabit; mektup SAYISI (yukarıdaki 449) canlı hesaptır.
const POSTAGE_PER_LETTER = 0.8;
const LOB_MONTHLY_FEE = 260;

// Mohave taraması: county genelinde uygun (boş, satılabilir) parsel evreni.
// Bu 20.000'lik snapshot'ın ÜSTÜNDEKİ geniş havuz — scraper/mohave-offmarket.mjs
// çalıştırıldığında bu sayı da güncellenir; şimdilik anlatım sabiti.
const ELIGIBLE_UNIVERSE = 63_192;
const RESPONSE_RATE_LOW = 0.01;
const RESPONSE_RATE_HIGH = 0.03;

export default function SunumPage() {
  const rows = (data.rows as MohaveRow[]) ?? [];
  const poolCount = data.count ?? rows.length;

  const scoredPool = scoreAllRows(rows);
  const poolAvgScore = scoredPool.length
    ? Math.round((scoredPool.reduce((a, r) => a + r.offmarket_score, 0) / scoredPool.length) * 10) / 10
    : 0;

  const top750 = buildTop750Campaign(rows, 750);
  const lettersCount = top750.letters.length;
  const consideredParcels = top750.consideredParcels;
  const topAvgScore = top750.avgScore;

  const meetingsLow = Math.max(1, Math.ceil(lettersCount * RESPONSE_RATE_LOW));
  const meetingsHigh = Math.max(meetingsLow, Math.floor(lettersCount * RESPONSE_RATE_HIGH));

  const postage = Math.round(lettersCount * POSTAGE_PER_LETTER * 100) / 100;
  const totalPilot = Math.round((postage + LOB_MONTHLY_FEE) * 100) / 100;

  const topRegions = Object.entries(top750.regionBreakdown).sort((a, b) => b[1] - a[1]);

  // Huni çubukları — CSS ile, kütüphane yok. Genişlik = log ölçek yerine basit
  // orantı (en büyük adım %100, diğerleri göreli).
  const funnelSteps: { label: string; value: number; note?: string }[] = [
    { label: "Uygun parsel (Mohave taraması)", value: ELIGIBLE_UNIVERSE },
    { label: "Snapshot içinde", value: poolCount },
    { label: "⭐ En İyi 750 (algoritma)", value: consideredParcels },
    { label: "Mektup (sahip dedupe)", value: lettersCount },
  ];
  const maxVal = funnelSteps[0].value;

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-8 md:p-12" style={{ color: "var(--foreground)" }}>
      {/* ── 1. Başlık ── */}
      <header className="space-y-3 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: GREEN }}>
          Terralot · Mohave County, AZ
        </div>
        <h1 className="text-[34px] font-extrabold leading-tight md:text-[42px]">
          Mohave Off-Market Operasyonu
        </h1>
        <p className="mx-auto max-w-2xl text-lg" style={{ color: "var(--muted)" }}>
          İcra değil — <strong style={{ color: "var(--foreground)" }}>arsasını unutmuş sahiplere</strong> doğrudan nakit teklif.
        </p>
      </header>

      {/* ── 2. Huni ── */}
      <section className="space-y-4 rounded-2xl border p-6 md:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Huni — 63.192 parselden 449 mektuba</h2>
        <div className="space-y-3">
          {funnelSteps.map((s, i) => {
            const pct = Math.max(6, Math.round((s.value / maxVal) * 100));
            return (
              <div key={i}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span style={{ color: "var(--muted)" }}>{s.label}</span>
                  <span className="text-xl font-extrabold tabular-nums" style={{ color: i === funnelSteps.length - 1 ? GREEN : "var(--foreground)" }}>
                    {s.value.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full" style={{ background: "var(--surface-high)" }}>
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{ width: `${pct}%`, background: i === funnelSteps.length - 1 ? GREEN : "var(--accent-ink)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid gap-3 border-t pt-4 text-sm md:grid-cols-2" style={{ borderColor: "var(--border)" }}>
          <div>
            <span style={{ color: "var(--muted)" }}>Skor kalitesi: </span>
            <strong style={{ color: GREEN }}>{topAvgScore}</strong>/100 (En İyi 750) vs{" "}
            <strong>{poolAvgScore}</strong>/100 (havuz ortalaması)
          </div>
          <div>
            <span style={{ color: "var(--muted)" }}>Hedef: </span>
            %{RESPONSE_RATE_LOW * 100}–{RESPONSE_RATE_HIGH * 100} cevap ≈{" "}
            <strong style={{ color: GREEN }}>{meetingsLow}–{meetingsHigh} görüşme</strong> → 1–3 alım
          </div>
        </div>
        {topRegions.length > 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Bölge ağırlığı (En İyi 750 içinde): {topRegions.map(([reg, n]) => `${reg} ${n}`).join(" · ")}
          </p>
        )}
      </section>

      {/* ── 3. Maliyet şeridi ── */}
      <section className="grid gap-4 rounded-2xl border p-6 md:grid-cols-3 md:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <Cost label="Posta (449 mektup)" value={`$${postage.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
        <Cost label="Lob aboneliği" value={`$${LOB_MONTHLY_FEE.toLocaleString("en-US")}`} />
        <Cost label="Pilot toplamı" value={`$${totalPilot.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} accent />
      </section>

      {/* ── 4. İki büyük buton ── */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/alinabilir-harita"
          className="flex items-center justify-center gap-3 rounded-2xl px-8 py-8 text-xl font-extrabold transition-opacity hover:opacity-90"
          style={{ background: "var(--surface-high)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          <MapIcon className="h-7 w-7" style={{ color: GREEN }} /> 1 · Haritada Gör
        </Link>
        <Link
          href="/admin/mohave/kampanya"
          className="flex items-center justify-center gap-3 rounded-2xl px-8 py-8 text-xl font-extrabold text-white transition-opacity hover:opacity-90"
          style={{ background: GREEN }}
        >
          <Send className="h-7 w-7" /> 2 · Kampanyayı Başlat
        </Link>
      </section>

      {/* ── 5. Sırada ne var ── */}
      <footer className="flex items-center justify-center gap-2 border-t pt-6 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>Sırada: Rakip tapu analizi · Florida/NM genişlemesi (PropStream) · AI ilan üreteci</span>
      </footer>
    </div>
  );
}

function Cost({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums" style={accent ? { color: GREEN } : undefined}>{value}</div>
    </div>
  );
}
