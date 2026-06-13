"use client";

import { ArrowLeft, BookOpen, Compass, Mail, MapPin, Scale, BarChart3, Landmark, ArrowUpRight, TrendingUp, Building2, ShieldCheck, ShieldAlert, BadgePercent, Globe, Trees, Search, Send, Zap, Cpu } from "lucide-react";
import Link from "next/link";

export default function WhitepaperIndexPage() {
  const volumes = [
    { id: "vol0-executive-summary", label: "Cilt 0: Yönetici Özeti & Yatırımcı Teklifi", desc: "TerraLot iş modelinin 1 sayfalık özeti: Sıfır-maliyetli Gerilla AI otomasyonu (County Bots + Claude API + Node.js) ve düşük bütçeli 'Smoke Test' yatırım planı.", icon: Zap, link: "/admin/presentation/whitepaper/vol0-executive-summary" },
    { id: "vol1-operational", label: "Cilt 1: Yol Haritası & Operasyonel İş Planı", desc: "Wyoming LLC kurulum adımları, banka hesap süreçleri, Stripe ödeme amortizasyon entegrasyonu ve 30 günlük takvim.", icon: Landmark, link: "/admin/presentation/whitepaper/vol1-operational" },
    { id: "vol2-states", label: "Cilt 2: 50 Eyalet İmar ve Bölünme Yasaları", desc: "Platting muafiyet sınırları, resmi yasa kodları (NMSA § 47, TX § 232) ve elenen eyaletlerin yasal gerekçeleri.", icon: Compass, link: "/admin/presentation/whitepaper/vol2-states" },
    { id: "vol3-sourcing", label: "Cilt 3: Mektup & Tedarik Algoritmaları", desc: "Vergi borçluları ve absentee listelerinin filtre kriterleri, Lob API gönderim şeması ve satın alma teklif formülleri.", icon: Mail, link: "/admin/presentation/whitepaper/vol3-sourcing" },
    { id: "vol4-cases", label: "Cilt 4: Pilot Proje Case Studies", desc: "Gerçek APN'ler ve koordinatlarla Luna County NM ve Texas Hudspeth örnek arsa analizleri ve ciro simülasyonları.", icon: MapPin, link: "/admin/presentation/whitepaper/vol4-cases" },
    { id: "vol5-legal", label: "Cilt 5: Taksitli Satış & Tahliye Hukuku", desc: "Contract for Deed tapu güvencesi, mahkemesiz ($0) anında sözleşme feshi yasa maddeleri ve 15 maddelik due diligence listesi.", icon: Scale, link: "/admin/presentation/whitepaper/vol5-legal" },
    { id: "vol6-financial", label: "Cilt 6: Finansal Model & ROI Analizi", desc: "Bütçe dağılımları, aylık MRR hedefleri ve %30 default oranının kârı katlama mekanizmasının matematiksel kanıtları.", icon: BarChart3, link: "/admin/presentation/whitepaper/vol6-financial" },
    { id: "vol7-arbitrage", label: "Cilt 7: Perakende Arbitraj & Fiyat Meşruiyeti", desc: "3,700 dolara alınan arsanın 16,200 dolara satılmasının yasal, finansal ve psikolojik gerekçelendirilmesi paketi.", icon: TrendingUp, link: "/admin/presentation/whitepaper/vol7-arbitrage" },
    { id: "vol8-realtors", label: "Cilt 8: B2B Emlakçı & Acente Ortaklığı", desc: "Acentelerden yönlendirme komisyonu kazanma, MLS ortak satış gücü ve ödeme takip platformu (SaaS) lisanslama modeli.", icon: Building2, link: "/admin/presentation/whitepaper/vol8-realtors" },
    { id: "vol9-risk-logic", label: "Cilt 9: Sorunsuz Eyalet Seçim Kriterleri", desc: "Bölünme yasalarının ötesinde; tahliye kolaylığı, düşük vergiler ve imar esnekliğine dayalı risksiz eyalet mantığı.", icon: ShieldCheck, link: "/admin/presentation/whitepaper/vol9-risk-logic" },
    { id: "vol10-competitors", label: "Cilt 10: Trustee (Yediemin) Aracı Kurumları", desc: "Amerika'da mahkemesiz icra (Non-Judicial Foreclosure) yürüten lisanslı aracı kurumların isimleri, maliyetleri ve 3 adımlı süreç akışı.", icon: ShieldAlert, link: "/admin/presentation/whitepaper/vol11-trustees" },
    { id: "vol11-micro-lots", label: "Cilt 11: Mikro-Arsa & LandZero Vakası", desc: "0.22 dönümlük Florida arazisinin tüm 7 ödeme seçeneği, taksit faiz mühendisliği ve abonelik tarzı satış psikolojisi.", icon: BadgePercent, link: "/admin/presentation/whitepaper/vol12-micro-lots" },
    { id: "vol12-market-players", label: "Cilt 12: Piyasa Oyuncuları, Rakip Analizi & Eyalet Haritası", desc: "5 rakip firma profili, LANDIO/DiscountLots/TerraLot karşılaştırma tablosu, eyalet uygunluk haritası ve TerraLot'un konumlanması.", icon: Globe, link: "/admin/presentation/whitepaper/vol13-market-players" },
    { id: "vol13-zoning-guide", label: "Cilt 13: Arsa Tipleri & Zoning Rehberi", desc: "AG, RR, R-1, Vacant ve diğer zoning kodlarında ne yapılabilir, ne yapılamaz — 8 kritik imar terimi ve kontrol listesi.", icon: Trees, link: "/admin/presentation/whitepaper/vol14-zoning-guide" },
    { id: "vol14-seo-research", label: "Cilt 14: SEO Analizi & Gerçek Fiyat Araştırma", desc: "Rakiplerin trafik ve SEO zayıflıkları, hedef keyword hacimleri ve ABD'de gerçek arsa satış fiyatlarına ulaşma rehberi.", icon: Search, link: "/admin/presentation/whitepaper/vol15-seo-research" },
    { id: "vol15-outreach", label: "Cilt 15: Arsa Sahibi Erişim Stratejisi", desc: "Skip tracing ile email bulma, 45 günlük Lob+email omnichannel kampanya akışı, hazır şablonlar ve ROI hesabı.", icon: Send, link: "/admin/presentation/whitepaper/vol16-outreach" },
    { id: "vol16-tech-stack", label: "Cilt 16: Tech Stack, API'ler & AI Altyapısı", desc: "County GIS Botları, RapidAPI Zillow Comps ve Stripe ACH entegrasyonları ile Claude API destekli %100 otonom (sabit maliyetsiz) operasyon mimarisi.", icon: Cpu, link: "/admin/presentation/whitepaper/vol17-tech-stack" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12">
      {/* Top Header */}
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center">
        <Link href="/admin/presentation" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Sunum Paneline Dön
        </Link>
        <span className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" /> Rapor Kütüphanesi
        </span>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl">
        <div className="border-b-4 border-slate-900 pb-8 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">TerraLot Yatırım Fizibilite Kitaplığı</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Yatırımcı Bilgi Raporları ve Yasal Mevzuat Dosyaları
          </h1>
          <p className="text-base text-slate-600 mt-3 font-medium">
            Yatırım modelinin tüm hukuki, finansal ve operasyonel detaylarını içeren 17 bağımsız cilt.
          </p>
        </div>

        {/* Library Archive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {volumes.map(v => {
            const Icon = v.icon;
            return (
              <Link key={v.id} href={v.link} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl hover:border-slate-400 hover:bg-slate-100/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center justify-between">
                    {v.label}
                    <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {v.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 text-xs text-slate-500 font-bold group-hover:text-slate-800 transition-colors flex items-center gap-1">
                  Cildi İncele & Yazdır &rarr;
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="border-t border-slate-200 pt-8 mt-12 text-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC &copy; 2026 — Gizli Yatırımcı Belgesidir.</span>
        </div>
      </div>
    </div>
  );
}
