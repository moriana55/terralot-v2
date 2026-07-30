"use client";

/**
 * NOT KALİBRASYONU — "bu not neden bu not?" kanıt paneli.
 *
 * Notun kendi kendine konuşmadığını, DIŞ bir gerçekle sınandığını gösterir:
 * land_comps'taki gerçekleşmiş kol satışları APN ile lead'lere bağlanır →
 * "notumuz şuydu / parsel gerçekte şu fiyata satıldı". Tüm sayılar
 * /api/admin/not-kalibrasyon'dan CANLI gelir (sabit rakam yok); ölçüm
 * çalıştırılmadıysa dürüstçe kurulum satırı gösterilir.
 */

import { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { GRADE_LABELS, gradeColor } from "@/lib/offmarket-grade";
import { ornekYeterli, kanitGucu, spearmanYorum, ayrismaKontrol } from "@/lib/not-kalibrasyon";

type Satir = {
  tur: string; anahtar: string;
  n_lead: number | null; n_satis: number | null; satis_orani: number | null;
  med_satis: number | null; ort_skor: number | null;
  ek: Record<string, unknown> | null; built_at: string | null;
};
type Payload = {
  hazir: boolean; kurulum: string | null; olcumTarihi?: string | null; error?: string;
  band?: Satir[]; desil?: Satir[]; geo?: Satir[];
  spearman?: Satir | null; yanlisNegatif?: Satir | null; kapsam?: Satir | null;
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("tr-TR"));
const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(Number(n)).toLocaleString("en-US")}`;

export default function NotKalibrasyon() {
  const [d, setD] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/admin/not-kalibrasyon").then((r) => r.json()).then(setD).catch(() => setD({ hazir: false, kurulum: null, error: "ağ hatası" }));
  }, []);

  if (!d)
    return (
      <div className="mt-8 flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
        <Loader2 size={15} className="animate-spin" /> Kalibrasyon kanıtı yükleniyor…
      </div>
    );

  const rho = d.spearman?.ek?.spearman as number | undefined;
  const rhoN = d.spearman?.n_satis ?? null;
  const yn = d.yanlisNegatif?.n_lead ?? null;
  const kapsamNot = (d.kapsam?.ek?.not as string | undefined) ?? null;
  const compEyalet = (d.kapsam?.ek?.comp_eyalet as string[] | undefined) ?? [];
  const ayrisma = ayrismaKontrol(d.band ?? []);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <FlaskConical size={17} style={{ color: "#7c3aed" }} /> Not kalibrasyonu · hangi kanıtla?
      </h2>
      <p className="mt-1 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Not motoru kendi kendini doğrulamaz. Aşağıdaki sayılar, county kayıtlarından toplanan{" "}
        <b>gerçekleşmiş boş arsa satışlarının</b> APN ile lead'lere bağlanmasıyla üretilir:
        “bizim notumuz şuydu, parsel gerçekte şu fiyata satıldı”.
      </p>

      {!d.hazir ? (
        <div className="mt-3 rounded-xl border p-5 text-sm" style={{ borderColor: "#d9770655", background: "#d977060f" }}>
          <p className="font-bold" style={{ color: "#d97706" }}>Kalibrasyon ölçümü henüz çalıştırılmadı.</p>
          <p className="mt-1.5">
            Owner aksiyonu: <code className="font-mono">{d.kurulum ?? "node scraper/not-kalibrasyon.mjs"}</code>
          </p>
          {d.error && <p className="mt-1.5" style={{ color: "var(--muted)" }}>{d.error}</p>}
        </div>
      ) : (
        <>
          {/* Başlık ölçüleri */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Skor ↔ gerçek satış fiyatı</div>
              <div className="text-xl font-extrabold mt-1">ρ = {rho == null ? "—" : rho.toFixed(3)}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                Spearman sıra korelasyonu · n = {fmt(rhoN)} gerçek satış.
                {" "}{spearmanYorum(rho)}.
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Gizli A havuzu</div>
              <div className="text-xl font-extrabold mt-1">{fmt(yn)}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                Skoru kendi eyaletindeki en düşük A skorunu aştığı hâlde <b>yalnız geo taraması beklediği için</b> B'de duran kayıt.
                Eşiği gevşetmek değil, bu kayıtlara geo taraması koşturmak gerekir.
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Örneklem kapsamı</div>
              <div className="text-xl font-extrabold mt-1">{compEyalet.join(", ") || "—"}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                {kapsamNot ?? "Gerçekleşmiş satış verisi yalnız bu eyalet(ler) için var."}
              </div>
            </div>
          </div>

          {/* Band × gerçek satış */}
          <div className="mt-4 rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--outline)" }}>
              Not bandı × gerçekleşen satış — notun ayırt ediciliği
            </div>
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th className="text-left px-4 py-2 font-bold text-xs">Not</th>
                  <th className="text-right px-3 py-2 font-bold text-xs">Kayıt</th>
                  <th className="text-right px-3 py-2 font-bold text-xs">Satan</th>
                  <th className="text-right px-3 py-2 font-bold text-xs">Medyan gerçek satış</th>
                  <th className="text-right px-3 py-2 font-bold text-xs">Ort. skor</th>
                  <th className="text-left px-4 py-2 font-bold text-xs">Kanıt gücü</th>
                </tr>
              </thead>
              <tbody>
                {(d.band ?? []).map((r) => {
                  const yeterli = ornekYeterli(r.n_satis);
                  return (
                    <tr key={r.anahtar} style={{ borderTop: "1px solid var(--outline)" }}>
                      <td className="px-4 py-2 font-bold" style={{ color: gradeColor(r.anahtar) }} title={GRADE_LABELS[r.anahtar] ?? ""}>{r.anahtar}</td>
                      <td className="text-right px-3 py-2 tabular-nums">{fmt(r.n_lead)}</td>
                      <td className="text-right px-3 py-2 tabular-nums">{fmt(r.n_satis)}</td>
                      <td className="text-right px-3 py-2 tabular-nums font-bold">{usd(r.med_satis)}</td>
                      <td className="text-right px-3 py-2 tabular-nums">{r.ort_skor ?? "—"}</td>
                      <td className="px-4 py-2 text-[11px]" style={{ color: yeterli ? "var(--muted)" : "#d97706" }}>
                        {kanitGucu(r.n_satis)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 text-[11px]" style={{ borderTop: "1px solid var(--outline)", color: ayrisma.tekduze === false ? "#d97706" : "var(--muted)" }}>
              {ayrisma.tekduze == null
                ? "Örneklemi yeterli en az iki band olmadan ayrışma kararı verilmez."
                : ayrisma.tekduze
                  ? `Ayrışma TUTUYOR: ${ayrisma.kullanilan.join(" > ")} bandlarında medyan gerçek satış fiyatı not sırasıyla birlikte düşüyor.`
                  : `Ayrışma BOZUK: ${ayrisma.kullanilan.join(" / ")} bandlarında medyan gerçek satış fiyatı not sırasını takip etmiyor — motor gözden geçirilmeli.`}
              {ayrisma.atlanan.length > 0 && ` Örneklemi yetersiz olduğu için karara katılmayan band: ${ayrisma.atlanan.join(", ")}.`}
            </div>
          </div>

          {/* Skor desili */}
          <div className="mt-4 rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--outline)" }}>
              Skor desili × medyan gerçekleşen satış — skor yükseldikçe gerçek fiyat yükseliyor mu?
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {(d.desil ?? []).map((r) => {
                const en = Math.max(...(d.desil ?? []).map((x) => Number(x.med_satis ?? 0)), 1);
                const oran = Number(r.med_satis ?? 0) / en;
                return (
                  <div key={r.anahtar} className="rounded-lg border px-3 py-2 min-w-[104px]" style={{ borderColor: "var(--outline)" }}>
                    <div className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>
                      D{r.anahtar} · skor {String(r.ek?.s_alt ?? "")}–{String(r.ek?.s_ust ?? "")}
                    </div>
                    <div className="text-sm font-extrabold tabular-nums mt-0.5">{usd(r.med_satis)}</div>
                    <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--outline)" }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.round(oran * 100)}%`, background: "#7c3aed" }} />
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>n={fmt(r.n_satis)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Geo tavanı */}
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Geo doğrulama tavanı ayırt edici mi? (A+/A yalnız geo-doğrulanmış parsele verilir)
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {(d.geo ?? []).map((r) => (
                <div key={r.anahtar} className="rounded-lg border p-3" style={{ borderColor: "var(--outline)" }}>
                  <div className="font-bold">{r.anahtar}</div>
                  <div className="mt-1 tabular-nums" style={{ color: "var(--muted)" }}>
                    kayıt {fmt(r.n_lead)} · satan {fmt(r.n_satis)} · medyan gerçek satış <b style={{ color: "inherit" }}>{usd(r.med_satis)}</b> · ort. skor {r.ort_skor ?? "—"}
                  </div>
                  {!ornekYeterli(r.n_satis) && (
                    <div className="text-[11px] mt-1" style={{ color: "#d97706" }}>n={fmt(r.n_satis)} — örneklem yetersiz, yönü gösterir, kanıt değil.</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {d.olcumTarihi && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
              Ölçüm: {new Date(d.olcumTarihi).toLocaleString("tr-TR")} · yenilemek için{" "}
              <code className="font-mono">node scraper/not-kalibrasyon.mjs</code>
            </p>
          )}
        </>
      )}
    </section>
  );
}
