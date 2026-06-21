// ─────────────────────────────────────────────────────────────────────────────
// ARSA DEĞERLEME PANELİ — "bir arsayı değerlerken baktıklarımız".
// DÜRÜSTLÜK: her veri güvenilirliğine göre etiketli →
//   ✅ Doğrulanmış (HCAD/kamu, hcad.org'da kontrol edilebilir)
//   🔢 Hesaplanmış (gösterilen gerçek rakamlardan türetilmiş)
//   ⏳ DD'de teyit (henüz veri yok — kontrol listesi)
// Uydurma rakam yok. Tahminler açıkça "tahmini" yazar.
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/cheap-land.json";
import Link from "next/link";
import { ArrowLeft, Satellite, MailPlus, CheckCircle2, Calculator, Clock, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

interface Deal {
  id: string; owner: string; mailAddr: string; property: string; county: string; state: string;
  taxDebt: number; mapUrl: string; apn?: string | null; acres?: number | null;
  landValue?: number | null; marketValue?: number | null; vacant?: boolean; landUse?: string | null;
  spread?: number; spreadPct?: number; grade?: string; noDeal?: boolean;
}

export function generateStaticParams() {
  return (data.deals as Deal[]).map((d) => ({ id: d.id }));
}

export default async function ArsaDegerlemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = (data.deals as Deal[]).find((x) => x.id === id);
  if (!d) return notFound();

  const street = d.property.split(",")[0].replace(/^0\s+/, "").trim();
  const gradeColor = d.grade === "A" ? "#16a34a" : d.grade === "B" ? "#eab308" : d.grade === "C" ? "#f97316" : "var(--muted)";

  const Badge = ({ kind }: { kind: "ok" | "calc" | "dd" }) => {
    const map = {
      ok: { t: "✅ DOĞRULANMIŞ", c: "#16a34a", b: "rgba(22,163,74,0.12)" },
      calc: { t: "🔢 HESAPLANMIŞ", c: "#3b82f6", b: "rgba(59,130,246,0.12)" },
      dd: { t: "⏳ DD'DE TEYİT", c: "#eab308", b: "rgba(234,179,8,0.12)" },
    }[kind];
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: map.b, color: map.c }}>{map.t}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/admin/ucuz-arsa" className="inline-flex items-center gap-1 text-xs mb-5" style={{ color: "var(--muted)" }}>
        <ArrowLeft className="w-3 h-3" /> Ucuz Boş Arsa listesine dön
      </Link>

      <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "var(--primary,#16a34a)" }}>ARSA DEĞERLEME PANELİ</div>
      <h1 className="text-[26px] font-bold">{d.property}</h1>
      <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>{d.county}, {d.state}{d.vacant ? " · boş arsa ✓" : ""}{d.landUse ? ` · ${d.landUse}` : ""}</p>
      <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>Bir arsayı değerlendirirken baktığımız her şey aşağıda — her veri kaynağı ve güvenilirliğiyle.</p>

      {/* karar şeridi */}
      <div className="rounded-xl border p-5 mb-6 flex items-center gap-5 flex-wrap" style={{ borderColor: gradeColor, background: "var(--surface)" }}>
        <div className="text-center">
          <div className="text-4xl font-black" style={{ color: gradeColor }}>{d.grade ?? "—"}</div>
          <div className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>Deal kalitesi</div>
        </div>
        <div className="text-sm flex-1 min-w-[240px]">
          {d.noDeal ? (
            <span>Borç ≈ değer → <b>spread yok, deal değil.</b> (Bu kayıtta vergi borcu rakamı değere eşit; placeholder olabilir, atla.)</span>
          ) : (
            <span><b style={{ color: gradeColor }}>Spread {fmt(d.spread)}</b> (değerin %{d.spreadPct}'i). {(d.spreadPct ?? 0) >= 70 ? "Güçlü fırsat — değer borcun çok üstünde." : (d.spreadPct ?? 0) >= 40 ? "Makul fırsat." : "Zayıf — spread dar."}</span>
          )}
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{(data as { gradeNote?: string }).gradeNote}</div>
        </div>
      </div>

      {/* 1. DOĞRULANMIŞ */}
      <section className="rounded-xl border p-5 mb-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4" style={{ color: "#16a34a" }} /><h2 className="font-bold text-sm">Doğrulanmış Veriler</h2><Badge kind="ok" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>HCAD Arsa Değeri</div><div className="font-bold text-lg">{fmt(d.landValue)}</div></div>
          <div><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Vergi Borcu</div><div className="font-bold text-lg text-amber-500">{fmt(d.taxDebt)}</div></div>
          <div><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Dönüm</div><div className="font-bold text-lg">{d.acres && d.acres > 0 ? `${d.acres.toFixed(2)} ac` : "—"}</div></div>
          <div><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Boş arsa</div><div className="font-bold">{d.vacant ? "Evet ✓ (yapı $0)" : "?"}</div></div>
          <div className="col-span-2"><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Sahip · posta adresi (mektup)</div><div className="font-medium text-xs">{d.owner}<br />{d.mailAddr}</div></div>
        </div>
        <div className="mt-4 text-xs flex items-center gap-2 flex-wrap" style={{ color: "var(--muted)" }}>
          <span>Kaynak: <b>HCAD (Harris County resmi değerleme dairesi)</b> + kamu vergi kaydı.</span>
          {d.apn && <a href="https://hcad.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">hcad.org'da doğrula → account {d.apn} <ExternalLink className="w-3 h-3" /></a>}
        </div>
      </section>

      {/* 2. HESAPLANMIŞ */}
      <section className="rounded-xl border p-5 mb-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-3"><Calculator className="w-4 h-4" style={{ color: "#3b82f6" }} /><h2 className="font-bold text-sm">Fırsat Analizi</h2><Badge kind="calc" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Spread (değer − borç)</div><div className="font-bold text-lg" style={{ color: gradeColor }}>{fmt(d.spread)}</div></div>
          <div><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Spread oranı</div><div className="font-bold text-lg">%{d.spreadPct ?? 0}</div></div>
          <div><div className="text-[11px] uppercase" style={{ color: "var(--muted)" }}>Resale (HCAD değeri)</div><div className="font-bold">{fmt(d.landValue)} <span className="text-[10px]" style={{ color: "var(--muted)" }}>comp ile teyit</span></div></div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>Bu kutudaki her sayı yukarıdaki doğrulanmış rakamlardan aritmetikle çıkar — uydurma yok.</p>
      </section>

      {/* 3. DD'DE TEYİT — saha/altyapı (off-grid/buildable kriterleri) */}
      <section className="rounded-xl border p-5 mb-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-3"><Clock className="w-4 h-4" style={{ color: "#eab308" }} /><h2 className="font-bold text-sm">Saha & Altyapı (Due Diligence kontrol listesi)</h2><Badge kind="dd" /></div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--outline)" }}><span>🛣️ Yol erişimi</span><span style={{ color: "var(--foreground)" }}>{street} cephesi (adresten) · haritadan teyit</span></div>
          <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--outline)" }}><span>⚡ Elektrik</span><span style={{ color: "var(--muted)" }}>henüz veri yok — DD'de teyit (utility map)</span></div>
          <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--outline)" }}><span>💧 Su / kuyu / septik</span><span style={{ color: "var(--muted)" }}>henüz veri yok — DD'de teyit</span></div>
          <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--outline)" }}><span>🏗️ İmar / kısıtlama (zoning)</span><span style={{ color: "var(--muted)" }}>henüz veri yok — county'den teyit</span></div>
          <div className="flex justify-between"><span>🌊 Sel bölgesi (flood zone)</span><span style={{ color: "var(--muted)" }}>henüz veri yok — FEMA map'ten teyit</span></div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>Bunları henüz veriyle doldurmadık — Landio gibi göstermek için sonraki adımda GIS/utility verisi bağlanır. Şimdilik dürüstçe "teyit edilecek".</p>
      </section>

      {/* 4. STRATEJİ */}
      <section className="rounded-xl border p-5 mb-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <h2 className="font-bold text-sm mb-2">Strateji</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Model: sahibe (<b style={{ color: "var(--foreground)" }}>{d.owner}</b>, {d.mailAddr}) mektup → <i>“arsanı alırım, vergi borcunu hallederim”</i> → ucuza kapat → taksitle (owner-finance) sat.
          {!d.noDeal && <> Alış hedefi <b style={{ color: "var(--foreground)" }}>borç ({fmt(d.taxDebt)}) + birkaç bin nakit</b> (tahmini, pazarlığa bağlı), resale ~{fmt(d.landValue)} (comp ile teyit).</>}
        </p>
      </section>

      <div className="flex gap-2">
        <a href={d.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--outline)" }}><Satellite className="w-4 h-4" /> Uydu / Harita</a>
        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(22,163,74,0.12)", color: "var(--primary,#16a34a)" }}><MailPlus className="w-4 h-4" /> Mektup at</span>
      </div>
    </div>
  );
}
