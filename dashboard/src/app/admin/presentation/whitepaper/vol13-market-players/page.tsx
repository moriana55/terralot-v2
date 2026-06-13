"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Building2, Globe, TrendingUp, ShieldCheck, AlertCircle, CheckCircle2, Zap, MapPin, BarChart3 } from "lucide-react";
import Link from "next/link";

const companies = [
  {
    name: "LANDiO (HelloLandio)",
    founded: "2014",
    model: "Kendi Envanterini Satan Platform + İlan Pazarı",
    states: ["CO", "TX", "NM", "WY", "FL", "TN", "CA", "OR", "WA", "AZ", "UT", "MI", "OH", "GA", "NC", "MO", "NY", "ME"],
    stateCount: 18,
    avgTicket: "$3,500 – $25,000",
    downPayment: "%10–15 peşinat",
    apr: "%0–9.9 (vadeye göre)",
    contractType: "Contract for Deed",
    strength: "Güçlü SEO + çok eyaletli portföy + 10 yıllık marka güveni",
    weakness: "CA, OR gibi eyaletlerde Deed of Trust'a geçmek zorunda → ekstra maliyet",
    revenueModel: ["Arsa Arbitrajı (alım × 3–8 kâr)", "Taksit faiz geliri (%0–9.9 APR)", "Temerrüt → tekrar satış (yalnızca TX/NM/TN/WY gibi uygun eyaletlerde)"],
    color: "border-blue-300 bg-blue-50",
    badge: "Pazar Lideri",
    badgeColor: "bg-blue-100 text-blue-800",
  },
  {
    name: "LandZero (Riverbank Land Group LLC)",
    founded: "2015 tahmini",
    model: "Direkt Satıcı — Mikro-Arsa Uzmanı",
    states: ["FL", "TX", "NC", "GA", "TN", "AL", "SC"],
    stateCount: 7,
    avgTicket: "$5,000 – $15,000",
    downPayment: "$499 – $999",
    apr: "%1.0–7.5 (1–6 yıl vadeli kademeli)",
    contractType: "Contract for Deed",
    strength: "Çok düşük giriş bariyeri ($499 peşinat), mikro-arsa abonelik psikolojisi",
    weakness: "Sınırlı eyalet, büyük arsa segmentine giremiyor",
    revenueModel: ["Düşük maliyetli mikro-arsa × yüksek marjlı satış", "Kademeli APR geliri", "Yüksek temerrüt oranından tekrar satış"],
    color: "border-emerald-300 bg-emerald-50",
    badge: "Mikro-Arsa Uzmanı",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    name: "Discount Lots",
    founded: "2010 tahmini",
    model: "Pazar Yeri + Kendi Envanteri",
    states: ["TX", "NM", "AZ", "FL", "TN", "KY", "MO", "AR", "OK"],
    stateCount: 9,
    avgTicket: "$2,000 – $12,000",
    downPayment: "%5–10",
    apr: "%0–12",
    contractType: "Contract for Deed / Quitclaim",
    strength: "Çok düşük fiyat segmenti, geniş alıcı kitlesi",
    weakness: "Kalite kontrolü düşük, müşteri şikayeti fazla (Trustpilot 2.8/5)",
    revenueModel: ["Toplu ucuz arsa alımı → perakende satış", "Faiz geliri", "Temerrüt → tekrar satış (sadece Contract for Deed eyaletlerinde, CA/OR/WA'da Deed of Trust + Trustee şirketi gerekir)"],
    color: "border-slate-300 bg-slate-50",
    badge: "Bütçe Segmenti",
    badgeColor: "bg-slate-100 text-slate-700",
  },
  {
    name: "Elegment Land",
    founded: "2018",
    model: "Premium Arsa — Direkt Satıcı",
    states: ["WA", "OR", "ID", "MT", "WY", "CO"],
    stateCount: 6,
    avgTicket: "$15,000 – $80,000",
    downPayment: "%15–20",
    apr: "%6–10",
    contractType: "Deed of Trust (ipotek + Trustee)",
    strength: "Premium segment, doğal arazi odaklı, yüksek bilet fiyatı",
    weakness: "Deed of Trust maliyeti ($1,500–2,500/dosya), daha az müşteri",
    revenueModel: ["Yüksek ticket fiyatından büyük spread", "Düzenli taksit + yüksek APR geliri"],
    color: "border-purple-300 bg-purple-50",
    badge: "Premium Segment",
    badgeColor: "bg-purple-100 text-purple-800",
  },
  {
    name: "Bruner Land Company",
    founded: "2005",
    model: "Bölgesel Aile Şirketi — Güneydoğu Uzmanı",
    states: ["AL", "MS", "TN", "GA", "FL"],
    stateCount: 5,
    avgTicket: "$8,000 – $40,000",
    downPayment: "%10",
    apr: "%8–10",
    contractType: "Contract for Deed + Warranty Deed",
    strength: "15+ yıl güven, lokal ilişki ağı, düşük operasyon maliyeti",
    weakness: "Tek bölge odaklı, ölçeklenemiyor",
    revenueModel: ["Uzun vadeli yüksek APR geliri", "Lokal düşük alım maliyeti"],
    color: "border-amber-300 bg-amber-50",
    badge: "Bölgesel Oyuncu",
    badgeColor: "bg-amber-100 text-amber-800",
  },
];

const stateEligibility = [
  { state: "Texas", code: "TX", eligible: true, method: "Contract for Deed", note: "En uygun eyalet. Hızlı & ucuz fesih." },
  { state: "New Mexico", code: "NM", eligible: true, method: "Contract for Deed", note: "NMSA §47 muafiyeti — 5 dönüm altı serbest." },
  { state: "Tennessee", code: "TN", eligible: true, method: "Contract for Deed", note: "Kısıtlama yok, ucuz vergi, hızlı tahliye." },
  { state: "Florida", code: "FL", eligible: true, method: "Contract for Deed", note: "Mikro-arsa için ideal, düşük vergi." },
  { state: "Wyoming", code: "WY", eligible: true, method: "Contract for Deed", note: "Sıfır gelir vergisi, Wyoming LLC ideal yapı." },
  { state: "Colorado", code: "CO", eligible: "Kısmen", method: "Deed of Trust", note: "5+ parsel satışta platting zorunlu. Trustee gerekir." },
  { state: "Arizona", code: "AZ", eligible: "Kısmen", method: "Deed of Trust", note: "6+ parsel satışta izin gerekli." },
  { state: "California", code: "CA", eligible: false, method: "Deed of Trust zorunlu", note: "Güçlü tüketici yasaları. Trustee maliyeti yüksek." },
  { state: "Oregon", code: "OR", eligible: false, method: "Deed of Trust zorunlu", note: "Contract for Deed alıcı lehine çok güçlü. Riskli." },
  { state: "Washington", code: "WA", eligible: false, method: "Deed of Trust zorunlu", note: "Ayrıntılı imar ve bölünme yasaları. Engelli." },
];

export default function Vol13Page() {
  const reportRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> PDF Olarak Kaydet
        </button>
      </div>

      <div ref={reportRef} className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="border-b-4 border-slate-900 pb-6 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 13</p>
          <h1 className="text-3xl font-black text-slate-900">Piyasa Oyuncuları & Eyalet Uygunluk Haritası</h1>
          <p className="text-sm text-slate-600 mt-2">Bu sistemi uygulayan firmalar, kazanç modelleri ve hangi eyaletlerde çalışılabileceği</p>
        </div>

        <div className="space-y-12 text-sm text-slate-700 leading-relaxed">

          {/* Giriş */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 flex items-center gap-2">
              <Globe className="w-5 h-5" /> Piyasa Gerçeği: Bu Sistemi Kim Yapıyor?
            </h2>
            <p>
              ABD'de taksitli ham arsa satışı (owner financing + contract for deed) modeli <strong>2010'lardan bu yana hızla büyüyen</strong> bir niş sektördür. Geleneksel bankalar küçük ham arsa parsellerine mortgage vermez — bu boşluk tamamen özel satıcı firmalara kalmıştır. Aşağıda bu modeli uygulayan <strong>5 ana oyuncu</strong> detaylı karşılaştırmalı olarak incelenmiştir.
            </p>
          </div>

          {/* Firmalar */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-blue-600 pl-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-700" /> Ana Piyasa Oyuncuları — Karşılaştırmalı Analiz
            </h2>

            {companies.map((c, i) => (
              <div key={i} className={`border rounded-2xl p-5 space-y-4 ${c.color}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-slate-900 text-base">{c.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badgeColor}`}>{c.badge}</span>
                    </div>
                    <p className="text-xs text-slate-500">Kuruluş: {c.founded} &nbsp;|&nbsp; Model: {c.model}</p>
                  </div>
                  <div className="text-right text-xs text-slate-600 shrink-0">
                    <span className="font-bold text-slate-900 block">{c.stateCount} Eyalet</span>
                    <span className="text-[10px]">{c.states.slice(0, 5).join(", ")}{c.states.length > 5 ? " +" + (c.states.length - 5) : ""}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white/70 rounded-xl p-3">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wide mb-1">Ortalama Bilet</span>
                    <span className="font-bold text-slate-900">{c.avgTicket}</span>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wide mb-1">Peşinat</span>
                    <span className="font-bold text-slate-900">{c.downPayment}</span>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wide mb-1">Faiz (APR)</span>
                    <span className="font-bold text-slate-900">{c.apr}</span>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wide mb-1">Sözleşme Tipi</span>
                    <span className="font-bold text-slate-900">{c.contractType}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/60 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide block">✓ Güçlü Yanları</span>
                    <p className="text-slate-700">{c.strength}</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wide block">✗ Zayıf Yanları</span>
                    <p className="text-slate-700">{c.weakness}</p>
                  </div>
                </div>

                <div className="bg-white/60 rounded-xl p-3 space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide block">💰 Gelir Modeli</span>
                  <ul className="space-y-0.5">
                    {c.revenueModel.map((r, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-slate-700">
                        <span className="text-blue-500 mt-0.5">→</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Eyalet Uygunluk Tablosu */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-emerald-600 pl-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-700" /> Eyalet Uygunluk Haritası — Contract for Deed Çalışır mı?
            </h2>

            <div className="space-y-2">
              {stateEligibility.map((s, i) => (
                <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border text-xs ${
                  s.eligible === true ? "bg-emerald-50 border-emerald-200" :
                  s.eligible === "Kısmen" ? "bg-amber-50 border-amber-200" :
                  "bg-red-50 border-red-200"
                }`}>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg w-10 text-center ${
                    s.eligible === true ? "bg-emerald-700 text-white" :
                    s.eligible === "Kısmen" ? "bg-amber-600 text-white" :
                    "bg-red-700 text-white"
                  }`}>{s.code}</span>
                  <span className="font-bold text-slate-900 w-32">{s.state}</span>
                  <span className={`font-bold w-20 ${
                    s.eligible === true ? "text-emerald-700" :
                    s.eligible === "Kısmen" ? "text-amber-700" :
                    "text-red-700"
                  }`}>
                    {s.eligible === true ? "✅ Uygun" : s.eligible === "Kısmen" ? "⚠️ Kısmen" : "❌ Riskli"}
                  </span>
                  <span className="text-slate-500 w-40 shrink-0">{s.method}</span>
                  <span className="text-slate-600 flex-1">{s.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Neden Her Eyalette Değil */}
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-700" />
              Neden Her Eyalette Bu Sistemi Yapamazsın?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white border border-amber-100 rounded-xl p-4 space-y-2">
                <span className="font-bold text-amber-800 block">1. Tüketici Koruma Yasaları</span>
                <p className="text-slate-600">California ve Oregon'da alıcı varsayılan olarak güçlü korunur. Contract for Deed'de bile tahliye için mahkeme kararı gerekir — bu süreç 12–18 aya uzar.</p>
              </div>
              <div className="bg-white border border-amber-100 rounded-xl p-4 space-y-2">
                <span className="font-bold text-amber-800 block">2. Bölünme (Platting) Yasaları</span>
                <p className="text-slate-600">Colorado ve Arizona'da 5+ parsel satışında County'ye plat kaydı zorunludur. Bu izin süreci 6–12 ay sürer ve binlerce dolara mal olur.</p>
              </div>
              <div className="bg-white border border-amber-100 rounded-xl p-4 space-y-2">
                <span className="font-bold text-amber-800 block">3. Deed of Trust Zorunluluğu</span>
                <p className="text-slate-600">Bazı eyaletlerde Contract for Deed yerine Deed of Trust + Trustee atanması zorunludur. Bu dosya başına $1,500–2,500 ekstra maliyet demektir.</p>
              </div>
            </div>
          </div>

          {/* Karşılaştırma Tablosu */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-700 pl-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-700" /> LANDIO vs Discount Lots vs TerraLot — Hızlı Karşılaştırma
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-3">Özellik</th>
                    <th className="p-3">LANDIO</th>
                    <th className="p-3">Discount Lots</th>
                    <th className="p-3 text-emerald-400">TerraLot (Biz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[
                    ["Hedef Arsa Fiyatı", "$45K–$120K", "$15K–$35K", "$8K–$20K (Hızlı Sürüm)"],
                    ["Başlangıç Peşinatı", "$5K–$15K (Yüksek)", "$500 (Orta)", "$499 (Düşük Bariyer)"],
                    ["Aylık Taksit", "$800–$1,500/ay", "$250–$400/ay", "$149–$299/ay"],
                    ["Temerrüt Geri Alım Maliyeti", "$2,000 (Trustee)", "$500–$1,000", "$0 (TX/NM/TN'de mahkemesiz)"],
                    ["Hedef Kitle", "Dar — lüks alıcı", "Orta segment", "Çok geniş — orta sınıf herkes"],
                    ["Teknoloji", "Manuel PDF", "Yarı otomatik", "Stripe + dijital sözleşme"],
                    ["B2B Gelir", "Yok", "Yok", "Emlakçı SaaS + referral"],
                  ].map(([feat, landio, discount, terra], i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="p-3 font-semibold text-slate-800">{feat}</td>
                      <td className="p-3 text-slate-600">{landio}</td>
                      <td className="p-3 text-slate-600">{discount}</td>
                      <td className="p-3 font-bold text-emerald-700">{terra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TerraLot Konumlanması */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              TerraLot'un Piyasadaki Konumu
            </h3>
            <p className="text-sm text-slate-300">Mevcut 5 büyük oyuncuya kıyasla TerraLot şu avantajlarla konumlanır:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-white/10 rounded-xl p-4 space-y-1 border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="font-bold text-white block">En Az Riskli Eyaletler</span>
                <p className="text-slate-400">TX, NM, TN, WY — Contract for Deed'in en kolay çalıştığı 4 eyalet ilk odak noktamız.</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 space-y-1 border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="font-bold text-white block">Teknoloji Üstünlüğü</span>
                <p className="text-slate-400">Stripe otomatik çekim + dijital Contract for Deed sistemi — rakiplerin çoğu hala manuel PDF süreç kullanıyor.</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 space-y-1 border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="font-bold text-white block">Hazır Paket Pazarlama</span>
                <p className="text-slate-400">Alıcıya arsa değil "deneyim paketi" satmak → Landio'nun fiyatının 1.5–2x'i mümkün.</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 space-y-1 border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="font-bold text-white block">B2B SaaS Katmanı</span>
                <p className="text-slate-400">Hiçbir rakip altyapısını başka satıcılara kiralmıyor. Bu $29/ay servis geliri tamamen yeni bir gelir kolu.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 13 — Piyasa Oyuncuları & Eyalet Haritası</span>
        </div>
      </div>
    </div>
  );
}
