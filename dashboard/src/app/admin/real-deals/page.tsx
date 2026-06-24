// ─────────────────────────────────────────────────────────────────────────────
// GERÇEK DEALLER — Ahmet'e gösterilecek "arsa değeri X, vergi Y, bu adamdan Z'ye al" tablosu.
//
// KAYNAK (uydurma YOK):
//  • Parsel + sahip + vergi borcu  → terralot tax-delinquent kayıtları (gerçek)
//  • Arsa değeri + dönüm + kullanım → Dallas County DCAD, Regrid API ile çekildi (gerçek)
//  • Teklif = wholesale modeli (borcu temizle + sahibe nakit, değerin altında)
//
// Değerler county ASSESSED (DCAD) — gerçek ve savunulabilir. Snapshot: src/data/real-deals.json
// (Regrid aylık limitini yakmamak için her açılışta API çağırmaz; scripts/regrid-dallas.mjs ile yenilenir.)
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/real-deals.json";
import { Satellite, ExternalLink, MapPin, TrendingUp } from "lucide-react";
import CsvButton from "./CsvButton";

export const metadata = { title: "Gerçek Dealler — Terralot" };

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

interface Deal {
  id: string;
  address: string;
  owner: string;
  mailAddr: string | null;
  acres: number | null;
  use: string;
  landValue: number | null;
  totalAssessed: number | null;
  improvValue: number;
  taxDebt: number;
  auctionDate: string | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  suggestedOffer: number;
  estSpread: number;
  apn: string | null;
  mapUrl: string;
  regridUrl: string;
}

export default function RealDealsPage() {
  const deals = (data.deals as Deal[]) || [];
  const totalSpread = deals.reduce((s, d) => s + d.estSpread, 0);
  const totalValue = deals.reduce((s, d) => s + (d.landValue || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Başlık */}
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--primary, #16a34a)" }}>
        OFF-MARKET · GERÇEK VERİ
      </div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-[26px] font-bold">Gerçek Arsa Dealleri — Dallas County</h1>
        <CsvButton rows={deals} />
      </div>
      <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>
        Her satır gerçek: parsel + sahip + vergi borcu (terralot kayıtları), arsa değeri + dönüm (Dallas DCAD, Regrid ile çekildi).
      </p>
      <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>
        {data.note}
      </p>

      {/* Özet kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Gerçek deal", value: String(deals.length), icon: MapPin },
          { label: "Toplam arsa değeri", value: fmt(totalValue), icon: TrendingUp },
          { label: "Toplam tahmini marj", value: fmt(totalSpread), icon: TrendingUp },
          { label: "Kaynak", value: "DCAD · Regrid", icon: Satellite },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>{s.label}</div>
            <div className="text-xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--outline)", color: "var(--muted)" }}>
          <p className="text-sm font-medium">Henüz deal yok — enrichment çalıştır: <code>node --env-file=.env.local scripts/regrid-dallas.mjs</code></p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
                {["#", "Arsa (adres)", "Sahip", "Dönüm", "Arsa Değeri", "Vergi Borcu", "Önerilen Teklif", "Tahmini Marj", "Bak"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((d, i) => (
                <tr key={d.id} className="border-b align-top transition-colors hover:bg-white/[0.02]" style={{ borderColor: "var(--outline)" }}>
                  <td className="px-4 py-3 text-xs font-bold" style={{ color: "var(--muted)" }}>{i + 1}</td>

                  {/* Adres */}
                  <td className="px-4 py-3">
                    <div className="font-semibold whitespace-nowrap">{d.address}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                      {d.use}{d.apn ? ` · APN ${d.apn}` : ""}
                    </div>
                  </td>

                  {/* Sahip */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs whitespace-nowrap">{d.owner}</div>
                    {d.mailAddr && <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>📮 {d.mailAddr}</div>}
                  </td>

                  {/* Dönüm */}
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{d.acres != null ? `${d.acres} ac` : "—"}</td>

                  {/* Arsa değeri */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold">{fmt(d.landValue)}</span>
                    <span className="block text-[10px]" style={{ color: "var(--muted)" }}>DCAD assessed</span>
                  </td>

                  {/* Vergi borcu */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-amber-500">{fmt(d.taxDebt)}</span>
                    <span className="block text-[10px]" style={{ color: "var(--muted)" }}>vergi borcu</span>
                  </td>

                  {/* Teklif */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold" style={{ color: "var(--primary, #16a34a)" }}>{fmt(d.suggestedOffer)}</span>
                    <span className="block text-[10px]" style={{ color: "var(--muted)" }}>borcu kapat + nakit</span>
                  </td>

                  {/* Marj */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-green-500">+{fmt(d.estSpread)}</span>
                  </td>

                  {/* Aksiyon */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <a href={d.mapUrl} target="_blank" rel="noopener noreferrer" title="Uydu görüntüsü"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border" style={{ borderColor: "var(--outline)" }}>
                        <Satellite className="w-3 h-3" /> Harita
                      </a>
                      <a href={d.regridUrl} target="_blank" rel="noopener noreferrer" title="Regrid'de aç"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border" style={{ borderColor: "var(--outline)" }}>
                        <ExternalLink className="w-3 h-3" /> Regrid
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] mt-4" style={{ color: "var(--muted)" }}>
        Üretim: {data.generatedAt} · {data.source}
      </p>
    </div>
  );
}
