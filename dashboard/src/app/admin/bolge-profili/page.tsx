// ─────────────────────────────────────────────────────────────────────────────
// BÖLGE PROFİLİ — "arsalarımızın olduğu yerde insanlar hangi amaçla yaşıyor?"
//
// Her county için ölçülmüş yaşam sebebi + pazarlama karşılığı. Etiket KURAL
// TABANLI (scraper/build-bolge-profili.mjs içindeki eşikler), model yorumu yok;
// gerekçedeki sayı her satırda görünür.
//
// Kaynak: BLS QCEW sektörel istihdam + LQ (ücretsiz, anahtarsız)
//       + county_demographics (yaş, nüfus, büyüme, gelir, ZHVI).
// Veri:   src/data/bolge-profili.json ← node scraper/build-bolge-profili.mjs
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/bolge-profili.json";
import { Users, Compass, Briefcase, Info } from "lucide-react";

export const metadata = { title: "Bölge Profili — VegaLand" };

const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-US"));
const usd = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

type Sektor = { kod: string; ad: string; emp: number; isyeri: number; maas: number; lq: number };
type County = {
  state: string; county: string; altBolge?: string[]; fips: string; lead: number; aplus: number;
  ortDonum: number | null; nufus: number | null; medyanYas: number | null;
  buyume5: number | null; gelir: number | null; zhvi: number | null; izin: number | null;
  toplamEmp: number; isNufusOran: number | null;
  sahiplik: { ad: string; emp: number }[];
  enBuyukSektor: Sektor[]; enYogunSektor: Sektor[];
  sinif: string; sinifRenk: string; neden: string; ikincil: string[];
};
type Snapshot = {
  uretildi: string; qcewYil: string; countyN: number; fipsYok: number; hataN: number;
  kapsananLead: number; toplamLead: number; dagilim: Record<string, number>; county: County[];
};
const S = data as unknown as Snapshot;

// Her yaşam sebebinin SATIŞ karşılığı — Ahmet'in mektup/ilan dilini buradan kurar.
const PAZARLAMA: Record<string, string> = {
  "Askeri / federal üs": "Sık taşınan, kirada oturan, kredi geçmişi düzenli maaşlı kitle. Taksitli satış ve “ilk arsan” mesajı tutar.",
  "Üniversite kasabası": "Genç, peşinatı düşük, uzun vadeli düşünen kitle. Küçük parsel + uzun taksit.",
  "Madencilik · enerji": "Yüksek maaş, dönemsel iş. Peşinat gücü var, hızlı karar verir. Büyük parsel + kısa vade.",
  "Tarım · çiftçilik": "Toprağı bilen alıcı. Dönüm, su hakkı, yol cephesi konuşulur — “yatırım” değil “kullanım” dili.",
  "Turizm · ikinci ev": "Alıcı çoğu zaman bölge dışından. Manzara, kamp/karavan, hafta sonu kaçamağı mesajı.",
  "Emeklilik bölgesi": "Nakit gücü olan, acelesi olmayan kitle. Sessizlik, iklim, düşük vergi vurgusu.",
  "Yatak bölgesi (şehre komşu)": "En güçlü hikâye: “şehre X dk, arsa fiyatı şehrin çeyreği”. Kendi evini yapmak isteyen aile.",
  "Büyüyen banliyö": "Fiyat artışı hikâyesi burada gerçek. Bölünebilir parsel + müteahhide toplu satış.",
  "İmalat · lojistik": "İstikrarlı maaşlı, yerleşik kitle. Taksitli konut arsası.",
  "Kırsal · karma": "Belirgin tek sebep yok — parselin kendi özelliği (yol/elektrik/su) öne çıkarılmalı.",
};

function Rozet({ ad, renk }: { ad: string; renk: string }) {
  return (
    <span
      className="inline-block rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ background: `${renk}14`, color: renk }}
    >
      {ad}
    </span>
  );
}

export default function BolgeProfiliPage() {
  const renkler = new Map(S.county.map((c) => [c.sinif, c.sinifRenk]));
  // County SAYISI değil PARSEL sayısı sıralaması — 8 parselli county ile 140.000
  // parselli county aynı ağırlıkta değil; pazarlama kararı parsele göre verilir.
  const parselDagilim = new Map<string, number>();
  for (const c of S.county) parselDagilim.set(c.sinif, (parselDagilim.get(c.sinif) ?? 0) + c.lead);
  const siralı = [...parselDagilim.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#0891b2" }}>
        PAZAR · BÖLGE PROFİLİ
      </div>
      <h1 className="text-[26px] font-bold flex items-center gap-2.5">
        <Users size={24} /> İnsanlar Bu Bölgede Neden Yaşıyor?
      </h1>
      <p className="mt-2 mb-6 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Arsalarımızın olduğu <b style={{ color: "var(--foreground)" }}>{S.countyN} county</b> — envanterimizin{" "}
        <b style={{ color: "var(--foreground)" }}>%{Math.round((S.kapsananLead / S.toplamLead) * 100)}</b>&apos;i.
        Her county&apos;nin yaşam sebebi <b style={{ color: "var(--foreground)" }}>BLS QCEW {S.qcewYil}</b> sektörel
        istihdam yoğunluğundan (LQ) ve nüfus verisinden ölçüldü. Etiketler kural tabanlı — gerekçedeki sayı her satırda
        görünüyor, tahmin yok.
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {siralı.map(([ad, parsel]) => (
          <div
            key={ad}
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}
          >
            <div className="text-[18px] font-bold leading-none tabular-nums" style={{ color: renkler.get(ad) }}>
              {n(parsel)}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{ad}</div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>
              {S.dagilim[ad]} county · %{Math.round((parsel / S.toplamLead) * 100)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {S.county.map((c) => (
          <div
            key={c.fips + c.county}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold">{c.state} / {c.county}</span>
                  <Rozet ad={c.sinif} renk={c.sinifRenk} />
                  {c.ikincil.map((i) => (
                    <span key={i} className="text-[11px]" style={{ color: "var(--muted)" }}>+ {i}</span>
                  ))}
                </div>
                {c.altBolge && c.altBolge.length > 1 && (
                  <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                    Envanterde {c.altBolge.length} alt bölge olarak duruyor: {c.altBolge.join(" · ")}
                  </div>
                )}
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--foreground)" }}>{c.neden}</p>
                <p className="mt-1.5 text-[12px] flex items-start gap-1.5" style={{ color: "#0f766e" }}>
                  <Compass size={13} className="mt-0.5 shrink-0" />
                  {PAZARLAMA[c.sinif] ?? "—"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[20px] font-bold tabular-nums leading-none">{n(c.lead)}</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>parselimiz{c.aplus > 0 ? ` · ${n(c.aplus)} A+/A` : ""}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: "var(--muted)" }}>
              <span>Nüfus <b style={{ color: "var(--foreground)" }}>{n(c.nufus)}</b></span>
              <span>Medyan yaş <b style={{ color: "var(--foreground)" }}>{c.medyanYas ?? "—"}</b></span>
              <span>Hane geliri <b style={{ color: "var(--foreground)" }}>{usd(c.gelir)}</b></span>
              <span>Ev değeri <b style={{ color: "var(--foreground)" }}>{usd(c.zhvi)}</b></span>
              <span>5y nüfus <b style={{ color: "var(--foreground)" }}>{c.buyume5 == null ? "—" : `%${c.buyume5.toFixed(1)}`}</b></span>
              <span>İş/nüfus <b style={{ color: "var(--foreground)" }}>{c.isNufusOran == null ? "—" : `%${Math.round(c.isNufusOran * 100)}`}</b></span>
              <span>Ort. parsel <b style={{ color: "var(--foreground)" }}>{c.ortDonum ? `${c.ortDonum} ac` : "—"}</b></span>
            </div>

            {c.enYogunSektor.length > 0 && (
              <div className="mt-3 flex items-start gap-2 text-[12px]">
                <Briefcase size={13} className="mt-0.5 shrink-0" style={{ color: "var(--muted)" }} />
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {c.enYogunSektor.map((s) => (
                    <span key={s.kod}>
                      {s.ad} <b className="tabular-nums">LQ {s.lq.toFixed(1)}</b>
                      <span style={{ color: "var(--muted)" }}> · {n(s.emp)} kişi</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border p-4 text-[12px]" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface-2, #f8fafc)" }}>
        <div className="flex items-center gap-1.5 font-bold mb-1.5"><Info size={13} /> LQ nedir?</div>
        <p style={{ color: "var(--muted)" }}>
          Location Quotient — bir sektörün o county&apos;de ülke ortalamasına göre kaç kat yoğun olduğu. LQ 1,0 = ülke
          ortalaması. LQ 19 madencilik = &quot;burası maden kasabası&quot;. Mutlak istihdam her yerde &quot;sağlık +
          perakende&quot; der ve hiçbir şey anlatmaz; yaşam sebebini LQ söyler.
        </p>
        <p className="mt-2" style={{ color: "var(--muted)" }}>
          Snapshot: {new Date(S.uretildi).toLocaleString("tr-TR")} · tazelemek için{" "}
          <code>node scraper/build-bolge-profili.mjs</code>
          {S.fipsYok > 0 && ` · ${S.fipsYok} county FIPS eşleşmediği için dışarıda`}
          {S.hataN > 0 && ` · ${S.hataN} county BLS hatası`}
        </p>
      </div>
    </div>
  );
}
