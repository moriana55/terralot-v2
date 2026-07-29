"use client";

import React, { useEffect, useState } from "react";
import {
  Filter, Ban, Scale, Timer, Calculator, Layers, ShieldCheck,
  ArrowRight, Loader2, CheckCircle2, XCircle, Database, Building2,
  Map as MapIcon,
} from "lucide-react";
import { HasatSagligiKarti } from "./HasatSagligi";

// ─────────────────────────────────────────────────────────────────────────────
// YATIRIM YÖNTEMİ — "neye göre alıyoruz?" sorusunun ekrandaki cevabı.
// Kaynak: YATIRIM-ELEME-METODU.md (proje kökü). Sayılar canlı API'den gelir;
// metin sabittir ama HİÇBİR RAKAM hard-code değildir — /api/admin/istihbarat
// (huni + teklif formülü) ve /api/admin/all-deals?pageSize=1 (deal facet'leri,
// eyalet bazlı comp kapsaması).
//
// Sunum mantığı: önce huni (neyi eliyoruz), sonra veri/kural katmanı (kaynaklar,
// comp kapsaması, scrub, eyalet stratejisi, rakipler), sonra dürüstlük frenleri
// (neyi tahmin ETMİYORUZ), sonra sermaye planı.
//
// 2026-07-29: eski /admin/sistem ekranı buraya birleştirildi (o sayfa artık
// buraya redirect ediyor, gövdesi sistem/_arsiv-ekran.tsx içinde).
// ─────────────────────────────────────────────────────────────────────────────

const say = (n: unknown) => (n == null ? "—" : Number(n).toLocaleString("tr-TR"));
const usd = (n: unknown) => (n == null ? "—" : `$${Math.round(Number(n)).toLocaleString("en-US")}`);

interface Veri {
  sayim: { comps: number; parseller: number; ilanlar: number };
  degerleme: Record<string, unknown>[];
  rakipler: Record<string, unknown>[];
  teklifler: Record<string, unknown>[];
}

// ── /api/admin/all-deals facet'leri (eski /admin/sistem ekranından taşındı) ──
// Deal sayıları ve eyalet bazlı comp kapsaması buradan gelir; hiçbir rakam
// hard-code değil, veri yoksa "—" yazılır.
type EyaletDetay = {
  state: string; count: number; acres: number; ppa: number | null;
  comps: number; withCompPct: number; absenteePct: number;
};
type DealFacet = {
  totalAll: number;
  byState: Record<string, number>;
  bySource: Record<string, number>;
  sourceLabels: Record<string, string>;
  stats?: { byStateDetail: EyaletDetay[] };
};

function Adim({ no, ikon, baslik, ne, neden, sayi }: {
  no: number; ikon: React.ReactNode; baslik: string; ne: string; neden: string; sayi?: string;
}) {
  return (
    <div className="flex gap-4 border-b border-neutral-200 py-4 last:border-0 dark:border-neutral-800">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
        {no}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-50">
            {ikon}{baslik}
          </span>
          {sayi && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-800">
              {sayi}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{ne}</p>
        <p className="mt-1 text-xs text-neutral-500"><b>Neden:</b> {neden}</p>
      </div>
    </div>
  );
}

export default function YontemSayfasi() {
  const [v, setV] = useState<Veri | null>(null);
  // Deal facet'leri ayrı uçtan gelir; gelmezse ilgili bölümler basitçe gizlenir.
  const [d, setD] = useState<DealFacet | null>(null);
  useEffect(() => {
    fetch("/api/admin/istihbarat").then((r) => r.json()).then(setV).catch(() => {});
    fetch("/api/admin/all-deals?pageSize=1").then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  // Hasat sağlığı, sayfanın geri kalanı yüklenmese bile GÖRÜNMELİ: istihbarat
  // ucu patlarsa "sistem sağlıklı mı?" sorusu cevapsız kalmasın.
  if (!v) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <HasatSagligiKarti />
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      </div>
    );
  }

  const ornek = v.teklifler[0] as Record<string, unknown> | undefined;
  // Liste en büyük 400 ile sınırlı — tam sayım API'den ayrı gelir.
  const yatirimci = (v as { rakipSayim?: { yatirimci: number } }).rakipSayim?.yatirimci
    ?? v.rakipler.filter((r) => r.tip === "arsa_yatirimcisi").length;
  const toplamTeklif = v.teklifler.reduce((a, r) => a + Number(r.lead_n ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl p-6 pb-24">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Yatırım Yöntemi</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Hangi arsayı neden alıyoruz. Her adımın gerekçesi ve o adımın elediği miktar.
      </p>

      {/* ── HASAT SAĞLIĞI ──────────────────────────────────────────────────
          En üstte, çünkü aşağıdaki bütün sayılar hasat gerçekten koştuysa
          anlamlı. /admin/sistem buraya yönlendiği için sistem sağlığının yeri
          burası. Kaynak: scraper/.hasat-durum.json (uydurma yok). */}
      <div className="mt-6" />
      <HasatSagligiKarti />

      {/* ── HUNİ ───────────────────────────────────────────────────────── */}
      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-base font-semibold">Eleme hunisi</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Ucuz testler önce, pahalı testler sonra. Her adım bir öncekinden geçenleri daraltır.
        </p>

        <Adim no={1} ikon={<Filter className="h-4 w-4" />} baslik="Ham havuz"
          sayi={`${say(v.sayim.parseller)} parsel tarandı`}
          ne="Hedef county'lerdeki her boş arsa: sahip adı, posta adresi, alım fiyatı, alım tarihi."
          neden="Rakip listesi tahmin edilmez, veriden keşfedilir. Bu taramada bilmediğimiz oyuncular çıktı." />

        <Adim no={2} ikon={<Ban className="h-4 w-4" />} baslik="Mutlak eleyiciler"
          ne="Yasal erişim (yola cephe ≠ geçiş hakkı), imar minimum lot büyüklüğü, su hakkı, septik uygunluğu, sel/sulak alan, eğim, POA aidat borcu, bölünmüş miras."
          neden="Bunlar puan kırma değil KAPI. Satılamayan arsa fiyatı ne olursa olsun sıfır değerindedir." />

        <Adim no={3} ikon={<Scale className="h-4 w-4" />} baslik="Kanıta dayalı değerleme"
          sayi={`${say(v.sayim.comps)} gerçek satış · ${say(v.degerleme.length)} county yatırıma uygun`}
          ne="Değer, gerçekleşmiş tapu satışlarından gelir. Her county güven kademesi taşır (T1 en güçlü). T3/T4 kademeler yatırım havuzuna GİREMEZ."
          neden="Yatırımın tamamı satış değeri tahminine dayanır. Tahminin güvenini bilmeden pozisyon almak kumardır." />

        <Adim no={4} ikon={<Timer className="h-4 w-4" />} baslik="Likidite"
          ne="County'de bu ürün gerçekten satılıyor mu, ne kadar sürede? İlan takibinden ilanda kalma süresi ve emilim oranı."
          neden="Marj hiçbir şey, hız her şey. %100 getiri 3 yılda gelirse yıllık %26'ya iner ve sermaye 3 yıl kilitlenir." />

        <Adim no={5} ikon={<Calculator className="h-4 w-4" />} baslik="Teklif hesabı"
          sayi={`${say(toplamTeklif)} lead'e fiyat üretildi`}
          ne="Teklif = (piyasa değeri ÷ hedef çarpan) − $2.000 sabit gider. Sabit maliyet küçük işlemde ağır bastığı için çarpan bant bant değişir."
          neden="Sabit teklif her iki yönde de yanlıştır: pahalı county'de gülünç düşük kalır (sahip cevap vermez), ucuz county'de değerin yarısını verir (kâr kalmaz)." />
      </section>

      {/* ── CANLI ÖRNEK ────────────────────────────────────────────────── */}
      {ornek && (
        <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h2 className="text-base font-semibold">Canlı örnek — {String(ornek.county)} · {String(ornek.bant)}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-900">
              <span className="block text-[10px] uppercase tracking-wide text-neutral-500">Piyasa (P25)</span>
              <b className="tabular-nums">{usd(ornek.piyasa_p25)}</b>
            </span>
            <span className="text-neutral-400">÷ {String(ornek.carpan)}x</span>
            <span className="text-neutral-400">− $2.000</span>
            <ArrowRight className="h-4 w-4 text-neutral-400" />
            <span className="rounded-lg bg-emerald-600 px-3 py-2 text-white shadow-sm">
              <span className="block text-[10px] uppercase tracking-wide opacity-80">Teklifimiz</span>
              <b className="tabular-nums">{usd(ornek.teklif)}</b>
            </span>
            <span className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-900">
              <span className="block text-[10px] uppercase tracking-wide text-neutral-500">Dayanak</span>
              <b className="tabular-nums">{say(ornek.comp_n)}</b> gerçek satış
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            Bu county×bantta <b>{say(ornek.lead_n)}</b> lead var ve hepsine bu formülle fiyat üretildi.
          </p>
        </section>
      )}

      {/* ── VERİ KAYNAKLARI (eski /admin/sistem'den taşındı) ───────────── */}
      <Bolum
        ikon={<Database className="h-4 w-4" />}
        baslik="Veri kaynakları — “bu liste nereden geliyor?”"
        alt="Her satırın kökeni belli: resmî ya da halka açık kayıt. Uydurma yok."
      >
        <Tablo basliklar={["Kaynak", "Ne sağlar", "Köken", "Adet"]} sag={[3]}>
          <KaynakSatiri
            k="Mohave Off-Market" v="Boş parsel, sahip + posta adresi, değer"
            o="Mohave County ParcelQueryLayer (ArcGIS, halka açık)" n={d?.bySource?.mohave}
          />
          <KaynakSatiri
            k="Gerçek Dealler (Dallas)" v="Vergi-borçlu lotlar, spread"
            o="Dallas CAD (DCAD) + Regrid" n={d?.bySource?.dallas}
          />
          <KaynakSatiri
            k="Ucuz Boş Arsa" v="Çoklu eyalet, skorlu fırsat"
            o="Tax-deed listeleri + Regrid değerleme" n={d?.bySource?.["cheap-land"]}
          />
          <KaynakSatiri
            k="PropStream — Luna NM" v="Absentee + boş arazi"
            o="PropStream export (NM Luna County)" n={d?.bySource?.["propstream-nm"]}
          />
        </Tablo>
        <p className="mt-2 text-xs text-neutral-500">
          Zenginleştirme: <b>Regrid</b> (parsel / sahip / kullanım) — değerleme eyaletten bağımsız.
          {d && <> Sistemdeki toplam deal: <b className="tabular-nums">{say(d.totalAll)}</b>.</>}
        </p>
      </Bolum>

      {/* ── COMP KAPSAMA (eski /admin/sistem'den taşındı) ───────────────── */}
      {d?.stats?.byStateDetail && d.stats.byStateDetail.length > 0 && (
        <Bolum
          ikon={<Scale className="h-4 w-4" />}
          baslik="Comp kapsama — “bu değer ne kadar güvenilir?”"
          alt="Hangi eyalette kaç gerçek comp var, $/acre medyanı ne. Kapsama düşükse değer üretilmez, 'comp gerekli' denir."
        >
          <Tablo basliklar={["Eyalet", "Deal", "Comp $/acre", "Comp adedi", "Kapsama"]} sag={[1, 2, 3, 4]}>
            {d.stats.byStateDetail.slice(0, 12).map((s) => (
              <tr key={s.state}>
                <td className="px-4 py-2 font-bold text-neutral-800 dark:text-neutral-100">{s.state}</td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {say(s.count)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-800 dark:text-neutral-200">
                  {s.ppa ? usd(s.ppa) : <span className="text-xs text-amber-600">comp gerekli</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-500">{s.comps || "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <span className={s.withCompPct >= 50 ? "text-emerald-600" : "text-amber-600"}>
                    %{s.withCompPct}
                  </span>
                </td>
              </tr>
            ))}
          </Tablo>
          <p className="mt-2 text-xs text-neutral-500">
            Kaynak: rakip ilan medyanı (asking comp). Sold comp / county düzeyi için daha çok comp
            taraması ya da ATTOM gerekir. Düşük kapsama = o eyalette finalisti elle doğrula.
          </p>
        </Bolum>
      )}

      {/* ── SCRUB KRİTERLERİ (eski /admin/sistem'den taşındı) ───────────── */}
      <Bolum
        ikon={<ShieldCheck className="h-4 w-4" />}
        baslik="Scrub kriterleri — “bu arsa neden iyi/kötü?”"
        alt="Hunideki 2. adımın (mutlak eleyiciler) parsel bazında uygulanan hali."
      >
        <Tablo basliklar={["Faktör", "Ne bakar", "Kırmızı çizgi", "Kaynak"]}>
          <ScrubSatiri f="🌊 Sel riski" b="FEMA flood zone" c="Zone A/V = ELE" k="FEMA NFHL (gerçek API)" />
          <ScrubSatiri f="🛣️ Yol erişimi" b="En yakın yola mesafe" c="Landlocked = ELE" k="OpenStreetMap (gerçek API)" />
          <ScrubSatiri f="📐 Boyut" b="Parsel acre'ı" c="0,2–1,5 acre bandı" k="Parsel verisi" />
          <ScrubSatiri f="👤 Sahip" b="Posta eyaleti ≠ arsa eyaleti" c="Absentee = hedef" k="Posta adresi" />
          <ScrubSatiri f="🏷️ Kullanım" b="Boş arazi mi" c="Vacant olmalı" k="County use code" />
          <ScrubSatiri f="💵 Değerleme" b="Comp dayanağı + teklif" c="Comp yoksa teklif yok" k="Gerçekleşmiş tapu satışları" />
        </Tablo>
        <p className="mt-2 text-xs text-neutral-500">
          “Tüm Dealler” ekranında her satırdaki <b>🛡️ Scrub</b> butonu bu raporu A–F notu +
          AL / İNCELE / ELE kararıyla canlı üretir.
        </p>
      </Bolum>

      {/* ── EYALET STRATEJİSİ (eski /admin/sistem'den taşındı) ──────────── */}
      <Bolum
        ikon={<MapIcon className="h-4 w-4" />}
        baslik="Eyalet stratejisi — “neden bu eyaletler?”"
        alt="Ucuz $/acre + kolay bölünme + gevşek düzenleme. (Kaynak: eyalet mevzuatı + county GIS.)"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <KademeKarti
            kademe="Kademe 1 — ilk hedef" ton="emerald"
            satirlar={[["New Mexico", "~$725/acre · en ucuz"], ["Texas", "Hudspeth $200–500/acre"], ["Arizona", "Mohave / Cochise · çöl lot"]]}
          />
          <KademeKarti
            kademe="Kademe 2 — çok iyi" ton="sky"
            satirlar={[["Nevada", "~$1.230/acre"], ["Wyoming", "~$1.000 · gelir vergisi yok"], ["Arkansas / Oklahoma", "~$2.5K · düz, yeşil"]]}
          />
          <KademeKarti
            kademe="Kaçınılan" ton="rose"
            satirlar={[["California", "$12K+ · bürokrasi"], ["New York", "5-5-3 kuralı"], ["NJ / MA / PA", "pahalı, sıkı imar"]]}
          />
        </div>
      </Bolum>

      {/* ── RAKİP KIYASLAMASI (eski /admin/sistem'den taşındı) ──────────── */}
      <Bolum
        ikon={<Building2 className="h-4 w-4" />}
        baslik="Rakip kıyaslaması — “bunu kim yapıyor?”"
        alt="Modelin çalıştığının dış kanıtı ve her birinden aldığımız ders."
      >
        <Tablo basliklar={["Rakip", "Model", "Bizim aldığımız ders"]}>
          <RakipSatiri r="Discount Lots" m="~1.500 deal/yıl, off-market al-sat" d="Ölçek kanıtı = hedef model" />
          <RakipSatiri r="Compass Land USA" m="2–10 kişi, 0,16–1,16 acre, %7,9 / 60 ay" d="Yalın başlangıç şablonu" />
          <RakipSatiri r="LANDiO" m="NM / CO / AZ, BLM komşusu, YouTube" d="Kademeli faiz + pazarlama" />
          <RakipSatiri r="Land Insights" m="AI scrub + 5 dk değerleme ($5K/yıl)" d="Scrub motorumuzun doğrudan rakibi" />
          <RakipSatiri r="PropStream" m="160M kayıt, filtre + skip + mail ($99/ay)" d="“Tüm Dealler” ekranı bunun yerini tutuyor" />
        </Tablo>
      </Bolum>

      {/* ── DÜRÜSTLÜK FRENLERİ ─────────────────────────────────────────── */}
      <section className="mt-5 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" /> Neyi tahmin ETMİYORUZ
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-neutral-500">
          Sistemin değeri, ürettiği sayı kadar reddettiği sayıdan da gelir.
        </p>
        <ul className="space-y-2 text-sm">
          {[
            ["Yeterli gerçek satışı olmayan county'ye değer atanmaz", "Uydurma sabit yerine 'karar verilemez' denir."],
            ["Örneklem az veya veri tutarsızsa county karantinaya alınır", "Şehir içi pazarların comp'ları kırsal envanterle kıyaslanamaz."],
            ["Bant medyanı parselin kendi değeriyle çelişirse teklif üretilmez", "Sahil lotu comp'u karışınca çeyrek dönüme altı haneli teklif çıkıyordu."],
            ["1,5 dönüm üstünde teklif verilmez", "O bantta geliştiriciler prim ödüyor; inşaat marjı olmayan biri yarışamaz."],
            ["Rakip ilanının kaybolması 'satıldı' sayılmaz", "Satış şüphesidir; kesinlik tapu doğrulaması ister."],
          ].map(([ne, neden], i) => (
            <li key={i} className="flex gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <span><b className="font-medium">{ne}</b> <span className="text-neutral-500">— {neden}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── SERMAYE PLANI ──────────────────────────────────────────────── */}
      <section className="mt-5 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Layers className="h-4 w-4" /> Sermaye nasıl yerleşir
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-neutral-500">
          Değerleme modeli henüz gerçek bir alım-satımla doğrulanmadı. Bu yüzden kademeli.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { f: "Faz 1 · Pilot", t: "3-5 parsel", a: "Amaç kâr değil, model doğrulama: gerçekte kaça sattık, kaç ayda, gizli maliyet neydi?" },
            { f: "Faz 2 · Kalibrasyon", t: "Pilot sonuçlarıyla", a: "Satış değeri sistematik sapıyorsa modele kalıcı düzeltme girilir." },
            { f: "Faz 3 · Ölçek", t: "Doğrulanmış modelle", a: "Yoğunlaşma limiti: tek county'ye sermayenin dörtte birinden fazlası girmez." },
          ].map((x, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-50">{x.f}</div>
              <div className="mt-0.5 text-[11px] font-medium text-emerald-700">{x.t}</div>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{x.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          Modelin yanlış olduğunu pilotta öğrenmek, tüm sermayeyi yerleştirdikten sonra öğrenmekten
          kıyaslanamayacak kadar ucuzdur. Bu metodun tek başına en değerli çıktısı budur.
        </p>
      </section>

      <p className="mt-6 text-xs text-neutral-500">
        Rekabet bağlamı: taramada <b>{say(yatirimci)}</b> arsa yatırımcısı tespit edildi; ayrıca ev
        üreticileri aynı lotlara talip ve inşaat marjını da kaptıkları için daha fazla ödeyebiliyor.
        Detay: <b>Pazar İstihbaratı</b> ekranı.
      </p>
    </div>
  );
}

/* ── Eski /admin/sistem ekranından taşınan bölümlerin yardımcıları ───────────
   Hepsi yontem'in nötr paleti + koyu tema (dark:) ile yeniden yazıldı.        */

function Bolum({ ikon, baslik, alt, children }: {
  ikon: React.ReactNode; baslik: string; alt: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">
        {ikon} {baslik}
      </h2>
      <p className="mb-3 mt-0.5 text-xs text-neutral-500">{alt}</p>
      {children}
    </section>
  );
}

/** Ortak tablo kabuğu. `sag` = sağa hizalanacak sütun indeksleri. */
function Tablo({ basliklar, sag = [], children }: {
  basliklar: string[]; sag?: number[]; children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-800/60">
          <tr>
            {basliklar.map((b, i) => (
              <th key={b} className={`px-4 py-2 font-semibold ${sag.includes(i) ? "text-right" : ""}`}>
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">{children}</tbody>
      </table>
    </div>
  );
}

function KaynakSatiri({ k, v, o, n }: { k: string; v: string; o: string; n?: number }) {
  return (
    <tr>
      <td className="px-4 py-2 font-semibold text-neutral-800 dark:text-neutral-100">{k}</td>
      <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{v}</td>
      <td className="px-4 py-2 text-xs text-neutral-500">{o}</td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
        {n != null ? say(n) : "—"}
      </td>
    </tr>
  );
}

function ScrubSatiri({ f, b, c, k }: { f: string; b: string; c: string; k: string }) {
  return (
    <tr>
      <td className="px-4 py-2 font-semibold text-neutral-800 dark:text-neutral-100">{f}</td>
      <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{b}</td>
      <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{c}</td>
      <td className="px-4 py-2 text-xs text-neutral-500">{k}</td>
    </tr>
  );
}

function RakipSatiri({ r, m, d }: { r: string; m: string; d: string }) {
  return (
    <tr>
      <td className="px-4 py-2 font-semibold text-neutral-800 dark:text-neutral-100">{r}</td>
      <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{m}</td>
      <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{d}</td>
    </tr>
  );
}

function KademeKarti({ kademe, ton, satirlar }: {
  kademe: string; ton: "emerald" | "sky" | "rose"; satirlar: [string, string][];
}) {
  const cerceve =
    ton === "emerald" ? "border-emerald-200 dark:border-emerald-900"
      : ton === "sky" ? "border-sky-200 dark:border-sky-900"
        : "border-rose-200 dark:border-rose-900";
  const baslikRengi =
    ton === "emerald" ? "text-emerald-700 dark:text-emerald-400"
      : ton === "sky" ? "text-sky-700 dark:text-sky-400"
        : "text-rose-700 dark:text-rose-400";
  return (
    <div className={`rounded-lg border ${cerceve} p-3`}>
      <div className={`mb-2 text-xs font-bold uppercase tracking-wide ${baslikRengi}`}>{kademe}</div>
      <ul className="space-y-1.5 text-sm">
        {satirlar.map(([a, b]) => (
          <li key={a}>
            <span className="font-semibold text-neutral-800 dark:text-neutral-100">{a}</span>{" "}
            <span className="text-neutral-500">— {b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
