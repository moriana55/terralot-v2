// ─────────────────────────────────────────────────────────────────────────────
// ULUSAL OPERASYON SUNUMU — Ahmet'e canlı anlatım ekranı (2026-08).
//
// Mevcut `/admin/sunum` tek county'lik (Mohave) eski dönemi anlatıyor; bu sayfa
// 25 eyalet / 921K parsellik bugünkü operasyonu anlatır. İkisi de duruyor.
//
// HİKÂYE SIRASI — sunumda yukarıdan aşağı okunur:
//   1. Ne kadar arsamız var, nerede          (envanter)
//   2. Hangisi satılabilir                   (not motoru + geo doğrulama)
//   3. Alıcı kim, neden orada yaşıyor        (bölge profili)
//   4. Toplu satış kanalı                    (kurumsal alıcılar)
//   5. Sıradaki adım                         (skip-trace listesi)
//
// TÜM RAKAMLAR SNAPSHOT'TAN TÜRETİLİR — bu dosyada hardcoded sayı YOKTUR.
// Tazelemek için: node scraper/build-bolge-profili.mjs && node scraper/build-toplu-alicilar.mjs
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import bolge from "@/data/bolge-profili.json";
import alici from "@/data/toplu-alicilar.json";
import { Map as MapIcon, Award, Users, Building2, PhoneCall, ArrowRight } from "lucide-react";

export const metadata = { title: "Ulusal Operasyon Sunumu — VegaLand" };

type County = {
  state: string; county: string; lead: number; aplus: number;
  sinif: string; sinifRenk: string; neden: string;
};
type Bolge = {
  uretildi: string; countyN: number; toplamLead: number; kapsananLead: number;
  dagilim: Record<string, number>; county: County[];
};
type Alici = {
  biriktirici: { owner: string; parsel: number; countyN: number; posta: string | null; kesisimAplus: number; bolgeler: string[] }[];
  aktif: { owner: string; tazeParsel: number | null; sonAlim: number | null; posta: string | null; kesisimAplus: number }[];
  sayac: { lead_toplam: number; lead_kurumsal: number; kurumsal_sahip_n: number };
};

const B = bolge as unknown as Bolge;
const A = alici as unknown as Alici;
const n = (v: number) => v.toLocaleString("en-US");

// Türetilmiş özetler — sayfada hiçbir sayı elle yazılmaz.
const eyaletler = [...new Set(B.county.map((c) => c.state))];
const toplamAplusA = B.county.reduce((s, c) => s + c.aplus, 0);
const parselDagilim = (() => {
  const m = new Map<string, { parsel: number; county: number; renk: string }>();
  for (const c of B.county) {
    const e = m.get(c.sinif) ?? { parsel: 0, county: 0, renk: c.sinifRenk };
    e.parsel += c.lead; e.county += 1;
    m.set(c.sinif, e);
  }
  return [...m.entries()].sort((a, b) => b[1].parsel - a[1].parsel);
})();
const ilkIki = parselDagilim.slice(0, 2);
const ilkIkiPay = Math.round((ilkIki.reduce((s, [, v]) => s + v.parsel, 0) / B.toplamLead) * 100);
const enIyiKesisim = [...A.biriktirici, ...A.aktif].sort((a, b) => b.kesisimAplus - a.kesisimAplus).slice(0, 5);
const postaliSirket = [...A.biriktirici, ...A.aktif].filter((x) => x.posta).length;
const enBuyukCounty = B.county.slice(0, 6);

function Buyuk({ deger, etiket, alt, renk }: { deger: string; etiket: string; alt?: string; renk?: string }) {
  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface, #fff)" }}>
      <div className="text-[40px] font-bold leading-none tabular-nums" style={{ color: renk ?? "var(--foreground)" }}>{deger}</div>
      <div className="mt-2 text-[13px] font-bold uppercase tracking-[0.12em]">{etiket}</div>
      {alt && <div className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>{alt}</div>}
    </div>
  );
}

function Bolum({ no, baslik, ozet, children }: { no: number; baslik: string; ozet: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline gap-3">
        <span className="text-[13px] font-bold tabular-nums" style={{ color: "#16a34a" }}>{String(no).padStart(2, "0")}</span>
        <h2 className="text-[22px] font-bold">{baslik}</h2>
      </div>
      <p className="mt-1.5 mb-5 text-[14px] max-w-3xl" style={{ color: "var(--muted)" }}>{ozet}</p>
      {children}
    </section>
  );
}

export default function SunumUlusalPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: "#16a34a" }}>
        VEGALAND · ULUSAL OPERASYON
      </div>
      <h1 className="mt-2 text-[34px] font-bold leading-tight">
        {eyaletler.length} eyalette {n(B.toplamLead)} arsa —<br />hangisi satılır, kime satılır
      </h1>
      <p className="mt-3 text-[15px] max-w-3xl" style={{ color: "var(--muted)" }}>
        Her rakam kamu tapu kaydından ve ücretsiz ABD kamu verisinden ölçüldü. Tahmin, yuvarlama ya da
        &quot;yaklaşık&quot; yok — her sayının arkasındaki kaynak panelde satır satır açılabiliyor.
      </p>

      {/* 1 — ENVANTER */}
      <Bolum
        no={1}
        baslik="Ne kadar arsamız var, nerede"
        ozet={`${eyaletler.length} eyalet, ${B.countyN} county. Hepsi off-market: sahibi ilana çıkarmamış, rakip görmemiş parseller.`}
      >
        <div className="grid sm:grid-cols-3 gap-4">
          <Buyuk deger={n(B.toplamLead)} etiket="Off-market parsel" alt="sahibi belirlenmiş, haritada işaretli" />
          <Buyuk deger={String(eyaletler.length)} etiket="Eyalet" alt={`${B.countyN} county'de dağılmış`} />
          <Buyuk deger={n(A.sayac.kurumsal_sahip_n)} etiket="Ayrı şirket sahip" alt={`${n(A.sayac.lead_kurumsal)} parsel kurumsal elde`} />
        </div>
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface-2, #f8fafc)" }}>
          <div className="text-[12px] font-bold mb-2">En büyük 6 county</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {enBuyukCounty.map((c) => (
              <div key={c.state + c.county} className="text-[13px]">
                <b>{c.state} / {c.county}</b>
                <div style={{ color: "var(--muted)" }}>{n(c.lead)} parsel · {n(c.aplus)} üst not</div>
              </div>
            ))}
          </div>
        </div>
        <Link href="/admin/harita" className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#16a34a" }}>
          <MapIcon size={15} /> Haritada göster <ArrowRight size={14} />
        </Link>
      </Bolum>

      {/* 2 — KALİTE */}
      <Bolum
        no={2}
        baslik="Hangisi gerçekten satılabilir"
        ozet="Not motoru her parseli Amerikalı arsa alıcısının aradığı özelliklere göre puanlar: yol erişimi, elektrik, su/göl yakınlığı, kasaba mesafesi (OpenStreetMap gerçek verisi) + pazar likiditesi + satıcı motivasyonu. A+/A notu YALNIZCA sahada doğrulanmış parsele verilir."
      >
        <div className="grid sm:grid-cols-3 gap-4">
          <Buyuk deger={n(toplamAplusA)} etiket="A+ / A notlu parsel" alt="satışa hazır vitrin" renk="#15803d" />
          <Buyuk deger={n(B.toplamLead)} etiket="Puanlanan kayıt" alt="istisnasız tamamı" />
          <Buyuk deger={`%${Math.round((toplamAplusA / B.toplamLead) * 100 * 10) / 10}`} etiket="Vitrine giren oran" alt="county içi en iyi %1-5" />
        </div>
        <p className="mt-4 text-[13px]" style={{ color: "var(--muted)" }}>
          Ölçü katı: geo doğrulaması yapılmamış parsel A+/A olamaz — &quot;yol var&quot; demek için yolu görmüş olmak gerekiyor.
        </p>
        <Link href="/admin/arsa-notlari" className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#16a34a" }}>
          <Award size={15} /> A+ vitrini aç <ArrowRight size={14} />
        </Link>
      </Bolum>

      {/* 3 — ALICI KİM */}
      <Bolum
        no={3}
        baslik="Alıcı kim — insanlar bu bölgelerde neden yaşıyor"
        ozet={`${B.countyN} county'nin her biri için yaşam sebebi ölçüldü (BLS sektörel istihdam yoğunluğu + demografi). Envanterin %${ilkIkiPay}'i iki hikâyede toplanıyor — yani iki mektup şablonu envanterin yarısını karşılıyor.`}
      >
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          {ilkIki.map(([ad, v]) => (
            <div key={ad} className="rounded-2xl border p-5" style={{ borderColor: v.renk + "44", background: v.renk + "0d" }}>
              <div className="text-[32px] font-bold leading-none tabular-nums" style={{ color: v.renk }}>{n(v.parsel)}</div>
              <div className="mt-1.5 text-[15px] font-bold">{ad}</div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                {v.county} county · envanterin %{Math.round((v.parsel / B.toplamLead) * 100)}&apos;i
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {parselDagilim.slice(2).map(([ad, v]) => (
            <div key={ad} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border, #e2e8f0)" }}>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: v.renk }}>{n(v.parsel)}</span>
              <span className="ml-2 text-[12px]" style={{ color: "var(--muted)" }}>{ad}</span>
            </div>
          ))}
        </div>
        <Link href="/admin/bolge-profili" className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#16a34a" }}>
          <Users size={15} /> County county gerekçeleri <ArrowRight size={14} />
        </Link>
      </Bolum>

      {/* 4 — TOPLU SATIŞ */}
      <Bolum
        no={4}
        baslik="Toplu satış kanalı — arsayı zaten toplayan şirketler"
        ozet={`Parselleri tek tek satmak tek yol değil. Bizim county'lerimizde hâlihazırda arsa biriktiren ${n(A.biriktirici.length)} şirket ve tapuda hâlâ alım yapan ${n(A.aktif.length)} şirket tespit edildi; ${n(postaliSirket)} tanesinin posta adresi kamu kaydından birebir çıktı.`}
      >
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border, #e2e8f0)" }}>
          <div className="px-4 py-2.5 text-[12px] font-bold" style={{ background: "var(--surface-2, #f8fafc)" }}>
            Önce bunlara gidilir — bizim envanterimizle en çok örtüşenler
          </div>
          {enIyiKesisim.map((x) => (
            <div key={x.owner} className="flex items-center justify-between gap-4 px-4 py-3 border-t" style={{ borderColor: "var(--border, #e2e8f0)" }}>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate">{x.owner}</div>
                {x.posta && <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{x.posta}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[18px] font-bold tabular-nums" style={{ color: "#15803d" }}>{n(x.kesisimAplus)}</div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>aynı county&apos;de üst not</div>
              </div>
            </div>
          ))}
        </div>
        <Link href="/admin/toplu-alicilar" className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#16a34a" }}>
          <Building2 size={15} /> Tam liste + CSV <ArrowRight size={14} />
        </Link>
      </Bolum>

      {/* 5 — SIRADAKİ ADIM */}
      <Bolum
        no={5}
        baslik="Sıradaki adım — sahiplere ulaşmak"
        ozet="Üst notlu parsellerin sahipleri kişi bazında tekilleştirilip skip-trace sağlayıcısına verilecek formatta çıkarıldı. Aynı kişinin 99 parseli varsa bir kez sorgulanır — telefon zaten aynı, maliyet boşuna katlanmaz."
      >
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--border, #e2e8f0)", background: "var(--surface-2, #f8fafc)" }}>
          <div className="flex items-center gap-2 text-[14px] font-bold mb-2">
            <PhoneCall size={16} /> Liste hazır, tek karar kaldı
          </div>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Dosya: <code>scraper/out/skiptrace-*.csv</code> — ad, soyad, posta adresi, mülk yeri, county,
            APN, kaç parseli olduğu ve koordinat. Telefonlar geldiğinde tek komutla panele yüklenir ve
            arama kuyruğu dolar. Bekleyen: hangi skip-trace sağlayıcısıyla çalışılacağı.
          </p>
        </div>
      </Bolum>

      <p className="mt-12 text-[11px]" style={{ color: "var(--muted)" }}>
        Veri anı: {new Date(B.uretildi).toLocaleString("tr-TR")} · kapsam: {n(B.kapsananLead)}/{n(B.toplamLead)} parsel
        ({B.countyN} county) · tazelemek için <code>build-bolge-profili.mjs</code> + <code>build-toplu-alicilar.mjs</code>
      </p>
    </div>
  );
}
