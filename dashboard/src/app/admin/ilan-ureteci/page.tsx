import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { getDeals, type UnifiedDeal } from "@/lib/unified-deals";
import { toBuyerParcel } from "@/lib/buyer-parcel";
import { buildBuyerListing } from "@/lib/listing-builder";
import IlanUreteciEditor from "./editor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "İlan Üreteci — Terralot" };

// ─────────────────────────────────────────────────────────────────────────────
// İLAN ÜRETECİ (admin) — parsel seç → tek tıkla YAYINA-HAZIR ilan üret → önizle
// → /p satış sayfasına yayınla. Composer (lib/listing-builder) SADECE buyer-safe
// BuyerParcel alır → marj/alış-maliyeti/kâr ilana YAPISAL olarak sızamaz.
// ─────────────────────────────────────────────────────────────────────────────

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const GREEN = "#16a34a";

type SP = { id?: string; q?: string; n?: string };

export default async function IlanUreteciPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const selId = (sp.id || "").trim();
  const q = (sp.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(sp.n) || 60, 20), 500);

  const deals = await getDeals();
  const rows = deals
    .map((d) => ({ deal: d, buyer: toBuyerParcel(d) }))
    .filter((x) => x.buyer.price > 0)
    .filter((x) =>
      !q ||
      [x.buyer.county, x.buyer.region, x.buyer.state, x.buyer.apn, x.buyer.address]
        .some((v) => v && v.toLowerCase().includes(q))
    );

  const gradeRank = (d: UnifiedDeal) => (d.dealGrade === "A" ? 0 : d.dealGrade === "B" ? 1 : d.dealGrade === "C" ? 2 : 3);
  rows.sort((a, b) => gradeRank(a.deal) - gradeRank(b.deal) || b.buyer.price - a.buyer.price);

  // Seçili parsel: fiyatsız/filtre-dışı da olsa id ile erişilebilsin (deals'ten çek).
  const selDeal = selId ? deals.find((d) => d.id === selId) : undefined;
  const selected = selDeal ? { deal: selDeal, buyer: toBuyerParcel(selDeal) } : null;

  const listing = selected ? buildBuyerListing(selected.buyer) : null;
  const visible = rows.slice(0, limit);

  return (
    <div className="space-y-6 p-6" style={{ color: "var(--foreground)" }}>
      <header>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8b5cf6" }}>
          LANDiO-tarzı · AI/Şablon
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <Sparkles className="h-6 w-6" style={{ color: "#8b5cf6" }} /> İlan Üreteci
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          Parsel seç → başlık, ikna edici açıklama, öne çıkanlar, konum/GIS özeti ve owner-finance
          taksit senaryosu tek tıkla üretilir. Gözden geçir, düzenle, <strong>/p satış sayfasına yayınla</strong>.
          Metin taslaktır; zoning/izin alıcıya county&apos;den doğrulatılır.
        </p>
      </header>

      {selected && listing ? (
        <div className="space-y-4">
          <Link href="/admin/ilan-ureteci" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--muted)" }}>
            <ArrowLeft className="h-4 w-4" /> Listeye dön
          </Link>
          <div className="rounded-xl border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mb-4 text-xs" style={{ color: "var(--muted)" }}>
              Parsel <span className="font-mono">{selected.buyer.apn || selected.buyer.id}</span> ·{" "}
              {[selected.buyer.region && selected.buyer.region !== selected.buyer.county ? selected.buyer.region : "", selected.buyer.county && `${selected.buyer.county} Co.`, selected.buyer.state].filter(Boolean).join(", ")}
            </div>
            <IlanUreteciEditor parcelId={selected.buyer.id} pUrl={`/p/${encodeURIComponent(selected.buyer.id)}`} initial={listing} />
          </div>
        </div>
      ) : (
        <>
          <form className="flex items-center gap-2" action="">
            <input
              name="q"
              defaultValue={sp.q || ""}
              placeholder="county / bölge / APN / state ara…"
              className="w-full max-w-md rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--outline)" }}
            />
            <button type="submit" className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "var(--surface-high)" }}>Ara</button>
          </form>

          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                  <th className="px-3 py-2.5 font-bold">Parsel</th>
                  <th className="px-3 py-2.5 font-bold">Konum</th>
                  <th className="px-3 py-2.5 text-right font-bold">Acre</th>
                  <th className="px-3 py-2.5 text-right font-bold">Alıcı fiyatı</th>
                  <th className="px-3 py-2.5 text-center font-bold">Grade</th>
                  <th className="px-3 py-2.5 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ deal, buyer }) => (
                  <tr key={buyer.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--muted)" }}>{buyer.apn || buyer.id}</td>
                    <td className="px-3 py-2 font-medium">
                      {[buyer.region && buyer.region !== buyer.county ? buyer.region : "", buyer.county && `${buyer.county} Co.`, buyer.state].filter(Boolean).join(", ")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{buyer.acres ? buyer.acres.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: GREEN }}>{usd(buyer.price)}</td>
                    <td className="px-3 py-2 text-center">
                      {deal.dealGrade ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>{deal.dealGrade}</span>
                      ) : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        href={`/admin/ilan-ureteci?id=${encodeURIComponent(buyer.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                        style={{ background: "#8b5cf6" }}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> İlan üret
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Bu aramada fiyatlı parsel yok.</p>
            )}
          </div>
          <div className="rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
            <strong style={{ color: "var(--warn)" }}>Güvenlik:</strong> Üretilen ilan yalnızca buyer-safe alanlardan kurulur
            (toBuyerParcel beyaz-listesi) — sahip adı, teklif, spread, comp değeri, grade ASLA ilana girmez (testli).
          </div>
        </>
      )}
    </div>
  );
}
