"use client";

import React, { useEffect, useState } from "react";
import {
  Database, Building2, Users, Radar, Loader2, AlertCircle,
  TrendingUp, MapPin, Network, Tag,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// PAZAR İSTİHBARATI — 2026-07-26'da kurulan veri katmanının vitrini.
//
// Dört kaynak tek ekranda:
//   1. county_valuation  → GERÇEK tapu satışlarından türetilmiş değerleme
//   2. offmarket_leads   → piyasa değerinden geriye hesaplanan teklifler
//   3. competitor_profile→ veriden KEŞFEDİLEN rakipler (tahmin değil)
//   4. competitor_intel  → rakip ilanlarının DOM / satış şüphesi takibi
//
// Dürüstlük kuralı: hiçbir sayı "tahmin" olarak süslenmez; kaynağı ve
// örneklem büyüklüğü ekranda yazar. Veri yoksa blok "veri yok" der.
// ─────────────────────────────────────────────────────────────────────────────

const usd = (n: unknown) =>
  n == null ? "—" : `$${Math.round(Number(n)).toLocaleString("en-US")}`;
const say = (n: unknown) =>
  n == null ? "—" : Number(n).toLocaleString("tr-TR");

const FL_ADI: Record<number, string> = {
  11: "Alachua", 12: "Baker", 13: "Bay", 14: "Bradford", 15: "Brevard", 16: "Broward",
  17: "Calhoun", 18: "Charlotte", 19: "Citrus", 20: "Clay", 21: "Collier", 22: "Columbia",
  23: "Miami-Dade", 24: "DeSoto", 25: "Dixie", 26: "Duval", 27: "Escambia", 28: "Flagler",
  29: "Franklin", 30: "Gadsden", 31: "Gilchrist", 32: "Glades", 33: "Gulf", 34: "Hamilton",
  35: "Hardee", 36: "Hendry", 37: "Hernando", 38: "Highlands", 39: "Hillsborough", 40: "Holmes",
  41: "Indian River", 42: "Jackson", 43: "Jefferson", 44: "Lafayette", 45: "Lake", 46: "Lee",
  47: "Leon", 48: "Levy", 49: "Liberty", 50: "Madison", 51: "Manatee", 52: "Marion",
  53: "Martin", 54: "Monroe", 55: "Nassau", 56: "Okaloosa", 57: "Okeechobee", 58: "Orange",
  59: "Osceola", 60: "Palm Beach", 61: "Pasco", 62: "Pinellas", 63: "Polk", 64: "Putnam",
  65: "St. Johns", 66: "St. Lucie", 67: "Santa Rosa", 68: "Sarasota", 69: "Seminole",
  70: "Sumter", 71: "Suwannee", 72: "Taylor", 73: "Union", 74: "Volusia", 75: "Wakulla",
  76: "Walton", 77: "Washington",
};
function countyAdi(state: unknown, key: unknown) {
  const raw = String(key ?? "").replace(/^[A-Z]{2}:/, "");
  if (state === "FL") {
    const n = Number(raw);
    return FL_ADI[n] ?? raw;
  }
  return raw;
}

interface Veri {
  sayim: { comps: number; parseller: number; ilanlar: number };
  rakipSayim?: { yatirimci: number; uretici: number };
  degerleme: Record<string, unknown>[];
  rakipler: Record<string, unknown>[];
  aileler: Record<string, unknown>[];
  teklifler: Record<string, unknown>[];
  radar: Record<string, unknown>[];
}

function Kart({ ikon, etiket, deger, alt }: {
  ikon: React.ReactNode; etiket: string; deger: string; alt?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {ikon}{etiket}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{deger}</div>
      {alt && <div className="mt-0.5 text-xs text-neutral-500">{alt}</div>}
    </div>
  );
}

function Bolum({ baslik, aciklama, children }: {
  baslik: string; aciklama: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{baslik}</h2>
      <p className="mb-3 mt-0.5 text-xs text-neutral-500">{aciklama}</p>
      {children}
    </section>
  );
}

const th = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500 border-b border-neutral-300 dark:border-neutral-700";
const td = "px-3 py-1.5 text-sm border-b border-neutral-100 dark:border-neutral-800";
const tdR = `${td} text-right tabular-nums`;

export default function IstihbaratSayfasi() {
  const [veri, setVeri] = useState<Veri | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/istihbarat")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setVeri)
      .catch((e) => setHata(String(e.message)));
  }, []);

  if (hata) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" /> Veri alınamadı: {hata}
        </div>
      </div>
    );
  }
  if (!veri) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> İstihbarat yükleniyor…
      </div>
    );
  }

  const yatirimcilar = veri.rakipler.filter((r) => r.tip === "arsa_yatirimcisi");
  const ureticiler = veri.rakipler.filter((r) => r.tip === "uretici");

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Pazar İstihbaratı</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Gerçek tapu satışlarından türetilmiş değerleme, veriden keşfedilen rakip haritası ve
        piyasa değerinden hesaplanan teklifler.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kart ikon={<Database className="h-3.5 w-3.5" />} etiket="Gerçek satış (comp)"
          deger={say(veri.sayim.comps)} alt="tapu kayıtlarından" />
        <Kart ikon={<MapPin className="h-3.5 w-3.5" />} etiket="Yatırıma uygun county"
          deger={say(veri.degerleme.length)} alt="T1/T2 güven kademesi" />
        <Kart ikon={<Building2 className="h-3.5 w-3.5" />} etiket="Taranan boş parsel"
          deger={say(veri.sayim.parseller)} alt="sahip + alım fiyatıyla" />
        <Kart ikon={<Users className="h-3.5 w-3.5" />} etiket="Arsa yatırımcısı rakip"
          deger={say(veri.rakipSayim?.yatirimci ?? yatirimcilar.length)}
          alt={`+ ${say(veri.rakipSayim?.uretici ?? ureticiler.length)} ev üreticisi`} />
      </div>

      <Bolum baslik="County değerlemesi"
        aciklama="Gerçekleşmiş boş arsa satışlarından (Florida). P25 muhafazakâr taraftır; örneklem sayısı her satırda yazılı — az örneklemli county'ye güvenme. Colorado comp'ları toplandı ancak envanterimizin olduğu county'ler kapsam dışı olduğu için tabloya girmiyor.">
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px]">
            <thead><tr>
              <th className={th}>County</th><th className={`${th} text-right`}>Satış adedi</th>
              <th className={`${th} text-right`}>P25 $/dönüm</th><th className={`${th} text-right`}>Medyan $/dönüm</th>
              <th className={`${th} text-right`}>Medyan satış</th><th className={th}>Kademe</th>
            </tr></thead>
            <tbody>
              {veri.degerleme.slice(0, 20).map((r, i) => (
                <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <td className={td}>{countyAdi(r.state, r.county_key)} <span className="text-neutral-400">{String(r.state)}</span></td>
                  <td className={tdR}>{say(r.n_used)}</td>
                  <td className={tdR}>{usd(r.p25_ppa)}</td>
                  <td className={tdR}>{usd(r.med_ppa)}</td>
                  <td className={tdR}>{usd(r.med_sale)}</td>
                  <td className={td}><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">{String(r.tier)}</span></td>
                </tr>
              ))}
              {!veri.degerleme.length && <tr><td className={td} colSpan={6}>Veri yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </Bolum>

      <Bolum baslik="Teklif motoru"
        aciklama="Teklif = (piyasa P25 ÷ hedef çarpan) − $2.000 sabit gider. Eskiden her yerde sabit $1.200'dü.">
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[520px]">
            <thead><tr>
              <th className={th}>County</th><th className={th}>Dönüm bandı</th>
              <th className={`${th} text-right`}>Lead</th><th className={`${th} text-right`}>Comp</th>
              <th className={`${th} text-right`}>Piyasa P25</th><th className={`${th} text-right`}>Teklif</th>
              <th className={`${th} text-right`}>Çarpan</th>
            </tr></thead>
            <tbody>
              {veri.teklifler.map((r, i) => (
                <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <td className={td}>{String(r.county)}</td>
                  <td className={`${td} text-neutral-500`}>{String(r.bant)}</td>
                  <td className={tdR}>{say(r.lead_n)}</td>
                  <td className={tdR}>{say(r.comp_n)}</td>
                  <td className={tdR}>{usd(r.piyasa_p25)}</td>
                  <td className={`${tdR} font-semibold text-emerald-700`}>{usd(r.teklif)}</td>
                  <td className={tdR}>{String(r.carpan)}x</td>
                </tr>
              ))}
              {!veri.teklifler.length && <tr><td className={td} colSpan={7}>Veri yok — scraper/teklif-motoru.mjs çalıştır.</td></tr>}
            </tbody>
          </table>
        </div>
      </Bolum>

      <Bolum baslik="Rakipler — arsa yatırımcıları"
        aciklama="İsim tahmin edilmedi; boş parsel sahipleri gruplanarak VERİDEN keşfedildi. Alım fiyatları Florida DOR'un kol-satışı kalite kodundan süzülmüştür.">
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[760px]">
            <thead><tr>
              <th className={th}>Şirket</th><th className={`${th} text-right`}>Parsel</th>
              <th className={`${th} text-right`}>County</th><th className={`${th} text-right`}>Nitelikli alım</th>
              <th className={`${th} text-right`}>Medyan alım</th><th className={`${th} text-right`}>$/dönüm</th>
              <th className={th}>Merkez</th>
            </tr></thead>
            <tbody>
              {yatirimcilar.slice(0, 25).map((r, i) => (
                <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <td className={`${td} font-medium`}>{String(r.owner)}</td>
                  <td className={tdR}>{say(r.parsel)}</td>
                  <td className={tdR}>{say(r.county_n)}</td>
                  <td className={tdR}>{say(r.nitelikli_alim)}</td>
                  <td className={tdR}>{usd(r.med_alim)}</td>
                  <td className={tdR}>{usd(r.med_ppa)}</td>
                  <td className={`${td} text-xs text-neutral-500`}>{String(r.owner_city ?? "")}, {String(r.owner_state ?? "")}</td>
                </tr>
              ))}
              {!yatirimcilar.length && <tr><td className={td} colSpan={7}>Veri yok — scraper/rakip-derin-analiz.mjs --write çalıştır.</td></tr>}
            </tbody>
          </table>
        </div>
      </Bolum>

      <Bolum baslik="Şirket aileleri"
        aciklama="Aynı posta adresini paylaşan farklı LLC'ler = tek operatörün ağı. Rakibin gerçek büyüklüğü tek şirkete bakarak anlaşılmaz.">
        <div className="space-y-2">
          {veri.aileler.slice(0, 10).map((g, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex items-baseline gap-3">
                <Network className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="font-semibold tabular-nums">{say(g.parsel)} parsel</span>
                <span className="text-xs text-neutral-500">{say(g.sirket_n)} şirket</span>
                <span className="text-xs text-neutral-400">{String(g.addr)}</span>
              </div>
              <div className="mt-1 pl-7 text-xs text-neutral-600 dark:text-neutral-400">{String(g.sirketler)}</div>
            </div>
          ))}
          {!veri.aileler.length && <div className="text-sm text-neutral-500">Veri yok.</div>}
        </div>
      </Bolum>

      <Bolum baslik="İlan radarı"
        aciklama='Günlük snapshot farkından. "Gitti" satış DEĞİL satış ŞÜPHESİDİR — kesinlik tapu doğrulaması ister. Geçmiş 23 günlük olduğu için DOM olduğundan kısa görünür.'>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[520px]">
            <thead><tr>
              <th className={th}>Rakip</th><th className={`${th} text-right`}>Aktif ilan</th>
              <th className={`${th} text-right`}>Gitti (şüphe)</th><th className={`${th} text-right`}>Medyan DOM</th>
              <th className={`${th} text-right`}>Fiyat değiştiren</th>
            </tr></thead>
            <tbody>
              {veri.radar.map((r, i) => (
                <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <td className={`${td} font-medium`}>{String(r.competitor)}</td>
                  <td className={tdR}>{say(r.aktif)}</td>
                  <td className={tdR}>{say(r.gitti)}</td>
                  <td className={tdR}>{r.med_dom == null ? "—" : `${say(r.med_dom)} gün`}</td>
                  <td className={tdR}>{say(r.fiyat_degisen)}</td>
                </tr>
              ))}
              {!veri.radar.length && <tr><td className={td} colSpan={5}>Veri yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </Bolum>

      <p className="mt-8 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Kaynaklar: Florida DOR eyalet kadastrosu (satış fiyatı + kol-satışı kalite kodu),
        Colorado Public Parcels, county assessor açık verileri, günlük rakip ilan taraması.
        Değerlemeler gerçekleşmiş satışlara dayanır; tahmin edilen hiçbir değer yatırım
        kararına girmez (T3/T4 kademeler havuz dışıdır).
      </p>
    </div>
  );
}
