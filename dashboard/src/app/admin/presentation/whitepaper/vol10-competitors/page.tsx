"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Users, Coins, HelpCircle, BarChart3, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function Vol10Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 10'u PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 10</p>
          <h1 className="text-3xl font-black text-slate-900">Rakip Satış & Piyasa Analizi</h1>
          <p className="text-sm text-slate-600 mt-2">ABD pazarındaki büyük arsa platformlarının eyalet dağılımları ve taksitli satış modelleri</p>
        </div>

        {/* Competitor Overview */}
        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">
          
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">Rakip Platformların İşleyiş Modelleri</h3>
            <p>
              ABD kırsal arsa pazarında taksitli veya peşin satış yapan en büyük üç rakibimizin eyalet tercihleri, fiyatlama politikaları ve risk yönetim metotları şu şekildedir:
            </p>
          </div>

          {/* Rakipler Kart Listesi */}
          <div className="space-y-6">
            
            {/* Rakip 1 */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h4 className="font-bold text-slate-900 text-base flex items-center justify-between">
                <span>1. LANDIO (HelloLandio)</span>
                <span className="text-xs bg-slate-200 px-3 py-1 rounded-full font-bold">Lüks / Pahalı Segment</span>
              </h4>
              <p className="text-xs text-slate-600">
                <strong>Odaklandığı Eyaletler:</strong> Texas, New Mexico, Colorado, California, Virginia, Tennessee.
              </p>
              <div className="text-xs space-y-1.5 text-slate-700">
                <p>• <strong>Satış Stratejisi:</strong> Genellikle 20 dönüm (Acre) ile 100 dönüm arası büyük ve manzara avantajı olan pahalı arsaları satarlar. Ortalama arsa fiyatları 45,000 dolar ile 120,000 dolar arasındadır.</p>
                <p>• <strong>Taksitlendirme Mantığı:</strong> Girişte 5,000 dolar ile 15,000 dolar arası yüksek peşinatlar isterler. Taksitleri aylık 800 - 1,500 dolar arasındadır.</p>
                <p>• <strong>California ve Colorado Güvencesi:</strong> İpotek sözleşmesi (Deed of Trust) imzalayarak tapuyu hemen devrederler. Alıcı ödemediğinde mahkemeye gitmek yerine aracı kurumla (Trustee) arsayı geri alırlar.</p>
              </div>
            </div>

            {/* REAL-WORLD CASE STUDY: LANDIO TENNESSEE */}
            <div className="p-6 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-4">
              <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                <HelpCircle className="w-5 h-5 text-amber-800" />
                Vaka Çalışması: LANDIO Tennessee 7.7 Dönüm (Acre) İlanı Analizi
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                LANDIO'nun aktif olarak yayınladığı <strong>"Tennessee | 7.7 Acres | $65,705"</strong> ilanının arkasındaki finansal ve hukuki çalışma mantığı şöyledir:
              </p>
              <div className="space-y-2 text-xs text-slate-700">
                <p>
                  <strong>A. Altyapı ve Konum Gücü:</strong> Arsanın sınırında elektrik hattı ve yüksek hızlı fiber internet altyapısı mevcuttur. Eyaletin en ünlü göllerine (Kentucky Lake) çok yakındır. İmar kısıtlaması (NO Restrictions) olmadığı için tiny house, karavan veya prefabrik ev yapımına tamamen uygundur.
                </p>
                <p>
                  <strong>B. Alım ve Satım Arbitrajı:</strong> LANDIO bu arsayı toptan/borçlu sahibinden dönümünü 2,000 - 3,000 dolara (toplamda ~18,000 dolara) nakit kapatmıştır. Üzerine drone çekimleri ve imar onay belgelerini ekleyerek <strong>65,705 dolara</strong> satışa çıkarmıştır.
                </p>
                <p>
                  <strong>C. Taksitli Satış Matematiksel Senaryosu:</strong> 65,705 dolarlık bu arsa için alıcıdan yaklaşık <strong>%15 peşinat (yani ~10,000 dolar)</strong> ve yıllık %10 faiz oranıyla 60 ay boyunca aylık <strong>~1,180 dolar</strong> taksit alırlar.
                </p>
                <p>
                  <strong>D. Tahliye Güvencesi:</strong> Tennessee eyaletinde de tıpkı Texas'ta olduğu gibi <strong>"Deed of Trust" (İpotekli Tapu)</strong> modeli geçerlidir. Alıcı taksit ödemesini kestiğinde, LANDIO mahkemeye gitmez. Aracı kurum (Trustee) üzerinden 3-4 ay içinde mahkemesiz olarak arsayı geri alır. Alıcıdan en başta 10,000 dolar peşinat aldıkları için, 2,000 dolarlık aracı kurum masrafı bu peşinattan fazlasıyla karşılanmış olur.
                </p>
              </div>
            </div>

            {/* Rakip 2 */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h4 className="font-bold text-slate-900 text-base flex items-center justify-between">
                <span>2. Discount Lots (discountlots.com)</span>
                <span className="text-xs bg-slate-200 px-3 py-1 rounded-full font-bold">Orta Segment / Sürüm Pazarı</span>
              </h4>
              <p className="text-xs text-slate-600">
                <strong>Odaklandığı Eyaletler:</strong> Texas, Florida, Arizona, New Mexico, Oregon.
              </p>
              <div className="text-xs space-y-1.5 text-slate-700">
                <p>• <strong>Satış Stratejisi:</strong> 1 dönüm ile 10 dönüm arası değişen orta büyüklükteki arsaları hedeflerler. Ortalama fiyatları 15,000 dolar ile 35,500 dolar arasındadır.</p>
                <p>• <strong>Taksitlendirme Mantığı:</strong> Kampanyalarında bazen 1 dolar peşinat veya 500 dolar peşinat sunarlar. Aylık taksitleri ise 250 dolar ile 400 dolar arasındadır.</p>
                <p>• <strong>Risk Yönetimi:</strong> Tıpkı bizim gibi yıllık emlak vergisi çok düşük olan kırsal eyaletleri seçerler. Sözleşme olarak çoğunlukla tapunun kendilerinde kaldığı kontrat modelini (Contract for Deed) kullanırlar.</p>
              </div>
            </div>

            {/* Rakip 3 */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h4 className="font-bold text-slate-900 text-base flex items-center justify-between">
                <span>3. Land Century (landcentury.com)</span>
                <span className="text-xs bg-slate-200 px-3 py-1 rounded-full font-bold">Ucuz / Toptan Nakit Pazarı</span>
              </h4>
              <p className="text-xs text-slate-600">
                <strong>Odaklandığı Eyaletler:</strong> Arizona, Nevada, Utah, New Mexico.
              </p>
              <div className="text-xs space-y-1.5 text-slate-700">
                <p>• <strong>Satış Stratejisi:</strong> Genellikle çöl alanlarında yer alan, imarı zor olan ve altyapısı bulunmayan çok ucuz arsaları satarlar. Ortalama arsa fiyatları 5,000 dolar ile 12,000 dolar arasındadır.</p>
                <p>• <strong>Taksitlendirme Mantığı:</strong> Taksitli satışı pek sevmezler, daha çok nakit satışı tercih ederler. Taksit yaparlarsa da vadeyi en fazla 12 veya 24 ay ile sınırlandırırlar.</p>
                <p>• <strong>Risk Yönetimi:</strong> Arsaları vergi borcu ihalelerinden ucuza kapatıp üzerine hiç katma değer eklemeden doğrudan ilanla nakde çevirmeye odaklanırlar.</p>
              </div>
            </div>

          </div>

          {/* Karşılaştırma Matrisi */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Platformların Karşılaştırma Tablosu</h3>
            <p className="text-xs text-slate-600">
              TerraLot modelinin diğer rakiplere göre avantajı; düşük alım fiyatı, hızlı sürüm imkanı ve sıfır riskli yasal eyaletlerde konumlanmasıdır.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden mt-2">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-3">Özellik</th>
                    <th className="p-3">LANDIO</th>
                    <th className="p-3">Discount Lots</th>
                    <th className="p-3">TerraLot (Biz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-3 font-semibold">Hedef Arsa Fiyatı</td>
                    <td className="p-3">45,000$ - 120,000$</td>
                    <td className="p-3">15,000$ - 35,500$</td>
                    <td className="p-3 text-emerald-800 font-bold">16,200$ (Hızlı Sürüm)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Başlangıç Peşinatı</td>
                    <td className="p-3">5,000$ - 15,000$ (Çok Yüksek)</td>
                    <td className="p-3">500$ (Orta)</td>
                    <td className="p-3 text-emerald-800 font-bold">499$ (Kolay Alım Bariyeri)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Aylık Taksit Vadesi</td>
                    <td className="p-3">800$ - 1,500$ / ay</td>
                    <td className="p-3">250$ - 400$ / ay</td>
                    <td className="p-3 text-emerald-800 font-bold">249$ / ay (Bütçe Dostu)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Geri Alma Maliyeti</td>
                    <td className="p-3">2,000$ (Aracı Trustee Ücreti)</td>
                    <td className="p-3">500$ - 1,000$ (Eyalete göre)</td>
                    <td className="p-3 text-emerald-800 font-bold">0$ (Mahkemesiz Hızlı İptal)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Hedef Kitle Genişliği</td>
                    <td className="p-3">Dar (Birikimi olan lüks alıcı)</td>
                    <td className="p-3">Orta (Standart arsa arayanlar)</td>
                    <td className="p-3 text-emerald-800 font-bold">Çok Geniş (Orta Sınıf Herkes)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 10 Onaylandı — Rakip Analizleri Hazır</span>
        </div>
      </div>
    </div>
  );
}
