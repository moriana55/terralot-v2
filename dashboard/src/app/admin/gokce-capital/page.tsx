// ─────────────────────────────────────────────────────────────────────────────
// GOKCE CAPITAL DOSYASI — tek rakip derin analizi.
//
// Neden ayrı sayfa: `toplu-alicilar` listesinde envanterimizle ÖRTÜŞMESİ en
// yüksek şirket. Hem rakibimiz hem potansiyel toplu alıcımız.
//
// ⚠ İlan listesi burada YOK — ilan platformu (gokcecapital.gokcap.com)
// CloudFront ile Türkiye'ye kapalı (HTTP 403). Bu sayfa onların İLANLARINI
// değil, kamu tapu kaydındaki MÜLKİYETLERİNİ gösterir; kanıt değeri olan da bu.
//
// Veri: src/data/gokce-capital.json ← node scraper/build-gokce.mjs
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/gokce-capital.json";
import { Building2, MapPin, User, AlertTriangle, Layers, Tag, Gift, Route } from "lucide-react";

export const metadata = { title: "Gokce Capital — VegaLand" };

const n = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));
const usd = (v: number | null | undefined) => (v == null || v === 0 ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

type Parsel = {
  lead_id: string; state: string; county: string; apn: string; owner: string;
  acres: number | null; land_value: number | null; est_offer: number | null;
  grade: string | null; mailing_address: string | null; mailing_city: string | null;
  mailing_state: string | null; situs: string | null; absentee: boolean | null;
};
type Tapu = {
  state: string; county: string; apn: string; acres: number | null;
  assessed_total: number | null; last_sale_price: number | null; last_sale_year: number | null;
};
type Snapshot = {
  uretildi: string;
  profil: Record<string, string>;
  ozet: {
    parselSayisi: number; toplamDonum: number; toplamArsaDegeri: number;
    countySayisi: number; eyaletSayisi: number; tapuKaydi: number;
    ortusenBizimParsel: number; ortusenBizimUstNot: number;
  };
  adresler: string[];
  parseller: Parsel[];
  tapu: Tapu[];
  ortusme: { bolge: string; bizim_parsel: number; bizim_ustnot: number }[];
  ilanlar: { no: number; ad: string; apn: string; acres: number; county: string; state: string; fiyat: number; vergi: number | null; hoa: number; durum: string }[];
  ilanOzet: { sayi: number; listeDegeri: number; toplamDonum: number; satista: number; beklemede: number; eyaletler: [string, number][]; enUcuz: number; enPahali: number } | null;
  ilanKaynak: string | null; ilanAlindi: string | null;
  eslesme: { tapuEslesme: number; envanterEslesme: number; toplamIlan: number;
    satirlar: { state: string; county: string; acres: number; fiyat: number; alis: number | null; alisYil: number | null; kat: number | null; bizdeVar: boolean }[] } | null;
  oyunKitabi: {
    huni: { gun: number; baslik: string; ozet: string }[];
    erkenOdeme: string; takasGarantisi: string;
    bonuslar: { ad: string; deger: number }[]; bonusToplam: number; cikarim: string;
  };
};
const S = data as unknown as Snapshot;

function Kart({ deger, etiket, alt }: { deger: string; etiket: string; alt?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}>
      <div className="text-[26px] font-bold leading-none tabular-nums">{deger}</div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">{etiket}</div>
      {alt && <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>{alt}</div>}
    </div>
  );
}

export default function GokceCapitalPage() {
  const P = S.profil;
  return (
    <div className="max-w-[1150px] mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7c2d12" }}>
        PAZAR · RAKİP DOSYASI
      </div>
      <h1 className="text-[26px] font-bold flex items-center gap-2.5">
        <Building2 size={24} /> Gokce Capital
      </h1>
      <p className="mt-2 mb-6 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Envanterimizle örtüşmesi en yüksek şirket — bizim county&apos;lerimizde parsel topluyor.
        Hem rakip hem potansiyel toplu alıcı.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kart deger={n(S.ozet.parselSayisi)} etiket="Parselleri" alt={`${S.ozet.countySayisi} county · ${S.ozet.eyaletSayisi} eyalet`} />
        <Kart deger={n(S.ozet.toplamDonum)} etiket="Toplam dönüm" alt="acre" />
        <Kart deger={usd(S.ozet.toplamArsaDegeri)} etiket="Arsa değeri" alt="vergi dairesi kaydı" />
        <Kart deger={n(S.ozet.ortusenBizimUstNot)} etiket="Bizim A+/A stok" alt="onların bulunduğu county'lerde" />
      </div>

      {/* Profil */}
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface-2, #f8fafc)" }}>
        <div className="flex items-center gap-2 text-[14px] font-bold mb-2"><User size={16} /> Kurucu: {P.kurucu}</div>
        <p className="text-[13px] mb-2">{P.gecmis}</p>
        <p className="text-[13px] mb-2"><b>Model:</b> {P.model}</p>
        <p className="text-[13px] mb-2"><b>Ölçek:</b> {P.olcek}</p>
        <p className="text-[13px]"><b>Pazarlama:</b> {P.pazarlama}</p>
      </div>

      {/* İlan envanteri — siteden elle alındı */}
      {S.ilanOzet && (
        <>
          <h2 className="text-[18px] font-bold flex items-center gap-2 mb-1"><Tag size={18} /> Satıştaki ilanları ({S.ilanOzet.sayi})</h2>
          <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
            Kaynak: {S.ilanKaynak} · {S.ilanAlindi}. Site otomatik erişime kapalı olduğu için liste elle alındı.
          </p>
          <div className="rounded-lg border px-4 py-2.5 text-[12px] mb-4" style={{ borderColor: "#b4530944", background: "#b453090d", color: "#b45309" }}>
            <b>&quot;REZERVE&quot; pasif bir durum değil, canlı satış sinyali.</b> Kendi hunilerinin 1. günü
            &quot;lotu sitede kendine kilitle&quot; adımı — yani o parseli bir alıcı kapatmış, süre işliyor
            (bir ilanda &quot;On Hold until 08-03 16:55 EST&quot; şeklinde geri sayım görüldü).
            Landio&apos;daki PENDING&apos;in karşılığı.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kart deger={n(S.ilanOzet.listeDegeri)} etiket="Liste değeri" alt={`${S.ilanOzet.sayi} ilan · ${S.ilanOzet.toplamDonum} dönüm`} />
            <Kart deger={n(S.ilanOzet.beklemede)} etiket="Rezerve edilmiş" alt={`${S.ilanOzet.satista} ilan hâlâ satışta`} />
            <Kart deger={usd(S.ilanOzet.enUcuz)} etiket="En ucuz" alt={`en pahalı ${usd(S.ilanOzet.enPahali)}`} />
            <Kart deger={String(S.ilanOzet.eyaletler.length)} etiket="Eyalet" alt={S.ilanOzet.eyaletler.slice(0, 4).map(([k, v]) => `${k} ${v}`).join(" · ")} />
          </div>

          {S.eslesme && S.eslesme.satirlar.filter((x) => x.kat).length > 0 && (
            <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "#15803d44", background: "#15803d0d" }}>
              <div className="text-[13px] font-bold mb-2" style={{ color: "#15803d" }}>
                Tapu eşleşmesi — kaça alıp kaça sattıkları
              </div>
              {S.eslesme.satirlar.filter((x) => x.kat).sort((a, b) => (b.kat ?? 0) - (a.kat ?? 0)).map((x, i) => (
                <div key={i} className="text-[13px] py-1">
                  <b>{x.kat}x</b> · {x.state}/{x.county} {x.acres} ac — tapuda <b>{usd(x.alis)}</b> ({x.alisYil}) aldı,
                  <b> {usd(x.fiyat)}</b> istiyor
                </div>
              ))}
              <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                {S.eslesme.envanterEslesme} ilanları bizim off-market envanterimizde de kayıtlı.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border mb-8" style={{ borderColor: "var(--border, #e2e8f0)" }}>
            <table className="w-full min-w-[780px] text-[13px]">
              <thead>
                <tr style={{ background: "var(--surface-2, #f8fafc)" }}>
                  {["#", "Parsel", "Bölge", "Dönüm", "Fiyat", "$/acre", "Vergi/yıl", "HOA/yıl", "Durum"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {S.ilanlar.map((i) => (
                  <tr key={i.no + i.apn} className="border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
                    <td className="px-3 py-2 tabular-nums" style={{ color: "var(--muted)" }}>{i.no}</td>
                    <td className="px-3 py-2 max-w-[210px]"><span className="line-clamp-1" title={i.ad}>{i.ad}</span></td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.state}/{i.county}</td>
                    <td className="px-3 py-2 tabular-nums">{i.acres}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold">{usd(i.fiyat)}</td>
                    <td className="px-3 py-2 tabular-nums">{i.acres ? usd(i.fiyat / i.acres) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{i.vergi ? usd(i.vergi) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{i.hoa ? usd(i.hoa) : "—"}</td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: i.durum === "On Hold" ? "#b45309" : "var(--muted)" }}>
                      {i.durum === "On Hold" ? "REZERVE" : "satışta"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Satış oyun kitabı */}
      <h2 className="text-[18px] font-bold flex items-center gap-2 mb-1"><Route size={18} /> Satış oyun kitapları</h2>
      <p className="text-[12px] mb-3 max-w-3xl" style={{ color: "var(--muted)" }}>
        Sitelerinden birebir alındı. Kendi satış sayfamızı kurarken doğrudan kıyas malzemesi.
      </p>
      <div className="grid sm:grid-cols-5 gap-2 mb-4">
        {S.oyunKitabi.huni.map((h) => (
          <div key={h.gun} className="rounded-lg border p-3" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}>
            <div className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>GÜN {h.gun}</div>
            <div className="text-[13px] font-bold mt-0.5">{h.baslik}</div>
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{h.ozet}</div>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border, #e2e8f0)" }}>
          <div className="text-[13px] font-bold mb-1">Erken ödeme ödülü</div>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>{S.oyunKitabi.erkenOdeme}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border, #e2e8f0)" }}>
          <div className="text-[13px] font-bold mb-1">365 gün takas garantisi</div>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>{S.oyunKitabi.takasGarantisi}</p>
        </div>
      </div>
      <div className="rounded-xl border p-4 mb-3" style={{ borderColor: "var(--border, #e2e8f0)" }}>
        <div className="text-[13px] font-bold mb-2 flex items-center gap-2">
          <Gift size={15} /> Hediye paketi — algılanan değer {usd(S.oyunKitabi.bonusToplam)}
        </div>
        <div className="grid sm:grid-cols-3 gap-x-5 gap-y-1 text-[12px]">
          {S.oyunKitabi.bonuslar.map((b) => (
            <div key={b.ad} className="flex justify-between gap-2">
              <span style={{ color: "var(--muted)" }}>{b.ad}</span>
              <span className="tabular-nums shrink-0">{usd(b.deger)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border p-4 mb-8 flex items-start gap-2.5" style={{ borderColor: "#15803d44", background: "#15803d0d" }}>
        <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "#15803d" }} />
        <div className="text-[13px]" style={{ color: "#166534" }}><b>Çıkarım:</b> {S.oyunKitabi.cikarim}</div>
      </div>

      {/* Posta adresleri */}
      <div className="rounded-xl border p-4 mb-8" style={{ borderColor: "var(--border, #e2e8f0)" }}>
        <div className="text-[13px] font-bold mb-2 flex items-center gap-2"><MapPin size={15} /> Kayıtlı posta adresleri</div>
        <ul className="text-[12px] space-y-1">
          {S.adresler.map((a) => <li key={a} style={{ color: "var(--muted)" }}>· {a}</li>)}
        </ul>
        <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
          Üçü de <b>sanal ofis / posta kutusu</b> — fiziki ofis yok. Uzaktan çalışan bir arsa çevirme operasyonu.
        </p>
      </div>

      {/* Örtüşme */}
      <h2 className="text-[18px] font-bold flex items-center gap-2 mb-1"><Layers size={18} /> Bizim envanterle örtüşme</h2>
      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Onların parsel tuttuğu county&apos;lerde bizim stokumuz. Toplu teklif götürülecek yerler bunlar.
      </p>
      <div className="overflow-x-auto rounded-xl border mb-8" style={{ borderColor: "var(--border, #e2e8f0)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: "var(--surface-2, #f8fafc)" }}>
              {["Bölge", "Onların parseli", "Bizim parselimiz", "Bizim A+/A"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {S.ortusme.map((o) => {
              const onlar = S.parseller.filter((p) => `${p.state}/${p.county}` === o.bolge).length;
              return (
                <tr key={o.bolge} className="border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
                  <td className="px-3 py-2.5 font-semibold">{o.bolge}</td>
                  <td className="px-3 py-2.5 tabular-nums">{onlar}</td>
                  <td className="px-3 py-2.5 tabular-nums">{n(o.bizim_parsel)}</td>
                  <td className="px-3 py-2.5 tabular-nums font-bold" style={{ color: "#15803d" }}>{n(o.bizim_ustnot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tapu kaydı */}
      {S.tapu.length > 0 && (
        <>
          <h2 className="text-[18px] font-bold mb-1">Tapu kaydındaki alımları</h2>
          <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>Ne zaman, kaça almışlar.</p>
          <div className="overflow-x-auto rounded-xl border mb-8" style={{ borderColor: "var(--border, #e2e8f0)" }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: "var(--surface-2, #f8fafc)" }}>
                  {["Bölge", "APN", "Dönüm", "Alış fiyatı", "Yıl", "Vergi değeri"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {S.tapu.map((t, i) => (
                  <tr key={t.apn + i} className="border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
                    <td className="px-3 py-2.5">{t.state}/{t.county}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">{t.apn}</td>
                    <td className="px-3 py-2.5 tabular-nums">{t.acres ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{usd(t.last_sale_price)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{t.last_sale_year ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{usd(t.assessed_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tam parsel listesi */}
      <h2 className="text-[18px] font-bold mb-3">Ellerindeki parseller ({S.parseller.length})</h2>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border, #e2e8f0)" }}>
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr style={{ background: "var(--surface-2, #f8fafc)" }}>
              {["Bölge", "APN", "Dönüm", "Arsa değeri", "Sahip kaydı", "Posta"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {S.parseller.map((p) => (
              <tr key={p.lead_id} className="border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
                <td className="px-3 py-2.5 whitespace-nowrap">{p.state}/{p.county}</td>
                <td className="px-3 py-2.5 font-mono text-[11px]">{p.apn}</td>
                <td className="px-3 py-2.5 tabular-nums">{p.acres ?? "—"}</td>
                <td className="px-3 py-2.5 tabular-nums">{usd(p.land_value)}</td>
                <td className="px-3 py-2.5 text-[12px] max-w-[220px]"><span className="line-clamp-1" title={p.owner}>{p.owner}</span></td>
                <td className="px-3 py-2.5 text-[11px] max-w-[200px]" style={{ color: "var(--muted)" }}>
                  <span className="line-clamp-1">{[p.mailing_city, p.mailing_state].filter(Boolean).join(", ")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-[11px]" style={{ color: "var(--muted)" }}>
        Veri anı: {new Date(S.uretildi).toLocaleString("tr-TR")} · tazelemek için{" "}
        <code>node scraper/build-gokce.mjs</code> · kaynak: kamu tapu/parsel kaydı ({P.site})
      </p>
    </div>
  );
}
