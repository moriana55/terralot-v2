"use client";

/**
 * ÇEVİRME KANITI — müşteri sayfası. "Bu arsalar kaça alınıp kaça satılıyor?"
 *
 * Tek işi KANIT göstermek: aynı parselin county tapu sicilindeki alım ve satım
 * fiyatı, tarihleriyle. Rakip firma adı YOK — tapu adından firma çıkarmak iki
 * kez elimizde patladı (Mohave, Gokce). Burada iddia yok, sayım var.
 *
 * Gösterilen örnekler MEDYANIN ETRAFINDAN seçilir, uç değerlerden değil:
 * x9-x11 çarpanlar büyük olasılıkla arsaya yapı yapıldıktan sonraki satış ve
 * sunumda sorulduğunda doğrulanamaz.
 */

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Receipt, TrendingUp, Clock, ShieldCheck } from "lucide-react";

const ACCENT = "#0f766e";

type County = {
  county: string; n: number; medAlim: number; medSatim: number;
  medCarpan: number; medAy: number; zararPay: number;
};
type Ornek = {
  county: string; apn: string; acres: number;
  alimYil: number; alimAy: number; alimFiyat: number;
  satimYil: number; satimAy: number; satimFiyat: number;
  carpan: number; ayFark: number;
};
type Payload = {
  hazir: boolean; neden?: string; uretildi?: string;
  ozet?: { n: number; medCarpan: number; p25: number; p75: number; zararPay: number; medAy: number; medAlim: number; medSatim: number };
  countyler?: County[]; ornekler?: Ornek[];
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const ay2 = (a: number) => String(a).padStart(2, "0");

export default function CevirmeKaniti() {
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/cevirme-kaniti")
      .then((r) => r.json())
      .then(setD)
      .catch(() => setErr("ağ hatası"));
  }, []);

  if (err) return <div className="p-8 text-sm" style={{ color: "#d97706" }}><AlertTriangle size={16} className="inline mr-2" />{err}</div>;
  if (!d) return <div className="p-8 flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}><Loader2 size={16} className="animate-spin" /> Kanıt dosyası okunuyor…</div>;
  if (!d.hazir) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold">Çevirme Kanıtı</h1>
        <div className="mt-4 rounded-xl border p-5 text-sm" style={{ borderColor: "#d9770655", background: "#d977060f" }}>
          <p className="font-bold" style={{ color: "#d97706" }}>Kanıt dosyası hazır değil.</p>
          <p className="mt-2">{d.neden}</p>
          <p className="mt-2">Üretmek için: <code className="font-mono">node scraper/cevirme-kaniti.mjs</code></p>
        </div>
      </div>
    );
  }

  const o = d.ozet!;
  const kutular = [
    ["Doğrulanmış çift", o.n.toLocaleString("tr-TR"), "aynı parselin alım + satım kaydı"],
    ["Medyan alım", usd(o.medAlim), "county sicilindeki gerçek bedel"],
    ["Medyan satım", usd(o.medSatim), "aynı parselin sonraki satışı"],
    ["Medyan çarpan", `x${o.medCarpan.toFixed(2)}`, `çeyreklikler x${o.p25.toFixed(2)} – x${o.p75.toFixed(2)}`],
    ["Medyan süre", `${Math.round(o.medAy)} ay`, "alımdan satıma"],
    ["Zararına satılan", `%${(o.zararPay * 100).toFixed(0)}`, "çarpan 1'in altında"],
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2.5">
        <span className="inline-grid place-items-center w-10 h-10 rounded-xl" style={{ background: `${ACCENT}1c` }}>
          <Receipt size={20} style={{ color: ACCENT }} />
        </span>
        Çevirme Kanıtı — kaça alınıp kaça satılıyor?
      </h1>
      <p className="mt-2 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Florida county tapu sicilinde <b>aynı parselin</b> alım ve satım kaydı bulunan boş arsalar.
        Tahmin ya da rakip yorumu değil — resmî kayıttaki iki işlem yan yana.
        Ölçüm tarihi: {d.uretildi}.
      </p>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kutular.map(([k, v, alt], i) => (
          <div key={i} className="rounded-xl border p-4" style={{ borderColor: "var(--outline)", background: i === 3 ? `${ACCENT}0d` : "var(--surface)" }}>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{k}</div>
            <div className="text-xl font-extrabold mt-1" style={{ color: i === 3 ? ACCENT : "inherit" }}>{v}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{alt}</div>
          </div>
        ))}
      </div>

      {/* Yöntem — müşteri "bu rakam nereden" diye sorduğunda ekranda dursun. */}
      <div className="mt-5 rounded-xl border p-4 text-[13px]" style={{ borderColor: `${ACCENT}44`, background: `${ACCENT}08` }}>
        <div className="font-bold flex items-center gap-1.5 mb-2" style={{ color: ACCENT }}>
          <ShieldCheck size={15} /> Bu sayılar nasıl süzüldü
        </div>
        <ul className="space-y-1" style={{ color: "var(--ink2)" }}>
          <li>• Her iki işlem de <b>kol mesafesi piyasa satışı</b> (FL DOR kalite kodu 01). Quit-claim, vergi tapusu ve düzeltme tapusu (kod 11) <b>hariç</b> — oradaki rakam piyasa bedeli değildir.</li>
          <li>• Her iki işlemde de parsel <b>boş arsa</b> (üzerinde yapı yok).</li>
          <li>• Alım/satım sırası yıl <i>ve ay</i> ile belirlendi; ikisi de aynı ay olan kayıtlar sıra belirsiz olduğu için <b>dışarıda bırakıldı</b>.</li>
          <li>• Aşağıdaki örnekler <b>medyanın etrafından</b> seçildi. Uç çarpanlar (x9–x11) büyük olasılıkla arsaya yapı yapıldıktan sonraki satıştır; kanıt olarak kullanılmaz.</li>
        </ul>
      </div>

      <h2 className="mt-8 text-lg font-bold flex items-center gap-2"><TrendingUp size={18} style={{ color: ACCENT }} /> County bazında</h2>
      <div className="mt-3 rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <table className="w-full text-sm" style={{ minWidth: 620 }}>
          <thead>
            <tr style={{ color: "var(--muted)" }}>
              {["County", "Çift", "Medyan alım", "Medyan satım", "Çarpan", "Süre", "Zarar"].map((h, i) => (
                <th key={h} className={`px-4 py-2 font-bold text-xs ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(d.countyler ?? []).map((c) => (
              <tr key={c.county} style={{ borderTop: "1px solid var(--outline)" }}>
                <td className="px-4 py-2 font-bold">{c.county}</td>
                <td className="px-4 py-2 text-right tabular-nums">{c.n}</td>
                <td className="px-4 py-2 text-right tabular-nums">{usd(c.medAlim)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold">{usd(c.medSatim)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-extrabold" style={{ color: ACCENT }}>x{c.medCarpan.toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Math.round(c.medAy)} ay</td>
                <td className="px-4 py-2 text-right tabular-nums" style={{ color: c.zararPay > 0.15 ? "#dc2626" : "var(--muted)" }}>%{(c.zararPay * 100).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-bold flex items-center gap-2"><Clock size={18} style={{ color: ACCENT }} /> Tek tek parseller</h2>
      <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
        APN ile county sicilinden doğrulanabilir. Medyan davranışı temsil eden örnekler.
      </p>
      <div className="mt-3 rounded-xl border overflow-x-auto" style={{ borderColor: "var(--outline)", background: "var(--surface)" }}>
        <table className="w-full text-sm" style={{ minWidth: 720 }}>
          <thead>
            <tr style={{ color: "var(--muted)" }}>
              {["County", "APN", "Dönüm", "Alım", "Satım", "Çarpan", "Süre"].map((h, i) => (
                <th key={h} className={`px-4 py-2 font-bold text-xs ${i < 2 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(d.ornekler ?? []).map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--outline)" }}>
                <td className="px-4 py-2">{r.county}</td>
                <td className="px-4 py-2 font-mono text-[12px]">{r.apn}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.acres.toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {usd(r.alimFiyat)} <span style={{ color: "var(--muted)" }}>· {ay2(r.alimAy)}/{r.alimYil}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-bold">
                  {usd(r.satimFiyat)} <span className="font-normal" style={{ color: "var(--muted)" }}>· {ay2(r.satimAy)}/{r.satimYil}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-extrabold" style={{ color: r.carpan >= 1 ? ACCENT : "#dc2626" }}>x{r.carpan.toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.ayFark} ay</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
