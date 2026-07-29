import Link from "next/link";
import { Globe, Sparkles, ArrowLeft } from "lucide-react";
import { getDeals, SOURCE_LABELS, type UnifiedDeal } from "@/lib/unified-deals";
import { toBuyerParcel } from "@/lib/buyer-parcel";
import { buildBuyerListing } from "@/lib/listing-builder";
import IlanUreteciEditor from "../ilan-ureteci/editor";
import { CopyAllButton, CopyLinkButton, OpenLinkButton } from "./copy-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Satış Sayfaları & İlan Üreteci — VegaLand" };

// ─────────────────────────────────────────────────────────────────────────────
// SATIŞ SAYFALARI (admin, Türkçe) — envanterdeki HER deal'in zaten canlı olan
// /p/[id] İngilizce satış sayfasını listeler: hangi parselin paylaşılabilir
// linki var, fiyatı ne görünüyor (alıcı gözünden), tek tık kopyala.
// Alıcı fiyatı toBuyerParcel üzerinden alınır → burada gösterilen fiyat,
// müşterinin gördüğü fiyatın TA KENDİSİ (spread/teklif değil).
//
// 2026-07 birleştirme: eski `admin/ilan-ureteci` ekranı buraya taşındı.
// `?id=<parselId>` verildiğinde liste yerine İLAN ÜRETECİ editörü açılır
// (buildBuyerListing + IlanUreteciEditor + /api/admin/listing-publish).
// Diğer parametreler (src/all/q/n) `?id=` eklenirken korunur, "Listeye dön"
// bağlantısıyla aynen geri yüklenir → filtre kaybı olmaz.
// ─────────────────────────────────────────────────────────────────────────────

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const GREEN = "#16a34a";
const PURPLE = "#8b5cf6";
const GRADE_COLOR: Record<string, string> = { A: "var(--grade-a)", B: "var(--warn)", C: "var(--muted)" };

type SP = { src?: string; all?: string; q?: string; n?: string; id?: string };

export default async function SatisSayfalariPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const src = sp.src || "";
  const showAll = sp.all === "1";
  const q = (sp.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(sp.n) || 150, 20), 1000);
  const selId = (sp.id || "").trim();

  const deals = await getDeals();

  // Alıcı gözünden fiyat: whitelist projeksiyonu (tek doğruluk kaynağı).
  const withPrice = deals.map((d) => ({ deal: d, buyer: toBuyerParcel(d) }));
  const pricedCount = withPrice.filter((x) => x.buyer.price > 0).length;

  const bySource = new Map<string, { total: number; priced: number }>();
  for (const x of withPrice) {
    const s = bySource.get(x.deal.source) ?? { total: 0, priced: 0 };
    s.total++; if (x.buyer.price > 0) s.priced++;
    bySource.set(x.deal.source, s);
  }

  let rows = withPrice;
  if (src) rows = rows.filter((x) => x.deal.source === src);
  if (!showAll) rows = rows.filter((x) => x.buyer.price > 0);
  if (q) {
    rows = rows.filter((x) =>
      [x.buyer.county, x.buyer.region, x.buyer.state, x.buyer.apn, x.buyer.address]
        .some((v) => v && v.toLowerCase().includes(q))
    );
  }

  // En satılabilir üstte: grade A → B → C → gradesiz, sonra fiyat.
  const gradeRank = (d: UnifiedDeal) => (d.dealGrade === "A" ? 0 : d.dealGrade === "B" ? 1 : d.dealGrade === "C" ? 2 : 3);
  rows.sort((a, b) => gradeRank(a.deal) - gradeRank(b.deal) || b.buyer.price - a.buyer.price);

  const totalMatch = rows.length;
  rows = rows.slice(0, limit);

  // Filtre parametrelerini TEK yerden kurar; `id` de bir parametre olduğu için
  // ilan üretecine girip çıkarken src/all/q/n hiçbir zaman kaybolmaz.
  const linkQS = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged: SP = { src, all: showAll ? "1" : "", q: sp.q || "", n: sp.n || "", id: "", ...over };
    if (merged.src) p.set("src", merged.src);
    if (merged.all === "1") p.set("all", "1");
    if (merged.q) p.set("q", merged.q);
    if (merged.n) p.set("n", merged.n);
    if (merged.id) p.set("id", merged.id);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  // ── İlan üreteci modu: `?id=` varsa liste yerine editör açılır ──────────────
  const selDeal = selId ? deals.find((d) => d.id === selId) : undefined;
  if (selId) {
    // Fiyatsız/filtre dışı parsel de id ile açılabilsin diye ham deals'ten okunur.
    const selBuyer = selDeal ? toBuyerParcel(selDeal) : null;
    const listing = selBuyer ? buildBuyerListing(selBuyer) : null;

    return (
      <div className="space-y-6 p-6" style={{ color: "var(--foreground)" }}>
        <header>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: PURPLE }}>
            LANDiO-tarzı · AI/Şablon
          </div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold">
            <Sparkles className="h-6 w-6" style={{ color: PURPLE }} /> İlan Üreteci
          </h1>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
            Başlık, ikna edici açıklama, öne çıkanlar, konum/GIS özeti ve owner-finance taksit
            senaryosu tek tıkla üretilir. Gözden geçir, düzenle, <strong>/p satış sayfasına yayınla</strong>.
            Metin taslaktır; zoning/izin alıcıya county&apos;den doğrulatılır.
          </p>
        </header>

        {/* Listeye dönerken mevcut filtreler (src / all / q / n) korunur */}
        <Link href={linkQS({ id: "" })} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--muted)" }}>
          <ArrowLeft className="h-4 w-4" /> Listeye dön
        </Link>

        {selBuyer && listing ? (
          <div className="rounded-xl border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
              Parsel <span className="font-mono">{selBuyer.apn || selBuyer.id}</span> ·{" "}
              {[selBuyer.region && selBuyer.region !== selBuyer.county ? selBuyer.region : "", selBuyer.county && `${selBuyer.county} Co.`, selBuyer.state].filter(Boolean).join(", ")}
            </div>
            <IlanUreteciEditor parcelId={selBuyer.id} pUrl={`/p/${encodeURIComponent(selBuyer.id)}`} initial={listing} />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
            <span className="font-mono">{selId}</span> kimlikli parsel envanterde bulunamadı.
          </p>
        )}

        <div className="rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
          <strong style={{ color: "var(--warn)" }}>Güvenlik:</strong> Üretilen ilan yalnızca buyer-safe alanlardan kurulur
          (toBuyerParcel beyaz-listesi) — sahip adı, teklif, spread, comp değeri, grade ASLA ilana girmez (testli).
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" style={{ color: "var(--foreground)" }}>
      <header>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GREEN }}>
          ✅ Canlı · Müşteri Yüzü
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <Globe className="h-6 w-6" style={{ color: GREEN }} /> Satış Sayfaları (/p linkleri)
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          Envanterdeki her parselin <strong>İngilizce, herkese açık</strong> satış sayfası zaten canlı — burası link deposu.
          Alıcıya WhatsApp&apos;tan link at, gerisini sayfa anlatır. Gösterilen fiyat alıcının gördüğü fiyattır
          (comp-bazlı; comp yoksa sayfa &quot;contact for pricing&quot; der).
        </p>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          Metni değiştirmek istersen satırdaki <strong style={{ color: PURPLE }}>ilan üret</strong> ile
          İlan Üreteci aynı ekranda açılır (eski <code>/admin/ilan-ureteci</code> buraya taşındı).
        </p>
      </header>

      {/* Özet */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Toplam satış sayfası" value={deals.length.toLocaleString("en-US")} />
        <Stat label="Fiyatlı (comp'lu) sayfa" value={pricedCount.toLocaleString("en-US")} accent />
        <Stat label="Bu filtrede" value={totalMatch.toLocaleString("en-US")} />
      </div>

      {/* Kaynak filtresi + arama */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href={linkQS({ src: "" })} className="rounded-md px-2.5 py-1.5 text-xs font-semibold"
          style={{ background: !src ? "var(--accent-ink)" : "var(--surface-high)", color: !src ? "var(--background)" : "var(--muted)" }}>
          Hepsi
        </Link>
        {[...bySource.entries()].map(([s, c]) => (
          <Link key={s} href={linkQS({ src: s })} className="rounded-md px-2.5 py-1.5 text-xs font-semibold"
            style={{ background: src === s ? "var(--accent-ink)" : "var(--surface-high)", color: src === s ? "var(--background)" : "var(--muted)" }}>
            {SOURCE_LABELS[s] ?? s} <span style={{ color: src === s ? undefined : GREEN }}>{c.priced.toLocaleString("en-US")}</span>
          </Link>
        ))}
        <Link href={linkQS({ all: showAll ? "" : "1" })} className="rounded-md border border-dashed px-2.5 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--outline)", color: showAll ? "var(--warn)" : "var(--muted)" }}>
          {showAll ? "✓ fiyatsızlar da görünüyor" : "fiyatsızları da göster"}
        </Link>
        <form className="ml-auto flex items-center gap-2" action="">
          {src && <input type="hidden" name="src" value={src} />}
          {showAll && <input type="hidden" name="all" value="1" />}
          {sp.n && <input type="hidden" name="n" value={sp.n} />}
          <input name="q" defaultValue={sp.q || ""} placeholder="county / bölge / APN ara…"
            className="rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: "var(--outline)" }} />
          <button type="submit" className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--surface-high)" }}>Ara</button>
        </form>
        <CopyAllButton ids={rows.map((x) => x.buyer.id)} />
      </div>

      {/* Liste */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
              <th className="px-3 py-2.5 font-bold">Parsel</th>
              <th className="px-3 py-2.5 font-bold">Konum</th>
              <th className="px-3 py-2.5 text-right font-bold">Acre</th>
              <th className="px-3 py-2.5 text-right font-bold">Alıcı fiyatı</th>
              <th className="px-3 py-2.5 text-center font-bold">Grade</th>
              <th className="px-3 py-2.5 font-bold">Kaynak</th>
              <th className="px-3 py-2.5 font-bold">Satış linki / ilan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ deal, buyer }) => (
              <tr key={buyer.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--muted)" }}>{buyer.apn || buyer.id}</td>
                <td className="px-3 py-2 font-medium">
                  {[buyer.region && buyer.region !== buyer.county ? buyer.region : "", buyer.county && `${buyer.county} Co.`, buyer.state]
                    .filter(Boolean).join(", ")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{buyer.acres ? buyer.acres.toFixed(2) : "—"}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: buyer.price > 0 ? GREEN : "var(--muted)" }}>
                  {buyer.price > 0 ? usd(buyer.price) : "fiyat sorulur"}
                </td>
                <td className="px-3 py-2 text-center">
                  {deal.dealGrade ? (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--surface-high)", color: GRADE_COLOR[deal.dealGrade] ?? "var(--muted)" }}>
                      {deal.dealGrade}
                    </span>
                  ) : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>{deal.sourceLabel}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <CopyLinkButton id={buyer.id} /> <OpenLinkButton id={buyer.id} />{" "}
                  {/* İlan üreteci aynı ekranda açılır; mevcut filtreler linkQS ile korunur */}
                  <Link
                    href={linkQS({ id: buyer.id })}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-[var(--surface-high)]"
                    style={{ color: PURPLE }}
                    title="Bu parsel için ilan metni üret ve /p sayfasına yayınla"
                  >
                    <Sparkles className="h-3 w-3" /> ilan üret
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Bu filtrede sayfa yok.</p>
        )}
      </div>
      {totalMatch > rows.length && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          İlk {rows.length.toLocaleString("en-US")} gösteriliyor (toplam {totalMatch.toLocaleString("en-US")} eşleşme) —
          daraltmak için kaynak/arama filtrelerini kullan.
        </p>
      )}

      <div className="rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
        <strong style={{ color: "var(--warn)" }}>Güvenlik notu:</strong> /p sayfaları toBuyerParcel beyaz-listesinden geçer —
        sahip adı, teklif, spread, comp değeri, grade gibi iç alanlar alıcıya <strong>hiçbir koşulda</strong> gitmez (testli).
        Grade kolonu sadece bu admin ekranında, &quot;önce hangisini paylaşayım&quot; sıralaması için.
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1 text-xl font-bold" style={accent ? { color: GREEN } : undefined}>{value}</div>
    </div>
  );
}
