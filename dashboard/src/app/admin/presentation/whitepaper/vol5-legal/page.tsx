"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Scale, ShieldCheck, CheckCircle2, ShieldAlert, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Vol5Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  
  const dueDiligenceItems = [
    {
      category: "I. Mülkiyet & Hukuki Durum Kontrolleri (Title & Ownership)",
      items: [
        { title: "1. Chain of Title (Mülkiyet Zinciri)", desc: "Arsanın son 30 yıla ait tüm tapu devir kayıtları incelenerek mülkiyet zincirinde herhangi bir kopukluk veya usulsüzlük olmadığı doğrulanır." },
        { title: "2. Probate & Miras Sorgulaması", desc: "Kayıtlı tapu sahibinin vefat etmiş olması durumunda, veraset ilamı (probate) dosyası ve tüm yasal mirasçıların muvafakati resmi mahkeme kayıtlarından kontrol edilir." },
        { title: "3. Legal Description Alignment (Sınır Eşleşmesi)", desc: "Tapu senedindeki (Deed) metinsel sınır açıklaması (metes and bounds) ile CBS (GIS) harita verileri ve APN koordinatlarının birebir uyuşması teyit edilir." },
        { title: "4. Corporate Status Check (Şirket Statüsü)", desc: "Satıcının kurumsal bir tüzel kişilik olması durumunda, ilgili eyaletin Dışişleri Bakanlığı (Secretary of State) sisteminde 'Active / In Good Standing' statüsünde olduğu doğrulanır." },
        { title: "5. Notary & Fraud Prevention (Kimlik Doğrulama)", desc: "İmza aşamasında eyalet lisanslı noterlerin geçerliliği ve imzalayan tarafların kimlik bilgileri federal veri tabanları üzerinden çapraz kontrole tabi tutulur." }
      ]
    },
    {
      category: "II. Finansal Yükümlülükler & Haciz Taramaları (Financial Liens)",
      items: [
        { title: "6. Back Taxes & Tax Liens (Emlak Vergisi Borcu)", desc: "Geriye dönük ödenmemiş tüm emlak vergileri (delinquent taxes) ve vergi ipotekleri sorgulanır. Borçsuz tapu devri garanti altına alınır." },
        { title: "7. Banka ve Özel Hacizler (Mortgages & HOA Liens)", desc: "Arsa üzerinde aktif bir mortgage kredisi, inşaat/işçi alacağı (mechanic's lien) veya site/birlik yönetim borcu (HOA lien) olup olmadığı tapu sicilinden taranır." },
        { title: "8. Federal & Eyalet İcra Taraması", desc: "Satıcının üzerinde aktif IRS vergi borcu, iflas davası (Bankruptcy Chapter 7/11/13) veya mahkeme icra kararı olup olmadığı kontrol edilerek haciz riski sıfırlanır." }
      ]
    },
    {
      category: "III. Coğrafi, Çevresel & Toprak Riskleri (Geographic & Environmental)",
      items: [
        { title: "9. FEMA Flood Zone Check (Sel Riski)", desc: "Arsanın FEMA sel haritalarında riskli bölgede (Zone A/AE) olup olmadığı kontrol edilir. Yatırım için yalnızca düşük riskli Zone X arsaları tercih edilir." },
        { title: "10. USGS Slope & Elevation (Eğim Analizi)", desc: "Topografik eğimin %15'in altında olduğu, heyelan ve erozyon riski bulunmadığı USGS (US Geological Survey) uydu verileriyle doğrulanır." },
        { title: "11. Wetlands & Protected Habitat (Sulak Alanlar)", desc: "US Fish & Wildlife veritabanından arazinin koruma altındaki sulak alan (wetlands) veya korunan ekolojik sit alanları içinde kalmadığı teyit edilir." },
        { title: "12. Soil Perk Suitability (Septik Tank Uygunluğu)", desc: "USDA toprak yapısı veri tabanı taranarak toprağın süzme kapasitesi (percolation) ve septik tank kurulumuna uygunluğu analiz edilir." }
      ]
    },
    {
      category: "IV. İmar, Erişim & Altyapı Kontrolleri (Zoning & Utilities)",
      items: [
        { title: "13. Legal & Physical Access (Geçiş Hakkı)", desc: "Arsanın kamuya açık veya tescilli bir yola cephesinin (easement/right of way) olduğu, çevre parseller tarafından kapatılmadığı (landlocked olmadığı) kesinleştirilir." },
        { title: "14. Zoning & Ordinance Check (İmar Kodları)", desc: "County İmar Dairesi (Planning & Zoning Department) kodları sorgulanarak arsanın Tiny House, RV (karavan), mobil ev veya prefabrik yapılaşmaya izin verdiği resmi mevzuattan doğrulanır." },
        { title: "15. Utility Proximity (Altyapı Mesafesi)", desc: "Elektrik direği, su şebekesi veya fiber hatların arsaya olan mesafeleri CBS haritaları ve yerel altyapı sağlayıcılarının sistemlerinden ölçülür." }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 5'i PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 5</p>
          <h1 className="text-3xl font-black text-slate-900">Taksitli Satış ve Tahliye Hukuku</h1>
          <p className="text-sm text-slate-600 mt-2">Contract for Deed güvencesi, mahkemesiz tahliye kanunları ve eyalet bazlı yasal prosedürler</p>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl mb-8 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-900">Önemli Hukuki Ayrım: Wyoming LLC ve Eyalet Yasalarının Sınırları</h4>
            <p className="text-amber-800 leading-relaxed">
              Şirketimizin <strong>Wyoming</strong> merkezli olması, arsa tahliye ve geri alım süreçlerinde Wyoming kanunlarının geçerli olacağı anlamına gelmez. Wyoming LLC sadece <strong>şahsi varlık koruması (corporate shield) ve gizlilik</strong> sağlar. Toprak hukuku yereldir (lex loci rei sitae). Yani arsa hangi eyalette ise, sözleşme iptali ve geri alma prosedürlerinde <strong>kesinlikle o eyaletin kanunlarına (New Mexico veya Texas)</strong> uymak zorundayız.
            </p>
          </div>
        </div>

        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">
          
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">1. Contract for Deed (Senetli Satış) Nedir?</h3>
            <p>
              Modelimiz alıcıya banka veya mortgage kuruluşu olmaksızın kendi finansmanımızı sağladığımız <strong>Contract for Deed</strong> modeline dayanır. Bu yapıda, alıcı ile imzalanan sözleşme uyarınca:
            </p>
            <ul className="space-y-2 text-xs text-slate-600 pl-4 list-disc">
              <li>Resmi tapu mülkiyeti (Deed), alıcı son taksitinin son cent'ini ödeyene kadar bizim <strong>Wyoming LLC</strong> şirketimizde kalır.</li>
              <li>Alıcıya tapu devri yapılmaz, sadece araziyi kullanım (possession) hakkı verilir.</li>
              <li>Alıcı arazinin emlak vergisini ve yıllık sigortasını taksit bedeline ek olarak bize ödemekle yükümlüdür.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">2. Temerrüt (Default) ve Anında İptal Süreci</h3>
            <p>
              Alıcı taksit ödemesini geciktirdiğinde (30+ gün), <strong>toprağın bulunduğu eyaletin yasal kodlarına göre</strong> noter kanalıyla veya iadeli taahhütlü ihtar mektubu gönderilir:
            </p>
            <ul className="space-y-2 text-xs text-slate-600 pl-4 list-disc">
              <li><strong>New Mexico (NMSA § 47-6-1):</strong> Alıcıya 30 günlük ihtar gönderilir. Ödeme yapılmazsa sözleşme kendiliğinden feshedilir, mülkiyet bizde olduğu için tahliye davası gerekmez. Mahkeme masrafı: <strong>$0</strong>.</li>
              <li><strong>Texas (Property Code § 5.064):</strong> Alıcıya 30 günlük "Notice of Default" gönderilir. Süre sonunda ödeme yapılmazsa noter onaylı fesih belgesi tescil edilerek arsa envantere geri alınır. Mahkeme masrafı: <strong>$0</strong>.</li>
            </ul>
          </div>

          {/* 15 Maddelik Altın Due Diligence Kalkanı */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2">
              <ShieldCheck className="w-6 h-6 text-slate-900" />
              <h3 className="text-lg font-bold text-slate-900">3. 15 Maddelik Altın Due Diligence Kalkanı</h3>
            </div>
            
            <p className="text-xs text-slate-600">
              TerraLot platformunun bir arsayı satın almadan önce çalıştırdığı, satın alma kararı vermemizi sağlayan 15 kontrol noktası. Bu kontrol noktalarının herhangi birinden geçemeyen arsalar doğrudan sistem tarafından elenir:
            </p>

            {/* Otomasyon Durumu Açıklaması */}
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl my-6 space-y-3">
              <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Otomasyon Durumu: Yaptıklarımız & Yapacaklarımız (MVP vs Faz 2)
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Şu anki altyapımızda (Faz 1) Coğrafi ve İmar verilerini <strong>(Madde 9'dan 15'e kadar olan analizleri)</strong> kendi County GIS botlarımızla ve harita API'leriyle (FEMA vb.) otomatize etmiş durumdayız.
              </p>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Ancak ilk 8 madde tamamen hukuki süreçlerdir. Amerika'da hiçbir yapay zeka bir Title Company'nin (Tapu Şirketi) yasal güvencesinin (Title Insurance) yerini alamaz. Bu yüzden 90 günlük 'Smoke Test' aşamasında <strong>bu ilk 8 maddeyi riski sıfırlamak adına bizzat manuel olarak</strong> (veya Title Company aracılığıyla) teyit ediyoruz.
              </p>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Eğer 90 gün sonunda büyük fonlamaya geçersek; DataTree gibi devasa kurumsal veri tabanlarının kapalı API'lerini sisteme bağlayıp, bu hukuki taramaları da koda dökeceğiz. <strong>Özetle: Harita analizlerini AI yapıyor, ama hukuki riskleri (haciz/miras) şansa bırakmıyoruz.</strong>
              </p>
            </div>

            <div className="space-y-6 mt-4">
              {dueDiligenceItems.map((group, gIdx) => (
                <div key={gIdx} className="space-y-3">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg">
                    {group.category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.items.map((item, iIdx) => (
                      <div key={iIdx} className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl hover:border-slate-300 transition-colors">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-bold text-xs text-slate-900">{item.title}</h5>
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 5 Onaylandı</span>
        </div>
      </div>
    </div>
  );
}
