"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, ShieldCheck, Scale, DollarSign, HeartHandshake, Compass, AlertCircle, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function Vol9Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 9'u PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 9</p>
          <h1 className="text-3xl font-black text-slate-900">Sorunsuz Eyalet Seçim Kriterleri & Operasyonel Güvence</h1>
          <p className="text-sm text-slate-600 mt-2">Bölünme yasalarının ötesinde, baş ağrıtmayan kırsal arazi ticareti için 4 katmanlı filtre mantığı</p>
        </div>

        {/* Highlight Banner */}
        <div className="p-5 bg-slate-900 text-white rounded-2xl mb-6 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm text-white">Neden Sadece Bölünme Yasası (Platting) Yetmez?</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Bir eyalette arazileri bölüp satabilmek yasal olarak mümkün olsa dahi, o eyaletin <strong>tahliye hukuku, yıllık emlak vergileri ve imar izin esneklikleri</strong> operasyonel sürdürülebilirliğimizi belirler. TerraLot, yatırılan paranın ve operasyonun sıfır sorunla yürümesi için 4 katmanlı filtreleme uygular.
            </p>
          </div>
        </div>

        {/* Competitor Analysis Box */}
        <div className="p-6 bg-cyan-50 border border-cyan-200 rounded-2xl mb-6 space-y-3">
          <h4 className="font-bold text-cyan-900 text-sm flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-cyan-800" />
            Rakip Analizi & Sektörel Sır: Landio ve Land.com California'da Nasıl Taksitli Satış Yapıyor?
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed">
            Yatırımcınız şu soruyu sorabilir: <em>"HelloLandio veya Land.com'daki diğer satıcılar California, Oregon gibi eyaletlerde de taksitli satış yapıyorlar. Onlar neye güveniyor?"</em>
            <br />
            Bunun arkasında yatan 3 profesyonel finansal/hukuki mühendislik stratejisi vardır:
          </p>
          
          <div className="space-y-2.5 text-xs text-slate-700">
            <p>
              <strong>A. Deed of Trust (İpotek) Kullanımı:</strong> Bu platformlar CA gibi eyaletlerde mülkiyeti hemen devrederler ancak tapunun üzerine <strong>Deed of Trust (İpotek Belgesi)</strong> işlerler. Alıcı ödemediğinde mahkemeye gitmek yerine <strong>Non-Judicial Foreclosure (Mahkemesiz İcra)</strong> yetkisi olan bir aracı kurum (Trustee) kullanırlar. Bu süreç mahkemeden hızlıdır (yaklaşık 4 ay sürer) ancak aracı kuruma <strong>$1,500 - $2,500</strong> arası işlem ücreti ödemek zorundadırlar.
            </p>
            <p>
              <strong>B. Yüksek Fiyatlı Portföy (Ticket Price):</strong> Landio gibi siteler $80,000 - $150,000 bandında lüks/pahalı arsalar satarlar. $100,000'lık bir satışta olası bir temerrüt durumunda $2,000 aracı kurum masrafı ödemek (satışın %2'si) makul bir risktir. Ancak bizim gibi $16,200'lık mikro-arsa segmentinde $2,000 masraf ödemek tüm kârımızı sıfırlar.
            </p>
            <p>
              <strong>C. Yüksek Peşinat Filtresi:</strong> California'da taksit yapanlar asla $499 peşinatla arsa vermezler. Minimum <strong>$3,000 - $5,000 peşinat</strong> isterler. Alıcı ödemeyi kesip kaçsa bile satıcı zaten o peşinatla olası icra ve aracı kurum masraflarını baştan tahsil etmiş olur. Bizim hızlı sürüm modelimizde ise peşinatı $499 tutarak sürümden kazanıyoruz; bu yüzden yasal sürecin $0 masraflı olduğu eyaletlere mecburuz.
            </p>
          </div>
        </div>

        {/* Bad Scenario Case Study: Colorado */}
        <div className="p-5 bg-red-50 border border-red-200 rounded-2xl mb-8 flex items-start gap-3 text-xs">
          <XCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-red-950">Risk Analizi (Kötü Örnek): Colorado'da Alıcı Ödemeyi Keserse Ne Olur?</h4>
            <p className="text-red-900 leading-relaxed">
              Colorado gibi alıcıyı aşırı koruyan eyaletlerde bir arsayı taksitle satıp (Installment Land Contract / Contract for Deed) alıcı ödemeyi kestiğinde başımıza gelecekler şunlardır:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-red-900 font-medium">
              <li><strong>Mahkeme Zorunluluğu:</strong> Colorado mahkemeleri taksit sözleşmesini doğrudan ipotek (mortgage) olarak kabul eder. Alıcıyi çıkarmak için resmi <strong>Judicial Foreclosure (Mahkemeli İpotek Feshi)</strong> davası açmak zorundasınız.</li>
              <li><strong>Zaman Kaybı:</strong> Bu dava süreci en az <strong>6 ile 12 ay</strong> sürer. Bu süreçte arsa kilitlenir, başkasına satamazsınız.</li>
              <li><strong>Finansal Zarar:</strong> Eyalet lisanslı avukat ücretleri ve mahkeme masrafları minimum <strong>$3,000 - $5,000</strong> arası tutar. $3,700'a aldığımız bir arsayı geri almak için $5,000 avukat parası ödemek iş modelini tamamen batırır.</li>
              <li><strong>Tapu Lekesi:</strong> Alıcı tapu dairesine şerh koyduğu için mahkeme bitene kadar tapu temizlenemez (Quiet Title davası gerekir).</li>
            </ul>
            <p className="text-red-950 font-bold mt-1">
              → Sonuç: Colorado, Illinois, Indiana ve Ohio gibi eyaletler "hukuki baş ağrısı" nedeniyle TerraLot portföyünden tamamen elenmiştir.
            </p>
          </div>
        </div>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">
          
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">"Baş Ağrıtmayan" Eyalet Seçiminin 4 Katmanı</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              
              {/* Filtre 1 */}
              <div className="p-5 border border-slate-200 rounded-2xl hover:border-slate-400 transition-colors space-y-2">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Scale className="w-4 h-4" /> 1. Hızlı & Mahkemesiz Taksit İptali (Forfeiture Ease)
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Alıcı taksitlerini ödemediğinde mahkemeye gitmeden (avukatsız/foreclosure davasız) sadece 30 günlük ihtarnameyle sözleşmeyi iptal edip mülkü geri alma hakkı.
                  <br />
                  <span className="text-slate-500 font-semibold mt-1 block">• NM, TX ve MO:</span> Mahkemesiz, noter veya mektup ihbarıyla $0 masrafla arsayı geri alırız.
                  <br />
                  <span className="text-red-700 font-semibold block">• IL, IN, OH:</span> 6-12 ay süren ağır foreclosure davaları ve $3,000+ avukat masrafı gerekir.
                </p>
              </div>

              {/* Filtre 2 */}
              <div className="p-5 border border-slate-200 rounded-2xl hover:border-slate-400 transition-colors space-y-2">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <DollarSign className="w-4 h-4" /> 2. Düşük Taşıma Maliyeti (Holding Costs)
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Arsayı portföyde bekletirken veya taksit ödeme süresince ödediğimiz yıllık emlak vergisinin gülünç derecede düşük olması.
                  <br />
                  <span className="text-slate-500 font-semibold mt-1 block">• NM ve TX Kırsalı:</span> Yıllık emlak vergisi parsel başına <strong>$5 - $15</strong> arasındadır. 100 arsa tutsak bile vergi yükü bütçeyi etkilemez.
                  <br />
                  <span className="text-red-700 font-semibold block">• NY, NJ, CA:</span> Boş arsa için bile yıllık yüzlerce hatta binlerce dolar vergi yükü bindirir, nakit akışını baltalar.
                </p>
              </div>

              {/* Filtre 3 */}
              <div className="p-5 border border-slate-200 rounded-2xl hover:border-slate-400 transition-colors space-y-2">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <HeartHandshake className="w-4 h-4" /> 3. Karavan / Tiny House Serbestliği (Zoning Flexibility)
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Belediye sınırı olmayan kırsal (unincorporated) alanların bolluğu. Alıcının arsasına hemen karavan çekip yaşayabilmesi veya Tiny House koyabilmesi satış hızımızı 10 kat artırır.
                  <br />
                  <span className="text-slate-500 font-semibold mt-1 block">• Pilot Eyaletlerimiz:</span> Kırsal bölgelerinde hiçbir zoning (imar) kısıtlaması yoktur. Alıcı yarın çadırını kurup karavanıyla yerleşebilir.
                  <br />
                  <span className="text-red-700 font-semibold block">• CA, OR, UT:</span> Kırsal alanda bile çadır kurmak, 30 günden fazla karavanda yaşamak ağır cezalara tabidir.
                </p>
              </div>

              {/* Filtre 4 */}
              <div className="p-5 border border-slate-200 rounded-2xl hover:border-slate-400 transition-colors space-y-2">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Compass className="w-4 h-4" /> 4. Ucuz Nakit Alım Pazarı (Acquisition Price)
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Vergi borçlularından veya off-market doğrudan tekliflerle Acre (dönüm) başına maliyetlerin $500 - $1,500 bandında olması.
                  <br />
                  <span className="text-slate-500 font-semibold mt-1 block">• Pilot Eyaletlerimiz:</span> Toplam arsa edinme maliyetimiz $3,000 - $4,000 civarında seyreder.
                  <br />
                  <span className="text-red-700 font-semibold block">• Doğu Yakası Eyaletleri:</span> Boş arsalar $40,000'dan başlar. Giriş bariyeri ve risk büyüktür.
                </p>
              </div>

            </div>
          </div>

          {/* Karşılaştırma Tablosu */}
          <div className="space-y-4 border-t border-slate-200 pt-8">
            <h3 className="text-lg font-bold text-slate-900">Eyalet Grubu Karşılaştırma Matrisi</h3>
            <p className="text-xs text-slate-600">
              Aşağıdaki matris, pilot bölgelerimiz ile elenen eyaletlerin operasyonel baş ağrısı faktörlerini puanlama sistemiyle net olarak ortaya koymaktadır:
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden mt-2">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-3">Kriter</th>
                    <th className="p-3">Bizim Pilot Eyaletler (NM, TX, AZ, AR, MO)</th>
                    <th className="p-3">Elenen Eyaletler (CA, NY, IL, FL, NJ)</th>
                    <th className="p-3">TerraLot Yorumu / Stratejisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-3 font-semibold">Taksit İptali Tahliye Süresi</td>
                    <td className="p-3 text-emerald-700 font-bold">1 Ay (Mahkemesiz)</td>
                    <td className="p-3 text-red-700 font-bold">6-12 Ay (Mahkemeli Foreclosure)</td>
                    <td className="p-3 text-slate-600">Alıcı ödemediği an mülkü hemen geri alıp ertesi gün başkasına yeniden satarız. Sermayemiz kilitlenmez.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Yıllık Ortalama Emlak Vergisi</td>
                    <td className="p-3 text-emerald-700 font-bold">$10 / yıl</td>
                    <td className="p-3 text-red-700 font-bold">$1,200+ / yıl</td>
                    <td className="p-3 text-slate-600">Arsayı elde tutarken taşıma maliyetimiz neredeyse sıfırdır. Riskimizi sıfırlar.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">RV / Tiny House İmarları</td>
                    <td className="p-3 text-emerald-700 font-bold">Sınırsız / Serbest</td>
                    <td className="p-3 text-red-700 font-bold">Yasaktır veya Ağır İzin Gerektirir</td>
                    <td className="p-3 text-slate-600">Alıcı kitlemizin çoğu ucuz tiny-house/karavan koymak isteyenlerdir. İmar serbestliği satışı inanılmaz hızlandırır.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Ort. Acre Alım Fiyatı</td>
                    <td className="p-3 text-emerald-700 font-bold">$800</td>
                    <td className="p-3 text-red-700 font-bold">$15,000+</td>
                    <td className="p-3 text-slate-600">Küçük bütçelerle çok fazla arsa toplayıp riski coğrafi olarak dağıtabiliriz.</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="p-3">Operasyonel "Baş Ağrısı" Skoru:</td>
                    <td className="p-3 text-emerald-800">10/10 (Sorunsuz / Güvenli)</td>
                    <td className="p-3 text-red-800">2/10 (Aşırı Riskli / Bürokratik)</td>
                    <td className="p-3 text-slate-800">Seçim mantığımız tamamen bu rasyonel verilere dayanır.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 9 Onaylandı — Eyalet Seçim Mantığı Hazır</span>
        </div>
      </div>
    </div>
  );
}
