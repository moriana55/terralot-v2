"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Search, TrendingUp, BarChart3, Globe, AlertCircle, CheckCircle2, ExternalLink, Zap, Database } from "lucide-react";
import Link from "next/link";

const trafficData = [
  {
    site: "Land.com + LandWatch.com",
    owner: "CoStar Group (Halka Açık Şirket)",
    monthlyVisits: "6.8 Milyon",
    organicShare: "%72",
    topKeywords: ["land for sale", "farm land for sale", "hunting land for sale", "owner financing land"],
    seoStrength: "Çok Güçlü",
    seoColor: "text-red-700",
    weakness: "Dev platform — küçük satıcıların ilanları gömülür. Kullanıcı deneyimi kötü, filtreler karmaşık.",
    opportunityForTerraLot: "Bu platformlarda ilan vermek trafik kazandırır ama marka bilinirliği oluşturmaz.",
    color: "border-red-200 bg-red-50",
  },
  {
    site: "LandHub.com",
    owner: "Özel Şirket",
    monthlyVisits: "~350K",
    organicShare: "%58",
    topKeywords: ["land for sale owner financing", "cheap land for sale", "rural land"],
    seoStrength: "Orta",
    seoColor: "text-amber-700",
    weakness: "İlan kalitesi düşük, çok az blog/içerik, mobil UX zayıf, backlink profili güçsüz.",
    opportunityForTerraLot: "Bu kelimelerde LandHub'ı geçmek mümkün. Blog + state guide içerikleri yeterli.",
    color: "border-amber-200 bg-amber-50",
  },
  {
    site: "Landio.com (HelloLandio)",
    owner: "Özel LLC — 2014 kurulum",
    monthlyVisits: "~80K–120K (tahmini)",
    organicShare: "%65",
    topKeywords: ["land for sale colorado", "owner financed land new mexico", "raw land wyoming"],
    seoStrength: "Orta-Güçlü",
    seoColor: "text-amber-700",
    weakness: "Sadece listing sayfası var, blog içerik yok. Eyalet bazlı guide sayfası yok. Teknik SEO ortalama.",
    opportunityForTerraLot: "Eyalet bazlı kılavuz (buying guide) ve legal explainer içeriklerle organik trafik çalmak mümkün.",
    color: "border-blue-200 bg-blue-50",
  },
  {
    site: "LandZero.com",
    owner: "Riverbank Land Group LLC",
    monthlyVisits: "~30K–60K (tahmini)",
    organicShare: "%50",
    topKeywords: ["florida land for sale owner financing", "cheap land florida", "land near lake grandin"],
    seoStrength: "Zayıf",
    seoColor: "text-emerald-700",
    weakness: "Neredeyse sıfır blog, site hızı düşük, mobil deneyim kötü, backlink profili çok zayıf.",
    opportunityForTerraLot: "Florida'da LandZero'yu geçmek çok kolay — 10–15 kaliteli içerik yazısı yeterli.",
    color: "border-emerald-200 bg-emerald-50",
  },
  {
    site: "DiscountLots.com",
    owner: "Özel Şirket",
    monthlyVisits: "~40K–80K (tahmini)",
    organicShare: "%45",
    topKeywords: ["discount land", "cheap land for sale no credit check", "land sale owner financing arizona"],
    seoStrength: "Zayıf-Orta",
    seoColor: "text-emerald-700",
    weakness: "Trustpilot skoru 2.8/5, çok müşteri şikayeti. Bu marka güvensizliği SEO'ya da yansıyor.",
    opportunityForTerraLot: "Negatif yorumlar TerraLot için içerik fırsatı — 'güvenilir alternatif' konumlanması.",
    color: "border-slate-200 bg-slate-50",
  },
];

const seoKeywords = [
  { keyword: "land for sale owner financing", volume: "~33K/ay", difficulty: "Yüksek", intent: "Alıcı", note: "Ana hedef kelime. Land.com domine ediyor." },
  { keyword: "cheap land for sale no credit check", volume: "~8K/ay", difficulty: "Orta", intent: "Alıcı", note: "DiscountLots hedef kitlesi. TerraLot burada kolayca girebilir." },
  { keyword: "owner financed land Texas", volume: "~6K/ay", difficulty: "Orta", intent: "Alıcı", note: "Eyalet bazlı kelimeler kazanmak için en hızlı yol." },
  { keyword: "raw land for sale Tennessee", volume: "~4K/ay", difficulty: "Düşük", intent: "Alıcı", note: "Rakiplerin blog içeriği çok az. Hemen sıralanılabilir." },
  { keyword: "contract for deed land", volume: "~2.5K/ay", difficulty: "Düşük", intent: "Araştırma", note: "Hiç kimse bu konuyu detaylı yazmamış. TerraLot için büyük fırsat." },
  { keyword: "how to buy land with owner financing", volume: "~5K/ay", difficulty: "Düşük", intent: "Bilgi", note: "En değerli içerik tipi. Okuyucu alıcıya dönüşür." },
  { keyword: "no restriction land for sale", volume: "~1.8K/ay", difficulty: "Çok Düşük", intent: "Alıcı", note: "Neredeyse rakipsiz. 1 iyi sayfa ile top 3'e girilir." },
  { keyword: "land between the lakes for sale", volume: "~900/ay", difficulty: "Çok Düşük", intent: "Alıcı", note: "Tennessee hedefi. LandZero bu kelimede bile zayıf." },
];

const realPriceTools = [
  {
    name: "County Assessor / GIS Portalı",
    url: "county websitesi → 'Property Search' veya 'GIS Maps'",
    whatYouGet: "Gerçek kayıtlı satış fiyatı, tapu tarihi, parsel büyüklüğü, zoning kodu",
    howTo: "APN numarasını gir → 'Sales History' veya 'Deed History' sekmesine tıkla → Gerçek satış fiyatını gör",
    cost: "Ücretsiz",
    accuracy: "En Yüksek — Resmi Devlet Kaydı",
    example: "Luna County NM: assessor.lunacounty.us → APN ile sorgula",
    color: "border-emerald-300 bg-emerald-50",
    badge: "En Güvenilir",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    name: "Zillow / Redfin (Sold Listings)",
    url: "zillow.com → 'Sold' filtresini aç → 'Land' tipini seç",
    whatYouGet: "Son 1–2 yılda satılmış arsa listeleri, satış fiyatı, kaç günde satıldığı",
    howTo: "Şehir veya zip kodu gir → Tip: Land seç → Filtre: Sold → Fiyat ve süre verisi",
    cost: "Ücretsiz",
    accuracy: "Orta — MLS ilanı olmayan satışlar görünmez",
    example: "Dover TN 37058 → Sold Land → 5–10 gerçek satış fiyatı",
    color: "border-blue-300 bg-blue-50",
    badge: "Hızlı Tarama",
    badgeColor: "bg-blue-100 text-blue-800",
  },
  {
    name: "LandWatch / Land.com (Sold Data)",
    url: "landwatch.com → sold listings filter",
    whatYouGet: "Taksitli satılan arsaların listesi, peşinat + aylık ödeme bilgisi",
    howTo: "State seç → Owner Financing filtresi aç → 'Sold' veya 'Under Contract' olan ilanları incele",
    cost: "Ücretsiz (temel) / $29/ay (premium)",
    accuracy: "Yüksek — Gerçek ilan verisi",
    example: "Texas rural land → Owner financing → $5K–$20K satış aralığı",
    color: "border-purple-300 bg-purple-50",
    badge: "Sektör Standardı",
    badgeColor: "bg-purple-100 text-purple-800",
  },
  {
    name: "PropStream / BatchLeads",
    url: "propstream.com / batchleads.io",
    whatYouGet: "Toplu parsel verisi, satış geçmişi, vergi borçluları listesi, sahip bilgisi",
    howTo: "County + zoning filtresini kur → Son 12 ay satışları çek → CSV olarak indir ve analiz et",
    cost: "$97–$149/ay (Gereksiz Masraf)",
    accuracy: "Yüksek",
    example: "Rakipler bu araca para öderken, biz aynı veriyi County GIS'ten bedavaya çekiyoruz.",
    color: "border-red-300 bg-red-50",
    badge: "Pahalı / Geleneksel Araç",
    badgeColor: "bg-red-100 text-red-800",
  },
  {
    name: "DataTree / ATTOM Data",
    url: "datatree.com / attomdata.com",
    whatYouGet: "Kurumsal düzeyde gerçek tapu kayıt verisi, tüm ABD kapsamı",
    howTo: "API veya portal aracılığıyla APN bazlı sorgulama. Tüm transfer geçmişi görünür.",
    cost: "$200+/ay (Fahiş Enterprise Fiyatı)",
    accuracy: "En Yüksek",
    example: "CoreLogic veya ATTOM, sadece aracı bir tekeldir. Kaynak yine devletin (County) kendisidir.",
    color: "border-red-300 bg-red-50",
    badge: "Fahiş / Kurumsal Tekel",
    badgeColor: "bg-red-100 text-red-800",
  },
  {
    name: "SimilarWeb (SEO Trafik)",
    url: "similarweb.com → domain ara",
    whatYouGet: "Rakip sitenin aylık ziyaretçi sayısı, trafik kaynakları, top keywords",
    howTo: "similarweb.com → landzero.com yaz → Traffic Overview → Organic Search → Keywords",
    cost: "Ücretsiz (sınırlı) / $199/ay (tam)",
    accuracy: "Tahminsel — ±30% hata payı",
    example: "LandZero: ~50K/ay, Landio: ~100K/ay, LandWatch: ~1.8M/ay",
    color: "border-indigo-300 bg-indigo-50",
    badge: "SEO Araştırması",
    badgeColor: "bg-indigo-100 text-indigo-800",
  },
];

export default function Vol15Page() {
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
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 15</p>
          <h1 className="text-3xl font-black text-slate-900">SEO Analizi, Rakip Trafik & Gerçek Fiyat Araştırma Rehberi</h1>
          <p className="text-sm text-slate-600 mt-2">Rakiplerin SEO zayıflıkları, internet trafiği ve ABD'de gerçek arsa satış fiyatlarına nereden ulaşılır?</p>
        </div>

        <div className="space-y-12 text-sm text-slate-700 leading-relaxed">

          {/* Rakip Trafik Analizi */}
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 flex items-center gap-2">
              <Globe className="w-5 h-5" /> Rakip Site Trafiği & SEO Zayıflıkları
            </h2>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>Trafik verileri SimilarWeb ve Ahrefs tahminlerine dayanmaktadır. Küçük niche siteler için ±%30 hata payı normaldir. Kesin veri için ücretli araçlara abonelik gerekir.</span>
            </div>

            {trafficData.map((t, i) => (
              <div key={i} className={`border rounded-2xl p-5 space-y-3 ${t.color}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 text-base">{t.site}</h3>
                    <p className="text-xs text-slate-500">{t.owner}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-slate-900 block text-lg">{t.monthlyVisits}</span>
                    <span className="text-[10px] text-slate-500">aylık ziyaret</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white/70 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase">Organik Trafik</span>
                    <span className="font-bold text-slate-900">{t.organicShare}</span>
                  </div>
                  <div className="bg-white/70 rounded-xl p-2.5 col-span-1 md:col-span-2">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase">Top Keywords</span>
                    <span className="font-bold text-slate-700">{t.topKeywords.join(", ")}</span>
                  </div>
                  <div className="bg-white/70 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase">SEO Gücü</span>
                    <span className={`font-black ${t.seoColor}`}>{t.seoStrength}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/60 rounded-xl p-3">
                    <span className="text-[10px] font-black text-red-700 uppercase tracking-wide block mb-1">✗ SEO Zayıflığı</span>
                    <p className="text-slate-700">{t.weakness}</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide block mb-1">→ TerraLot Fırsatı</span>
                    <p className="text-slate-700">{t.opportunityForTerraLot}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Hedef Anahtar Kelimeler */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-blue-600 pl-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-700" /> TerraLot için Hedef SEO Kelimeleri & Arama Hacimleri
            </h2>
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-5 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1 border-b border-slate-200">
                <span className="col-span-2">Anahtar Kelime</span>
                <span>Aylık Hacim</span>
                <span>Zorluk</span>
                <span>Not</span>
              </div>
              {seoKeywords.map((kw, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs items-start">
                  <div className="col-span-2">
                    <span className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded">{kw.keyword}</span>
                    <span className="ml-2 text-[10px] text-blue-600 font-bold">{kw.intent}</span>
                  </div>
                  <span className="font-bold text-slate-900">{kw.volume}</span>
                  <span className={`font-bold ${
                    kw.difficulty === "Çok Düşük" ? "text-emerald-700" :
                    kw.difficulty === "Düşük" ? "text-blue-700" :
                    kw.difficulty === "Orta" ? "text-amber-700" : "text-red-700"
                  }`}>{kw.difficulty}</span>
                  <span className="text-slate-600 col-span-1 md:col-span-1">{kw.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gerçek Fiyat Araştırma Araçları */}
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-emerald-600 pl-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-700" /> Gerçek Satış Fiyatlarını Nereden Öğrenirsin?
            </h2>
            <p className="text-xs text-slate-600">
              ABD'de tüm tapu devirleri (deed recordings) kamu kaydına girer. Yani rakibin bir arsayı kaça aldığını ve kaça sattığını <strong>yasal olarak öğrenebilirsin</strong>. İşte kullanılacak araçlar:
            </p>

            {realPriceTools.map((tool, i) => (
              <div key={i} className={`border rounded-2xl p-5 space-y-3 ${tool.color}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${tool.badgeColor}`}>{tool.badge}</span>
                    <h3 className="font-black text-slate-900 text-sm">{tool.name}</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-700 shrink-0 bg-white/70 px-3 py-1 rounded-lg">{tool.cost}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/70 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">Ne Öğrenirsin</span>
                    <p className="text-slate-700">{tool.whatYouGet}</p>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">Nasıl Kullanılır</span>
                    <p className="text-slate-700">{tool.howTo}</p>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide block">Gerçek Örnek</span>
                    <p className="text-slate-700 italic">{tool.example}</p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                  <ExternalLink className="w-3 h-3" /> <span className="font-mono">{tool.url}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Hızlı Aksiyon Planı */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              TerraLot SEO & Fiyat Araştırma — Hızlı Başlangıç Planı
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                ["1. Rakip Fiyat Araştırması (Ücretsiz)", "Hedef county'nin assessor sitesine git → APN ile sorgula → rakibin ne zaman, kaça aldığını gör"],
                ["2. SEO Keyword Analizi (Ücretsiz)", "SimilarWeb → landzero.com, landio.com gir → Organic keywords listesini tara → hangilerinde zayıf?"],
                ["3. Trafik Kıyaslama", "LandWatch gibi büyük sitelerde 'owner financing land Tennessee' ara → kaç ilan var? Kaç yorum? Kalite nasıl?"],
                ["4. İçerik Açığı Bul", "Rakiplerin site haritasına bak (site:landzero.com) → Blog var mı? Guide var mı? Yoksa o boşluğu TerraLot doldurur."],
                ["5. Zillow Satış Kanıtı (Ücretsiz)", "Zillow.com → Filtreler: Sold, Land, Hedef Zip Code → Rakiplerin $15K'ya sattığı arsanın aynısını bul."],
                ["6. Google Trends", "trends.google.com → 'owner financing land' + 'land for sale Tennessee' → Mevsimsellik ve trend yönü"],
              ].map(([title, desc], i) => (
                <div key={i} className="bg-white/10 rounded-xl p-3 border border-white/10 space-y-1">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="font-bold text-white">{title}</span>
                  </div>
                  <p className="text-slate-400 pl-5">{desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 15 — SEO Analizi & Gerçek Fiyat Araştırma Rehberi</span>
        </div>
      </div>
    </div>
  );
}
