// ─────────────────────────────────────────────────────────────────────────────
// TOPLU ARSA ALAN ŞİRKETLER — "onlara toplu pazarlama yapabilir miyiz?"
//
// İKİ ALICI SINIFI, İKİ FARKLI PAZARLAMA DİLİ:
//   • BİRİKTİRİCİ — bizim tarama alanımızda çok parsel biriktirmiş kurumsal
//     sahipler (land banker / flipper). Ucuz, uzak, taksitle dönen parsel alır.
//   • AKTİF ALICI — tapu kaydında son satış yılı taze olan şirketler; ev
//     üreticileri burada çıkar. Bölünebilir, altyapıya yakın toplu parsel alır.
//
// KESİŞİM sütunu sayfanın asıl değeri: şirketin topladığı county'lerde BİZİM
// kaç notlu parselimiz var. Yüksekse o şirkete toplu teklif götürülebilir.
// ⚠ Kesişim o county'deki TÜM envanterimizdir — şirkete özel ayrılmış stok değil.
//
// Veri: src/data/toplu-alicilar.json ← scraper/build-toplu-alicilar.mjs
// (kaynak: offmarket_leads sahip kaydı + parcel_owners tapu satış yılı).
// Tahmin/uydurma YOK; posta adresi kamu tapu kaydından birebir gelir.
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/toplu-alicilar.json";
import { Building2, MapPin, Mail, TrendingUp, Layers } from "lucide-react";
import CsvButton, { type AliciRow } from "./CsvButton";

export const metadata = { title: "Toplu Alıcılar — VegaLand" };

const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-US"));
const usd = (v: number | null | undefined) =>
  v == null || v === 0 ? "—" : `$${Math.round(v).toLocaleString("en-US")}`;

type Snapshot = {
  uretildi: string;
  esik: number;
  aktifYil: number;
  biriktirici: AliciRow[];
  aktif: AliciRow[];
  sayac: { lead_toplam: number; lead_kurumsal: number; owner_toplam: number; kurumsal_sahip_n: number };
};

const S = data as unknown as Snapshot;

function Stat({ label, value, alt }: { label: string; value: string; alt: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1 text-[26px] font-bold leading-none">{value}</div>
      <div className="mt-1.5 text-[12px]" style={{ color: "var(--muted)" }}>{alt}</div>
    </div>
  );
}

function Tablo({ rows, tip }: { rows: AliciRow[]; tip: "biriktirici" | "aktif" }) {
  const aktifTip = tip === "aktif";
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border, #e2e8f0)" }}>
      <table className="w-full min-w-[1040px] text-[13px]">
        <thead>
          <tr style={{ background: "var(--surface-2, #f8fafc)" }}>
            {[
              "Şirket",
              aktifTip ? "Son alım" : "Parsel",
              aktifTip ? "Yeni parsel" : "Dönüm",
              "County",
              "Bölgeler",
              "Posta adresi",
              aktifTip ? "Ort. alım" : "Ort. dönüm",
              "Aynı county'de bizde A+/A",
            ].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.1em] whitespace-nowrap" style={{ color: "var(--muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.owner + i} className="border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
              <td className="px-3 py-2.5 font-semibold">{r.owner}</td>
              <td className="px-3 py-2.5 tabular-nums">{aktifTip ? (r.sonAlim ?? "—") : n(r.parsel)}</td>
              <td className="px-3 py-2.5 tabular-nums">{aktifTip ? n(r.tazeParsel) : n(r.donum)}</td>
              <td className="px-3 py-2.5 tabular-nums">
                {r.countyN}
                {r.eyaletN > 1 && <span style={{ color: "var(--muted)" }}> · {r.eyaletN} eyalet</span>}
              </td>
              <td className="px-3 py-2.5 max-w-[260px]">
                <span className="line-clamp-2" title={r.bolgeler.join(", ")}>{r.bolgeler.join(", ")}</span>
              </td>
              <td className="px-3 py-2.5 max-w-[240px]">
                {r.posta ? (
                  <span className="line-clamp-2" title={r.posta}>{r.posta}</span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>kayıtta yok</span>
                )}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {aktifTip ? usd(r.ortAlimFiyat) : r.donum && r.parsel ? `${(r.donum / r.parsel).toFixed(1)} ac` : "—"}
              </td>
              <td className="px-3 py-2.5 tabular-nums font-bold" style={{ color: r.kesisimAplus > 0 ? "#15803d" : "var(--muted)" }}>
                {r.kesisimAplus > 0 ? n(r.kesisimAplus) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TopluAlicilarPage() {
  const b = S.biriktirici;
  const a = S.aktif;
  const postaliB = b.filter((r) => r.posta).length;
  const postaliA = a.filter((r) => r.posta).length;
  const cokEyalet = b.filter((r) => r.eyaletN > 1).length;
  const enIyiKesisim = [...b, ...a].sort((x, y) => y.kesisimAplus - x.kesisimAplus).slice(0, 6);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#15803d" }}>
        PAZAR · TOPLU ALICI İSTİHBARATI
      </div>
      <h1 className="text-[26px] font-bold flex items-center gap-2.5">
        <Building2 size={24} /> Toplu Arsa Alan Şirketler
      </h1>
      <p className="mt-2 mb-6 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Kamu tapu kaydından türetildi: <b style={{ color: "var(--foreground)" }}>{n(S.sayac.lead_kurumsal)}</b> kurumsal
        sahipli parsel, <b style={{ color: "var(--foreground)" }}>{n(S.sayac.kurumsal_sahip_n)}</b> ayrı şirket. Aşağıdaki
        listeler eşiği geçenler: biriktiriciler <b style={{ color: "var(--foreground)" }}>≥{S.esik} parsel</b>, aktif
        alıcılar <b style={{ color: "var(--foreground)" }}>{S.aktifYil}+ tapu devri</b>. Posta adresleri kamu kaydından
        birebir — toplu mektup listesi olarak doğrudan kullanılabilir.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Biriktirici" value={n(b.length)} alt={`${postaliB} tanesinin posta adresi var`} />
        <Stat label="Aktif alıcı" value={n(a.length)} alt={`${postaliA} tanesinin posta adresi var`} />
        <Stat label="Çok eyaletli" value={n(cokEyalet)} alt="birden fazla eyalette toplayan" />
        <Stat label="Kurumsal pay" value={`%${Math.round((S.sayac.lead_kurumsal / S.sayac.lead_toplam) * 100)}`} alt="tüm envanterin kurumsal sahipli oranı" />
      </div>

      {/* En yüksek kesişim — doğrudan aksiyon listesi */}
      <div className="rounded-xl border p-5 mb-8" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface-2, #f8fafc)" }}>
        <div className="flex items-center gap-2 mb-1 text-[13px] font-bold">
          <TrendingUp size={16} /> Önce bunlara git — bizim envanterimizle en çok örtüşenler
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--muted)" }}>
          Bu şirketler tam bizim parselimizin olduğu county&apos;lerde topluyor. Aynı county&apos;de elimizdeki A+/A parsel sayısı
          toplu teklifin üst sınırını gösterir.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {enIyiKesisim.map((r) => (
            <div key={r.owner} className="rounded-lg border p-3" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}>
              <div className="text-[13px] font-bold leading-snug">{r.owner}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: "var(--muted)" }}>
                <MapPin size={11} /> {r.bolgeler.slice(0, 3).join(", ")}{r.bolgeler.length > 3 ? ` +${r.bolgeler.length - 3}` : ""}
              </div>
              <div className="mt-2 text-[20px] font-bold tabular-nums" style={{ color: "#15803d" }}>
                {n(r.kesisimAplus)}
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>aynı county&apos;de A+/A parselimiz</div>
              {r.posta && (
                <div className="mt-2 flex items-start gap-1 text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
                  <Mail size={11} className="mt-0.5 shrink-0" /> {r.posta}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="text-[18px] font-bold flex items-center gap-2"><Layers size={18} /> Biriktiriciler</h2>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            Bizim tarama alanımızda ≥{S.esik} parsel biriktirmiş kurumsal sahipler. Ucuz/uzak/taksitli parselin alıcısı.
          </p>
        </div>
        <CsvButton rows={b} ad="biriktirici" />
      </div>
      <Tablo rows={b} tip="biriktirici" />

      <div className="flex items-center justify-between gap-4 mb-3 mt-10">
        <div>
          <h2 className="text-[18px] font-bold flex items-center gap-2"><TrendingUp size={18} /> Aktif alıcılar</h2>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            Tapu kaydında {S.aktifYil} ve sonrasında devir almış şirketler — hâlâ satın alıyorlar. Ev üreticileri burada.
          </p>
        </div>
        <CsvButton rows={a} ad="aktif" />
      </div>
      <Tablo rows={a} tip="aktif" />

      <p className="mt-8 text-[11px]" style={{ color: "var(--muted)" }}>
        Snapshot: {new Date(S.uretildi).toLocaleString("tr-TR")} · tazelemek için{" "}
        <code>node scraper/build-toplu-alicilar.mjs</code> · kaynak: offmarket_leads sahip kaydı ({n(S.sayac.lead_toplam)} parsel)
        + parcel_owners tapu satış kaydı ({n(S.sayac.owner_toplam)} satır).
      </p>
    </div>
  );
}
