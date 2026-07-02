"use client";

// ── PARSEL TEK-SAYFA SUNUM (PDF) ─────────────────────────────────────────────
// Tek parsel için baskı-optimize satış sayfası: window.print → PDF olarak
// kaydet → WhatsApp'tan alıcıya gönder. Veri: /api/admin/all-deals?id=…
// (UnifiedDeal — gerçek JSON veri setleri + ATTOM/Regrid değerleme).
// Harita: Esri World Imagery static export (client-side <img>, key gerekmez).
// Taksit planı: peşinat + aylık taksit girilebilir, ay sayısı fiyattan hesaplanır.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";

type Deal = {
  id: string; source: string; sourceLabel: string; state: string; county: string;
  region: string; owner: string; address: string; acres: number;
  landValue: number; estOffer: number; estResale: number; spread: number;
  apn: string; lat: number | null; lng: number | null;
  marketValue: number | null; comps: number; valBasis: string; dealGrade: string | null;
  absentee: boolean;
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const ESRI_EXPORT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";

// Parsel-merkezli Esri static uydu görseli URL'i (bbox = padMeters yarıçap).
function esriUrl(lat: number, lng: number, padMeters: number, w: number, h: number) {
  const cos = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const dLat = padMeters / 111320;
  const dLng = padMeters / (111320 * cos);
  return `${ESRI_EXPORT}?bbox=${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=png&transparent=false&f=image`;
}

const BASIS_LABEL: Record<string, string> = {
  attom_region: "ATTOM bölge emsali",
  county_comp: "county emsal",
  state_comp: "eyalet emsali",
  mismatch: "doğrulama gerekli",
  none: "emsal yok",
};
const GRADE_COLOR: Record<string, string> = { A: "#059669", B: "#0284c7", C: "#94a3b8" };

function InstallmentTable({ price }: { price: number }) {
  const [down, setDown] = useState(500);
  const [monthly, setMonthly] = useState(199);
  const financed = Math.max(price - down, 0);
  const months = monthly > 0 ? Math.ceil(financed / monthly) : 0;
  const lastPayment = monthly > 0 ? financed - (months - 1) * monthly : 0;
  const total = down + financed;

  return (
    <section className="mt-5 print:mt-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 border-b-2 border-emerald-600 pb-1">
        Taksitli Ödeme Planı (Owner Financing)
      </h2>
      {/* Girdiler — baskıda gizli, ekranda düzenlenebilir */}
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm print:hidden">
        <label className="flex items-center gap-2">
          Peşinat ($)
          <input type="number" value={down} min={0} step={50}
            onChange={(e) => setDown(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-right" />
        </label>
        <label className="flex items-center gap-2">
          Aylık taksit ($)
          <input type="number" value={monthly} min={1} step={10}
            onChange={(e) => setMonthly(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-right" />
        </label>
        <span className="text-xs text-slate-500">— yazdırmadan önce ayarla, tablo otomatik güncellenir</span>
      </div>
      <table className="mt-3 w-full border-collapse text-sm">
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="py-1.5 text-slate-600">Satış fiyatı</td>
            <td className="py-1.5 text-right font-bold">{usd(price)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-1.5 text-slate-600">Peşinat (bugün)</td>
            <td className="py-1.5 text-right font-bold text-emerald-700">{usd(down)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-1.5 text-slate-600">Aylık taksit</td>
            <td className="py-1.5 text-right font-bold">{usd(monthly)} <span className="font-normal text-slate-500">× {months} ay</span></td>
          </tr>
          {months > 1 && lastPayment !== monthly && (
            <tr className="border-b border-slate-200">
              <td className="py-1.5 text-slate-600">Son taksit (kalan)</td>
              <td className="py-1.5 text-right">{usd(lastPayment)}</td>
            </tr>
          )}
          <tr>
            <td className="py-1.5 font-semibold text-slate-800">Toplam ödeme</td>
            <td className="py-1.5 text-right font-bold text-slate-900">{usd(total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-slate-400">
        Plan örnektir; faizsiz düz taksit varsayımı. Nihai koşullar sözleşmede belirlenir. Vergi/kayıt ücretleri dahil değildir.
      </p>
    </section>
  );
}

function OnePager() {
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  const [deal, setDeal] = useState<Deal | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!id) { setState("error"); return; }
    let alive = true;
    fetch(`/api/admin/all-deals?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) { setDeal(d.deal ?? null); setState(d.deal ? "ready" : "error"); } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [id]);

  // Alıcıya fiyat = tahmini yeniden-satış (owner-finance liste fiyatı mantığı).
  const price = useMemo(() => {
    if (!deal) return 0;
    return Math.round(deal.estResale || deal.marketValue || 0);
  }, [deal]);

  if (state === "loading") {
    return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (state === "error" || !deal) {
    return (
      <div className="p-10 text-center text-slate-500">
        Parsel bulunamadı. Haritadaki parsel popup&apos;ından &quot;🖨 Tek Sayfa (PDF)&quot; ile açın.
      </div>
    );
  }

  const loc = [deal.region, deal.county && `${deal.county} County`, deal.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 print:p-0 print:max-w-none">
      {/* Ekran araç çubuğu — baskıda gizli */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 text-white print:hidden">
        <div className="text-sm">
          <b>Tek Sayfa Sunum</b> — &quot;Yazdır&quot; → hedef olarak <b>PDF olarak kaydet</b> seç → WhatsApp&apos;tan gönder.
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold hover:bg-emerald-400">
          <Printer className="h-4 w-4" /> Yazdır / PDF
        </button>
      </div>

      {/* ── TerraLot başlık ── */}
      <header className="flex items-end justify-between border-b-4 border-slate-900 pb-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">
            Terra<span className="text-emerald-600">Lot</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Amerika&apos;da Arazi Yatırımı · Land Deals</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Parsel Sunumu</div>
          <div className="text-xs text-slate-400">{new Date().toLocaleDateString("tr-TR")}</div>
        </div>
      </header>

      {/* ── Başlık + fiyat ── */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {deal.acres.toFixed(2)} Acre Arazi — {loc || "ABD"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {deal.address ? `${deal.address} · ` : ""}APN: {deal.apn || "—"}
            {deal.dealGrade && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: GRADE_COLOR[deal.dealGrade] ?? "#94a3b8" }}>
                {deal.dealGrade} sınıfı fırsat
              </span>
            )}
          </p>
        </div>
        {price > 0 && (
          <div className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-right text-white">
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Satış Fiyatı</div>
            <div className="text-2xl font-extrabold">{usd(price)}</div>
          </div>
        )}
      </div>

      {/* ── Haritalar: yakın parsel + geniş bölge (Esri static) ── */}
      {deal.lat != null && deal.lng != null && (
        <div className="mt-4 print:mt-3 grid grid-cols-2 gap-3">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={esriUrl(deal.lat, deal.lng, Math.max(Math.sqrt(deal.acres * 4046.86) * 1.6, 120), 640, 440)}
              alt="Parsel uydu görüntüsü (yakın)"
              className="h-[220px] print:h-[180px] w-full rounded-lg border border-slate-200 object-cover"
            />
            <figcaption className="mt-1 text-[10px] text-slate-400">Uydu — parsel çevresi (Esri, konum yaklaşık merkez)</figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={esriUrl(deal.lat, deal.lng, 8000, 640, 440)}
              alt="Bölge uydu görüntüsü (geniş)"
              className="h-[220px] print:h-[180px] w-full rounded-lg border border-slate-200 object-cover"
            />
            <figcaption className="mt-1 text-[10px] text-slate-400">Bölge görünümü (~10 mil) · {deal.lat.toFixed(5)}, {deal.lng.toFixed(5)}</figcaption>
          </figure>
        </div>
      )}

      {/* ── Parsel bilgileri ── */}
      <section className="mt-5 print:mt-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 border-b-2 border-slate-900 pb-1">Parsel Bilgileri</h2>
        <div className="mt-2 grid grid-cols-2 gap-x-8 text-sm">
          {[
            ["APN (Parsel No)", deal.apn || "—"],
            ["Eyalet", deal.state || "—"],
            ["County (İlçe)", deal.county || "—"],
            ["Bölge", deal.region || "—"],
            ["Büyüklük", `${deal.acres.toFixed(2)} acre (~${Math.round(deal.acres * 4046.86).toLocaleString("tr-TR")} m²)`],
            ["Adres / Konum", deal.address || "Yerleşim adresi yok (boş arazi)"],
            ["County kayıtlı değer", deal.landValue ? usd(deal.landValue) : "—"],
            ["Koordinat", deal.lat != null ? `${deal.lat.toFixed(5)}, ${deal.lng!.toFixed(5)}` : "—"],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">{k}</span>
              <span className="font-semibold text-slate-800 text-right">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Değerleme ── */}
      <section className="mt-5 print:mt-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 border-b-2 border-slate-900 pb-1">Değerleme</h2>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Piyasa Değeri (Emsal)</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{deal.marketValue ? usd(deal.marketValue) : "—"}</div>
            <div className="text-[10px] text-slate-400">
              {BASIS_LABEL[deal.valBasis] ?? deal.valBasis}{deal.comps ? ` · ${deal.comps} emsal satış` : ""}
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Satış Fiyatı</div>
            <div className="mt-1 text-lg font-bold text-emerald-700">{price ? usd(price) : "—"}</div>
            <div className="text-[10px] text-emerald-600">taksit imkânıyla</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Piyasaya Göre Avantaj</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {deal.marketValue && price && deal.marketValue > price ? usd(deal.marketValue - price) : deal.spread ? usd(deal.spread) : "—"}
            </div>
            <div className="text-[10px] text-slate-400">emsal değere karşı</div>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          Değerleme, bölgedeki gerçekleşmiş arsa satışları (ATTOM/county emsalleri) baz alınarak hesaplanmıştır; garanti değildir.
        </p>
      </section>

      {/* ── Taksit planı ── */}
      {price > 0 && <InstallmentTable price={price} />}

      {/* ── Footer ── */}
      <footer className="mt-6 print:mt-3 border-t-2 border-slate-900 pt-2 text-center">
        <div className="text-sm font-bold text-slate-900">Terra<span className="text-emerald-600">Lot</span> — Amerika&apos;da Arazi</div>
        <div className="mt-0.5 text-xs text-slate-500">
          İletişim: [telefon / WhatsApp] · [e-posta] · [web sitesi]
        </div>
        <div className="mt-1 text-[9px] text-slate-400">
          Bu doküman bilgilendirme amaçlıdır, resmi teklif/ekspertiz değildir. Sınır ve ölçüler yaklaşıktır; nihai bilgiler tapu kaydı ve sözleşme ile teyit edilir.
        </div>
      </footer>
    </div>
  );
}

export default function ParcelSunumPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <OnePager />
    </Suspense>
  );
}
