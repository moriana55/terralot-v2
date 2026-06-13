"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Cpu, Database, CreditCard, BrainCircuit, Activity, Cloud, TrendingUp, CheckCircle2, ShieldCheck, FileJson } from "lucide-react";
import Link from "next/link";

const apiStack = [
  {
    name: "County GIS (ESRI REST) Scrapers",
    url: "Özel Node.js / Python Kazıyıcılarımız",
    purpose: "Regrid/ATTOM Yerine Bedava Parsel Verisi",
    cost: "$0 (Tamamen Ücretsiz)",
    bestFor: "Devletin kendi harita sunucularından (ArcGIS REST) ham veriyi direkt çekmek.",
    pros: [
      "Nasıl Yapıyoruz: Çoğu Amerikan ilçesi (County), harita verilerini ESRI sunucularında barındırır. Biz sistem arayüzünü es geçip, doğrudan arka plandaki açık REST API uçlarına istek atarak GeoJSON formatında parsel sınırlarını (poligonları) ve vergi detaylarını çekiyoruz.",
      "Neden $65.000 Kâr Ediyoruz? (Toplantıda Sorulursa): Amerika'daki 3.000 ilçenin tapu ve poligon verisini toplu satan 3 tekel var: CoreLogic, ATTOM ve Regrid. Bu adamlar veriyi yıllık $65K - $100K arası sözleşmeyle satar. Oysa onların yaptığı da devletin açık sunucularından bedava veriyi toplamaktır. Biz komisyoncuları aradan çıkarıp doğrudan County sunucularına bağlandığımız için 100 bin dolarlık lisans faturasını sıfırlıyoruz."
    ],
    cons: ["Tek handikabımız, her ilçenin veri formatının farklı olması. Bu yüzden hedeflediğimiz her yeni ilçe için botun konfigürasyonunu bir kez ayarlamamız (map etmemiz) gerekiyor."],
    color: "border-blue-200 bg-blue-50",
    badge: "Ana Veri Damarı",
    badgeColor: "bg-blue-100 text-blue-800",
  },
  {
    name: "Özel Zillow Botları (Puppeteer)",
    url: "Headless Chrome & Proxy Network",
    purpose: "Zillow Comps Yerine Ucuz Fiyat Analizi",
    cost: "Sadece Proxy Masrafı ($10-20/ay)",
    bestFor: "Zillow'un kapalı/pahalı resmi API'si yerine kendi yazdığımız hayalet botlarla piyasa verisi çekmek.",
    pros: [
      "Nasıl Yapıyoruz: Node.js üzerinde çalışan Puppeteer (görünmez tarayıcı) botları yazıyoruz. Botlarımız gerçek insan gibi davranarak Zillow'a girer, hedef parselin çevresindeki satılmış 'Comps' (emsal) arazileri bulur.",
      "Zillow'un banlamasını (engellemesini) önlemek için her sorguda IP adresimizi değiştiren bir Proxy Rotasyon ağı kullanıyoruz. Böylece %99 indirimle kendi pazar zekamızı kuruyoruz."
    ],
    cons: ["Zillow sitesinin HTML yapısını değiştirdiğinde (buton yerleri vs.), kodumuzdaki 'selector'ları (seçicileri) manuel güncellemeli ve botu tekrar yayına almalıyız."],
    color: "border-purple-200 bg-purple-50",
    badge: "Fiyatlandırma Motoru",
    badgeColor: "bg-purple-100 text-purple-800",
  },
  {
    name: "Stripe ACH & Plaid Entegrasyonu",
    url: "stripe.com/ach + plaid.com",
    purpose: "Kredi Kartı Komisyonlarından (%2.9) Kaçış",
    cost: "%0.8 (Maksimum $5 sınır)",
    bestFor: "Yüksek meblağlı arsa peşinatlarını ve taksitleri sıfıra yakın komisyonla tahsil etmek.",
    pros: [
      "Nasıl Yapıyoruz: Sisteme Plaid API'sini entegre ettik. Müşteri ödeme ekranında kendi bankasına şifresiyle güvenli giriş yapar. Sistem hesabı anında doğrular.",
      "Ardından Stripe ACH ağı (Automated Clearing House) üzerinden para direkt hesaptan hesaba çekilir.",
      "Avantajı: 10.000 dolarlık bir satışta kredi kartı 290 dolar komisyon keserken, biz bu sistemle sadece 5 dolar ödüyoruz. Ayrıca Chargeback (haksız itiraz) ihtimali neredeyse imkansızdır."
    ],
    cons: ["Paranın bizim şirket hesabımıza fiziki olarak geçmesi kredi kartı gibi anında (1 sn) olmaz, bankalar arası işlem olduğu için 1-3 iş günü sürebilir."],
    color: "border-emerald-200 bg-emerald-50",
    badge: "Finansal Güvenlik",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    name: "BatchData Fallback (Hata Yakalayıcı)",
    url: "batchdata.com/api",
    purpose: "County Botları Çökerse Otomatik Yedek Plan",
    cost: "Sadece kullanıldığında ~2 Cent",
    bestFor: "Kazıması çok zor olan, verilerini şifreleyen veya botlarımızı engelleyen ilçelerde sistemi durdurmamak.",
    pros: [
      "Nasıl Yapıyoruz: Sistemdeki ana kuralımız 'Kusursuz Otonomi'. Eğer yazdığımız GIS botu bir ilçeden veri çekerken hata alırsa, sistem kırmızı alarm verip durmak yerine hatayı (Exception) otomatik yakalar (Catch).",
      "Sistem saniyesinde B planına geçer ve o parselin sorgusunu tekil olarak BatchData API'sine gönderir. 2 cent öder ve veriyi alıp yola devam eder.",
      "Bu sayede sabit yüksek aylık taahhütlere girmeden, sadece kendi botlarımızın tıkandığı %5'lik kısım için dışarıya cüzi bir para öderiz."
    ],
    cons: [],
    color: "border-amber-200 bg-amber-50",
    badge: "Sistem Sigortası",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  {
    name: "id.land (MapRight) GIS Entegrasyonu",
    url: "id.land",
    purpose: "Coğrafi & Çevresel (Due Diligence) Analiz",
    cost: "~$50/ay (Pro Lisans)",
    bestFor: "FEMA, sulak alan, topoğrafya ve mülkiyet sınırlarını tek ekranda sıfır hatayla görselleştirmek.",
    pros: [
      "Nasıl Yapıyoruz: 15 maddelik Due Diligence sürecindeki coğrafi engelleri (sel riski, eğim, toprak tipi) teyit etmek için sektörün en iyi ve pratik GIS aracı olan id.land'i kullanıyoruz.",
      "Devletin hantal siteleriyle uğraşmak yerine; parsel sınırlarını ve haritaları saniyeler içinde kusursuz poligonlar olarak alıp satış ilanlarımıza ekliyor, arsanın algılanan değerini anında premium seviyeye taşıyoruz."
    ],
    cons: ["Tüm ABD parsel verisini toplu halde (bulk) indirmeye izin vermez. Ancak biz zaten hedefli ('sniper') atışlar yaptığımız için bu hantal enterprise özelliğine ihtiyaç duymuyoruz."],
    color: "border-teal-200 bg-teal-50",
    badge: "Harita & Analiz",
    badgeColor: "bg-teal-100 text-teal-800",
  },
];

const aiAutomation = [
  { step: "1", title: "Otonom Veri Çekimi", desc: "Sistem County GIS botları ile haritayı çeker, Zillow proxy ağından emsal (comps) satış fiyatlarını toplar.", tool: "Node.js + id.land", color: "bg-slate-900 text-white" },
  { step: "2", title: "Claude Pro Analizi", desc: "Claude API, tüm bu verileri okuyarak arazinin kârlılık potansiyelini 1 ile 10 arasında puanlar.", tool: "Anthropic Claude 3.5 Sonnet", color: "bg-purple-700 text-white" },
  { step: "3", title: "Teklif Oluşturma", desc: "Toplanan emsal (Comps) verilerine göre bölge ortalamasının %30 altında (Low-ball) bir nakit teklif mektubu oluşturulur.", tool: "Node.js + Claude", color: "bg-emerald-700 text-white" },
  { step: "4", title: "Müşteriye Sunum", desc: "Arazi satın alındığında, Stripe üzerinden 60 aylık taksitli ödeme planıyla web sitesinde listelenir.", tool: "Next.js + Stripe", color: "bg-amber-700 text-white" },
  { step: "5", title: "AI Off-Grid Projelendirme", desc: "Nasıl Yapıyoruz: Parselin gerçek Google Earth uydu görüntüsü alınır. Midjourney ve ControlNet altyapısı kullanılarak, arsanın orijinal topoğrafyası ve ağaçları bozulmadan görselin üzerine Güneş Paneli, Starlink ve Karavan (RV) yerleştirilir. Müşteriye 'toprak' değil, 'Hazır Özgürlük Konsepti' satılır.", tool: "Midjourney + ControlNet", color: "bg-teal-700 text-white" },
];

export default function Vol17TechStackPage() {
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
        <div className="border-b-4 border-slate-900 pb-6 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 16</p>
          <h1 className="text-3xl font-black text-slate-900">Tech Stack, API'ler & AI Altyapısı</h1>
          <p className="text-sm text-slate-600 mt-2">TerraLot'u sıradan bir emlak şirketinden ayıran %100 otonom teknoloji altyapısı.</p>
        </div>

        <div className="space-y-12 text-sm text-slate-700 leading-relaxed">

          {/* Core APIs */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 flex items-center gap-2">
              <Database className="w-5 h-5" /> Entegre Edilen 5 Ana Silahımız
            </h2>
            
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold shrink-0 mt-0.5">!</div>
              <p className="text-xs text-indigo-900 leading-relaxed">
                <strong className="block text-sm mb-1">Sunum Notu: Aşağıdaki 5 Araç Birbirinin Alternatifi Değildir!</strong>
                Regrid, ATTOM veya Zillow'un resmi Enterprise paketlerine yüz binlerce dolar gömmek yerine; haritayı devletten, sınırları id.land'den, fiyatları Zillow botlarından, ödemeleri banka transferinden ve eksik verileri mikro-API'lerden çekerek maliyeti sıfıra indirdik. <strong>Bu 5 aracın beşini birden entegre ederek "Voltran'ı" (Kusursuz Gerilla Ekosistemi) oluşturduk.</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {apiStack.map((api, i) => (
                <div key={i} className={`border rounded-2xl p-5 space-y-3 ${api.color}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-black text-slate-900 text-base">{api.name}</h3>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${api.badgeColor}`}>{api.badge}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">{api.url}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block text-xs">{api.purpose}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white/70 rounded-lg p-3 text-xs">
                    <span className="text-[10px] text-slate-500 block font-bold mb-1">En İyi Kullanım:</span>
                    <span className="text-slate-700">{api.bestFor}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs">
                    {api.pros?.map((p, j) => <div key={j} className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /><span className="text-slate-700">{p}</span></div>)}
                    {api.cons?.map((c, j) => <div key={j} className="flex items-start gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /><span className="text-slate-700">{c}</span></div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Workflow */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-purple-600 pl-3 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-purple-700" /> Claude Pro (AI) Karar Mekanizması
            </h2>
            <div className="space-y-3">
              {aiAutomation.map((f, i) => (
                <div key={i} className="flex gap-4 items-stretch">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${f.color}`}>{f.step}</div>
                  <div className="flex-1 border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black text-slate-900 block text-sm mb-1">{f.title}</span>
                      <span className="text-slate-700">{f.desc}</span>
                    </div>
                    <div className="ml-4 text-right">
                      <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg whitespace-nowrap">{f.tool}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Concept Image Example */}
            <div className="mt-8 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-900 p-4 flex items-center justify-between">
                <span className="text-white font-bold text-sm flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-teal-400" /> AI Off-Grid Projelendirme (Örnek Konsept Çıktısı)</span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-white/10 px-2 py-1 rounded">Midjourney V6 + ControlNet</span>
              </div>
              <div className="p-2 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/offgrid-concept.png" alt="Off-Grid Concept" className="w-full h-auto rounded-xl object-cover border border-slate-200" />
              </div>
              <div className="p-5 bg-teal-50/50 border-t border-teal-100">
                <p className="text-xs text-teal-900 leading-relaxed font-medium">
                  <strong className="text-teal-950 uppercase tracking-wide">Sunum Notu:</strong> Yatırımcıya arsayı bu görsel konsept eşliğinde satıyoruz. Müşteri, Google Earth'teki kuru toprak parçasını değil; kendi arsasının üzerine konumlandırılmış Güneş Paneli, Starlink anteni ve lüks bir Karavanın (RV) bulunduğu bu <em>'Özgürlük Kampını'</em> hayal ederek o premium fiyatı ödüyor. AI işte bu hayali fotogerçekçi olarak çizer.
                </p>
              </div>
            </div>

          </div>

          {/* Architecture Concept */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Cloud className="w-5 h-5 text-cyan-400" /> Sunucusuz (Serverless) Çevik Mimari
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              Bu sistemin en büyük avantajı, sunucu maliyetlerinin sıfıra yakın olmasıdır. Geleneksel emlak firmaları 10 kişilik analist ekipleriyle haftalarca arsa araştırması yaparken; TerraLot sistemi <strong>Next.js + Supabase</strong> mimarisi sayesinde tüm API veri çekme, değerlendirme ve fiyatlama işlemlerini 3 saniyede otonom olarak gerçekleştirir. <br/><br/>
              <em>"Maliyet hackleme"</em> vizyonumuz sayesinde sadece işleme dönüşen, değer üreten API sorguları için para öderiz.
            </p>
          </div>

        </div>

        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 16 — Tech Stack & API Altyapısı</span>
        </div>
      </div>
    </div>
  );
}
