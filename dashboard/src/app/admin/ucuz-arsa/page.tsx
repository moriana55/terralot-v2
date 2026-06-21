// ─────────────────────────────────────────────────────────────────────────────
// UCUZ BOŞ ARSA — Ahmet sunumu. Model: ucuz boş arsa → sahibe MEKTUP → al → taksitle sat.
// Veri GERÇEK: tax-delinquent kamu kaydı (sahip + posta adresi + vergi borcu).
// İHALE YOK. Sadece sahibe direkt mektup. Snapshot: src/data/cheap-land.json
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/cheap-land.json";
import Link from "next/link";
import { MailPlus, Satellite, Star, ClipboardList } from "lucide-react";

export const metadata = { title: "Ucuz Boş Arsa — Terralot" };
const fmt = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

interface Deal {
  id: string; owner: string; mailAddr: string; property: string;
  county: string; state: string; taxDebt: number; mapUrl: string;
  acres?: number | null; landValue?: number | null; vacant?: boolean;
}
const acreStr = (a: number | null | undefined) => (a && a > 0 ? `${a.toFixed(2)} ac` : "—");

export default function UcuzArsaPage() {
  const deals = (data.deals as Deal[]) || [];
  // sahibe göre grupla
  const byOwner = new Map<string, Deal[]>();
  for (const d of deals) {
    if (!byOwner.has(d.owner)) byOwner.set(d.owner, []);
    byOwner.get(d.owner)!.push(d);
  }
  const owners = [...byOwner.entries()].sort((a, b) => b[1].length - a[1].length);
  const topOwner = owners[0];
  const totalDebt = deals.reduce((s, d) => s + d.taxDebt, 0);
  const avgDebt = deals.length ? Math.round(totalDebt / deals.length) : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--primary, #16a34a)" }}>
        OFF-MARKET · UCUZ BOŞ ARSA
      </div>
      <h1 className="text-[26px] font-bold mb-2">Ucuz Boş Arsa — Mektup Modeli</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Model: <b style={{ color: "var(--foreground)" }}>ucuz boş arsa → sahibine mektup → ucuza al → taksitle sat</b> (RinaLand modeli). İhale yok, sahibe direkt. Veri gerçek: kamu vergi-borç kaydı (sahip + posta adresi + borç).
      </p>

      {/* özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        {[
          { k: "Boş arsa", v: String(deals.length) },
          { k: "Farklı sahip", v: String(owners.length) },
          { k: "Ort. vergi borcu", v: fmt(avgDebt) },
          { k: "Kaynak", v: "Kamu vergi kaydı" },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>{s.k}</div>
            <div className="text-xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      {/* ÖNERİ */}
      {topOwner && (
        <div className="rounded-xl border p-5 mb-7" style={{ borderColor: "var(--primary, #16a34a)", background: "rgba(22,163,74,0.06)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4" style={{ color: "var(--primary, #16a34a)" }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--primary, #16a34a)" }}>Önerim — önce buna mektup at</span>
          </div>
          <p className="text-sm">
            <b>{topOwner[0]}</b> tek başına <b>{topOwner[1].length} boş arsaya</b> sahip ve hepsi vergi borçlu.
            Tek bir mektup/arama → <b>{topOwner[1].length} ucuz arsa</b> birden. Posta adresi:
            {" "}<span style={{ color: "var(--muted)" }}>{topOwner[1][0].mailAddr}</span>
          </p>
        </div>
      )}

      {/* tablo */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              {["#", "Sahip", "Posta Adresi (mektup buraya)", "Boş Arsa", "Dönüm", "Arsa Değeri", "Vergi Borcu", "Aksiyon"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map((d, i) => {
              const isTop = topOwner && d.owner === topOwner[0];
              return (
                <tr key={d.id} className="border-b align-top transition-colors hover:bg-white/[0.02]" style={{ borderColor: "var(--outline)" }}>
                  <td className="px-4 py-3 text-xs font-bold" style={{ color: "var(--muted)" }}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold whitespace-nowrap flex items-center gap-1.5">
                      {isTop && <Star className="w-3 h-3" style={{ color: "var(--primary, #16a34a)" }} />}{d.owner}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{d.mailAddr}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs whitespace-nowrap">{d.property}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{d.county}, {d.state}{d.vacant ? " · boş ✓" : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{acreStr(d.acres)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold">{fmt(d.landValue)}</span>
                    <span className="block text-[10px]" style={{ color: "var(--muted)" }}>HCAD değeri</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-amber-500">{fmt(d.taxDebt)}</span>
                    <span className="block text-[10px]" style={{ color: "var(--muted)" }}>vergi borcu</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/ucuz-arsa/${d.id}`} title="Değerleme paneli"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold" style={{ background: "var(--primary, #16a34a)", color: "#fff" }}>
                        <ClipboardList className="w-3 h-3" /> Değerle
                      </Link>
                      <a href={d.mapUrl} target="_blank" rel="noopener noreferrer" title="Haritada gör"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border" style={{ borderColor: "var(--outline)" }}>
                        <Satellite className="w-3 h-3" /> Harita
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-4 mt-6 text-sm" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <b>Teklif yaklaşımı (sahibe mektup):</b> Adam o arsayı istemiyor, üstüne vergi borcu var. Mektupta: <i>“arsanı satın alırım, vergi borcunu da hallederim.”</i> Teklif ≈ borcu kapat + birkaç bin nakit. Aldıktan sonra <b>taksitle</b> (owner-finance) 2-3 katına satılır.
      </div>
      <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>{data.model} · {data.generatedAt}</p>
    </div>
  );
}
