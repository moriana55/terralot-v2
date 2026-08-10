// ─────────────────────────────────────────────────────────────────────────────
// RAKİP KANITI — "gerçekten satıyorlar mı, ne kadara alıp ne kadara satıyorlar?"
//
// Bu sayfa TAHMİN göstermez. İki bağımsız belge kaynağı vardır:
//   1) TAPU  — rakip ilanının APN'i, gerçek tapu satış kaydıyla eşleşti.
//              İlan fiyatı ÷ tapudaki alış fiyatı = rakibin gerçek marjı.
//   2) CANLI — Landio ilan durumu: PENDING = alıcı bulundu, kapanış bekliyor.
//              "İlan listeden kayboldu" tahmininin aksine doğrudan satış sinyali.
//
// Veri: src/data/rakip-kanit.json ← node scraper/build-rakip-kanit.mjs
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/rakip-kanit.json";
import { Gavel, Activity, Percent, Eye, Info } from "lucide-react";

export const metadata = { title: "Rakip Kanıtı — VegaLand" };

const n = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));
const usd = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

type Marj = {
  competitor: string; status: string; title: string; apn: string; acres: number | null;
  ilan_fiyat: number; sale_year: number; sale_month: number | null; alis_fiyat: number; kat: number;
};
type Taksit = { state: string; county: string; fiyat: number; pesinat: number; oran: number; acres: number; gorulme: number; durum: string };
type Snapshot = {
  uretildi: string; ortKat: number | null; tapuSiniri: string;
  marjRakipler: string[];
  medyanPesinat: number | null;
  pesinatBandi: { min: number; max: number } | null;
  marj: Marj[];
  eyalet: { state: string; ilan: number; sozlesmede: number; ort_fiyat: number }[];
  taksit: Taksit[];
  landioOzet: {
    toplam: number; aktif: number; sozlesmede: number; taksitli: number; kendiMali: number; ortGorulme: number;
    enCokGorulen: { state: string; county: string; fiyat: number; gorulme: number; acres: number; durum: string }[];
  } | null;
};
const S = data as unknown as Snapshot;

function Kart({ deger, etiket, alt, renk }: { deger: string; etiket: string; alt: string; renk?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}>
      <div className="text-[28px] font-bold leading-none tabular-nums" style={{ color: renk }}>{deger}</div>
      <div className="mt-1.5 text-[12px] font-bold uppercase tracking-[0.1em]">{etiket}</div>
      <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>{alt}</div>
    </div>
  );
}

export default function RakipKanitPage() {
  const L = S.landioOzet;
  const enIyi = [...S.marj].sort((a, b) => b.kat - a.kat);
  // Peşinat dağılımı iki tepeli (%10-20 ve %50 bandı) — ORTALAMA ikisinin
  // arasına düşüp hiçbir gerçek ilanı temsil etmiyordu ("%37" diye bir peşinat
  // yok). Medyan + bant gösteriliyor.
  const ortPesinat = S.medyanPesinat;

  return (
    <div className="max-w-[1150px] mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#b45309" }}>
        PAZAR · RAKİP KANITI
      </div>
      <h1 className="text-[26px] font-bold flex items-center gap-2.5">
        <Gavel size={24} /> Rakipler Gerçekten Satıyor mu?
      </h1>
      <p className="mt-2 mb-6 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        İki bağımsız belge: <b style={{ color: "var(--foreground)" }}>tapu kaydı</b> (rakibin parseli kaça aldığı) ve
        <b style={{ color: "var(--foreground)" }}> canlı ilan durumu</b> (sözleşmeye giren ilanlar). Hiçbir rakam
        tahmin değil — her satırın arkasında ya tapu kaydı ya rakibin kendi yayınladığı durum bilgisi var.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kart deger={S.ortKat ? `${S.ortKat}x` : "—"} etiket="Ortalama marj" alt={`${S.marj.length} parselde tapu eşleşmesi`} renk="#15803d" />
        <Kart deger={L ? n(L.sozlesmede) : "—"} etiket="Sözleşmede" alt={L ? `${L.toplam} ilanın %${Math.round((L.sozlesmede / L.toplam) * 100)}'i` : ""} renk="#b45309" />
        <Kart deger={ortPesinat != null ? `%${ortPesinat}` : "—"} etiket="Medyan peşinat" alt={S.pesinatBandi ? `bant %${S.pesinatBandi.min}–%${S.pesinatBandi.max} · ${S.taksit.length} ilan` : ""} />
        <Kart deger={L ? n(L.ortGorulme) : "—"} etiket="Ort. görüntülenme" alt="ilan başına talep sinyali" />
      </div>

      {/* ── 1) TAPU KANITI ─────────────────────────────────────────────── */}
      <h2 className="text-[18px] font-bold flex items-center gap-2 mb-1"><Gavel size={18} /> Tapu kanıtı — {S.marjRakipler.join(", ")}: tapudaki bedel ile İSTEDİĞİ fiyat</h2>
      <p className="text-[12px] mb-3 max-w-3xl" style={{ color: "var(--muted)" }}>
Eşleşmelerin tamamı <b style={{ color: "var(--foreground)" }}>{S.marjRakipler.join(", ")}</b> ilanlarından —
        tapu verimiz FL/CO'yu kapsadığı için yalnız oradaki ilanlar eşleşebiliyor.
        Rakip ilanının parsel numarası, gerçek tapu satış kaydıyla eşleşti. Tapu tarihi ilanı ilk gördüğümüz tarihten
        önce olduğu için bu kayıt rakibin <b>satın alma</b> işlemidir.
      </p>
      <div className="overflow-x-auto rounded-xl border mb-3" style={{ borderColor: "var(--border, #e2e8f0)" }}>
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr style={{ background: "var(--surface-2, #f8fafc)" }}>
              {["Rakip", "Parsel", "Tapuda aldığı", "İlan fiyatı", "Kat", "İlan durumu"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enIyi.map((m, i) => (
              <tr key={m.apn + i} className="border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
                <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{m.competitor}</td>
                <td className="px-3 py-2.5 max-w-[320px]">
                  <span className="line-clamp-1" title={m.title}>{m.title}</span>
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>{m.acres ? `${m.acres} ac · ` : ""}APN {m.apn}</span>
                </td>
                <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                  {usd(m.alis_fiyat)}
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}> · {m.sale_year}/{m.sale_month ?? "—"}</span>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{usd(m.ilan_fiyat)}</td>
                <td className="px-3 py-2.5 tabular-nums font-bold" style={{ color: m.kat >= 4 ? "#15803d" : "var(--foreground)" }}>{m.kat}x</td>
                <td className="px-3 py-2.5 text-[12px]">{m.status === "SUSPECTED_SOLD" ? "listeden düştü" : "satışta"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border px-4 py-2.5 text-[12px] mb-8 flex items-start gap-2" style={{ borderColor: "#d9770655", background: "#d977060d", color: "#b45309" }}>
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>{S.tapuSiniri} Daha taze satış için county tapu sicilinin ayrıca bağlanması gerekiyor — eyalet kadastro dosyası yılda bir yayınlanıyor.</span>
      </div>

      {/* ── 2) CANLI DURUM ─────────────────────────────────────────────── */}
      {L && (
        <>
          <h2 className="text-[18px] font-bold flex items-center gap-2 mb-1"><Activity size={18} /> Canlı ilan durumu — <span style={{ color: "#b45309" }}>Landio</span></h2>
          <p className="text-[12px] mb-3 max-w-3xl" style={{ color: "var(--muted)" }}>
    Bu bölümün tamamı <b style={{ color: "var(--foreground)" }}>Landio</b>&apos;nun kendi yayınladığı ilan verisinden.{" "}
            <b style={{ color: "var(--foreground)" }}>PENDING</b> = alıcı bulunmuş, kapanış bekleniyor. Bu, ilanın
            listeden kaybolmasından farklı olarak <b style={{ color: "var(--foreground)" }}>doğrudan satış sinyalidir</b>.
          </p>
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <Kart deger={n(L.aktif)} etiket="Satışta" alt="ACTIVE" />
            <Kart deger={n(L.sozlesmede)} etiket="Sözleşmede" alt="PENDING — alıcı bulundu" renk="#b45309" />
            <Kart deger={n(L.taksitli)} etiket="Taksitli" alt="owner financing sunulan" />
            <Kart deger={n(L.kendiMali)} etiket="Kendi malı" alt="geri kalanı 3. taraf satıcı" />
          </div>

          <div className="rounded-xl border p-4 mb-8" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface-2, #f8fafc)" }}>
            <div className="flex items-center gap-2 text-[13px] font-bold mb-2"><Eye size={15} /> En çok ilgi gören ilanlar</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {L.enCokGorulen.map((x, i) => (
                <div key={i} className="rounded-lg border p-3" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}>
                  <div className="text-[13px] font-bold">{x.state}/{x.county}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{x.acres} ac · {usd(x.fiyat)}</div>
                  <div className="mt-1.5 text-[18px] font-bold tabular-nums">{n(x.gorulme)}</div>
                  <div className="text-[10px]" style={{ color: x.durum === "PENDING" ? "#b45309" : "var(--muted)" }}>
                    görüntülenme{x.durum === "PENDING" ? " · SÖZLEŞMEDE" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── 3) TAKSİT ŞARTLARI ─────────────────────────────────────────── */}
      {S.taksit.length > 0 && (
        <>
          <h2 className="text-[18px] font-bold flex items-center gap-2 mb-1"><Percent size={18} /> Taksit şartları — <span style={{ color: "#b45309" }}>Landio</span></h2>
          <p className="text-[12px] mb-3 max-w-3xl" style={{ color: "var(--muted)" }}>
            Peşinat oranları rakibin kendi ilanından. Kendi fiyat/peşinat politikamızı buna göre konumlandırabiliriz.
          </p>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border, #e2e8f0)" }}>
            <table className="w-full min-w-[700px] text-[13px]">
              <thead>
                <tr style={{ background: "var(--surface-2, #f8fafc)" }}>
                  {["Bölge", "Dönüm", "Fiyat", "Peşinat", "Oran", "Görüntülenme", "Durum"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {S.taksit.map((t, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
                    <td className="px-3 py-2.5 whitespace-nowrap">{t.state}/{t.county}</td>
                    <td className="px-3 py-2.5 tabular-nums">{t.acres}</td>
                    <td className="px-3 py-2.5 tabular-nums">{usd(t.fiyat)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{usd(t.pesinat)}</td>
                    <td className="px-3 py-2.5 tabular-nums font-bold">%{t.oran}</td>
                    <td className="px-3 py-2.5 tabular-nums">{n(t.gorulme)}</td>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: t.durum === "PENDING" ? "#b45309" : "var(--muted)" }}>
                      {t.durum === "PENDING" ? "sözleşmede" : "satışta"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-8 text-[11px]" style={{ color: "var(--muted)" }}>
        Veri anı: {new Date(S.uretildi).toLocaleString("tr-TR")} · tazelemek için{" "}
        <code>node scraper/build-rakip-kanit.mjs</code> · kaynaklar: `land_comps` (kamu tapu kaydı) +
        rakibin kendi yayınladığı ilan verisi.
      </p>
    </div>
  );
}
