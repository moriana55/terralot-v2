"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, TrendingUp, BadgePercent, ShieldAlert, Sparkles, AlertCircle, Coins, Users, Hammer, Milestone, Trees } from "lucide-react";
import Link from "next/link";

export default function Vol7Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 7'yi PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 7</p>
          <h1 className="text-3xl font-black text-slate-900">Perakende Kâr Marjı & Arbitraj Güvencesi</h1>
          <p className="text-sm text-slate-600 mt-2">3,700$'lık off-market arazinin 16,200$'a perakende satış mantığı, alıcı psikolojisi ve müşteri avatarları</p>
        </div>

        {/* Warning Alert Box */}
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl mb-8 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Yatırımcı/Müşteri Şüphesi: "Alıcılar ucuza aldığımızı anlayıp vazgeçer mi?"</h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Kırsal arazi pazarında fiyatı belirleyen unsur arsanın "toptan maliyeti" değil, müşteriye sunulan <strong>erişilebilirlik (taksitli finansman)</strong> ve <strong>kullanıma hazır paket yapısıdır</strong>.
            </p>
          </div>
        </div>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">
          
          {/* Müşteri Avatarları Bölümü */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 border-b border-slate-100 pb-2">
              <Users className="w-5 h-5 text-slate-900" /> Hedef Pazarın 3 Ana Alıcı Profili (Neden Alıyorlar?)
            </h3>
            <p className="text-xs text-slate-600">
              Sanılanın aksine, kırsal arazi alıcıları sadece off-grid (şebekesiz) veya karavanda yaşamak isteyenlerden ibaret değildir. Pazardaki talebin %75'ini aşağıdaki 3 ana "baş ağrıtmayan" perakende alıcı grubu oluşturur:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Profil 1 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Hammer className="w-4 h-4" />
                </div>
                <h5 className="font-bold text-xs text-slate-900">1. İleride Ev Yaptıracaklar (Future Homebuilders)</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong>Kimler?</strong> 40-55 yaş arası çalışan, emeklilik planı yapan orta sınıf aileler.
                  <br /><br />
                  <strong>Neden?</strong> Bugünden ucuz taksitle ($249/ay) toprağı kapatıp, borcunu bitirip emekli olduklarında üzerine modüler ev veya prefabrik konut yaptırmak amacıyla alırlar.
                </p>
              </div>

              {/* Profil 2 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Milestone className="w-4 h-4" />
                </div>
                <h5 className="font-bold text-xs text-slate-900">2. Arazi Yatırımcıları (Land Bankers / Enflasyon Koruması)</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong>Kimler?</strong> Parası enflasyonda erimesin diye somut bir varlığa yatırmak isteyen küçük tasarruf sahipleri.
                  <br /><br />
                  <strong>Neden?</strong> Yıllık vergisi $10 olan kırsal bir arsa, sıfır bakım maliyetiyle en güvenli limandır. "Toprak sınırlıdır, nüfus artmaktadır" mantığıyla alıp çocuklarına bırakırlar.
                </p>
              </div>

              {/* Profil 3 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center">
                  <Trees className="w-4 h-4" />
                </div>
                <h5 className="font-bold text-xs text-slate-900">3. Hobi & Hafta Sonu Kampçıları (Weekend Warriors)</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong>Kimler?</strong> Şehirde apartmanda yaşayıp hafta sonları doğaya kaçmak isteyen aileler, avcılar, ATV/motor sporcuları.
                  <br /><br />
                  <strong>Neden?</strong> Otellere ve kamping alanlarına sürekli kira vermek yerine, kendi tapulu arazilerinde özgürce çadır kurmak, ateş yakmak ve kamp yapmak için alırlar.
                </p>
              </div>

            </div>
          </div>

          {/* Sütun 1 */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">01</span>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-emerald-700" /> Satıcı Finansmanı Primi (Seller Financing Premium)
              </h3>
            </div>
            
            <p>
              ABD kırsal toprak pazarında en büyük darboğaz finansmandır. Geleneksel bankalar (Wells Fargo, Chase vb.) veya yerel kredi kuruluşları imarsız, altyapısız ham toprağa (raw land) mortgage kredisi vermezler. Alıcıların önünde iki seçenek kalır: ya tüm parayı nakit ödemek ya da satıcının taksit yapmasını istemek.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-400 block mb-1">Geleneksel Banka Engelleri</span>
                <ul className="text-xs space-y-1.5 text-slate-600">
                  <li className="flex items-center gap-1.5"><span className="text-red-500 font-bold">✗</span> Ham toprağa kredi vermezler</li>
                  <li className="flex items-center gap-1.5"><span className="text-red-500 font-bold">✗</span> FICO kredi skoru minimum 720+ olmalı</li>
                  <li className="flex items-center gap-1.5"><span className="text-red-500 font-bold">✗</span> Yüksek dosya masrafı & 30 gün onay süresi</li>
                  <li className="flex items-center gap-1.5"><span className="text-red-500 font-bold">✗</span> %30-50 peşinat zorunluluğu</li>
                </ul>
              </div>
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-xs font-bold text-emerald-800 block mb-1">TerraLot Finansman Kolaylığı</span>
                <ul className="text-xs space-y-1.5 text-slate-700">
                  <li className="flex items-center gap-1.5 text-emerald-800"><span className="text-emerald-600 font-bold">✓</span> Kredi kontrolü / FICO sorgulaması yok</li>
                  <li className="flex items-center gap-1.5 text-emerald-800"><span className="text-emerald-600 font-bold">✓</span> $499 Peşinat ile aynı gün tapu hakları</li>
                  <li className="flex items-center gap-1.5 text-emerald-800"><span className="text-emerald-600 font-bold">✓</span> $249/ay taksitle bütçe dostu ödeme</li>
                  <li className="flex items-center gap-1.5 text-emerald-800"><span className="text-emerald-600 font-bold">✓</span> Tamamen online, 10 dakikada imza</li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-slate-500 italic">
              * Matematiksel Gerçek: $3,700 nakitle aldığımız arsayı $16,200 nakit yerine taksitle sattığımızda vade farkıyla toplam portföy değerini $21,000'ın üzerine çıkarırız. Alıcı peşin $3,700 veremediği için, $21,000 ödemeyi seve seve kabul eder. Tıpkı $20,000'lık arabayı vadeli/taksitli $35,000'a alan Amerikan banliyö tüketicisi gibi.
            </p>
          </div>

          {/* Sütun 2 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">02</span>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-700" /> Bilgi ve Operasyon Uçurumu (The Knowledge & Cash Gap)
              </h3>
            </div>
            
            <p>
              Bireysel alıcı Zillow'a girip fiyatları görür, ancak o fiyatlar perakende fiyatlardır. Bireysel bir Amerikalının bizim gibi "off-market" (pazarlık dışı, doğrudan vergi borçlusuna mektup atarak) arsa toplamasının önünde aşılmaz iki engel vardır:
            </p>

            <div className="space-y-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h5 className="font-bold text-xs text-slate-800 mb-1">A. Veri Filtreleme ve Posta Maliyeti (Sourcing Barrier)</h5>
                <p className="text-xs text-slate-600">
                  Biz tek bir arsa bulmak için county bazında 5,000 vergi borçlusunun datasını lisanslı yazılımlarla çekeriz, filtreleriz ve her birine fiziksel mektup göndeririz. Bu kampanya tek seferde $3,000+ posta bütçesi ve veri mühendisliği gerektirir. Sadece 1 adet ucuz arsa almak isteyen son tüketicinin bu altyapıyı kurması rasyonel değildir.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h5 className="font-bold text-xs text-slate-800 mb-1">B. Hukuki Temizlik & Hızlı Nakit (Title & Liquidity Barrier)</h5>
                <p className="text-xs text-slate-600">
                  Ucuza satılan arsaların %90'ında miras problemleri (probate), ödenmemiş geçmiş emlak vergileri veya yasal geçiş hakkı engeli (landlocked) bulunur. Biz due diligence ekibimizle bu sorunları çözüp tapuyu "clean title" (temiz tapu) haline getiririz. Son alıcı bu temizliği yapmayı bilmez ve riskten kaçınmak için temizlenmiş perakende ürüne fazla ödeme yapar.
                </p>
              </div>
            </div>
          </div>

          {/* Sütun 3 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-sm">03</span>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-700" /> Katma Değerli Hazır Paket Pazarlaması (Value-Add Package)
              </h3>
            </div>
            
            <p>
              Biz müşteriye çölün ortasında sadece soyut bir koordinat veya APN (parsel numarası) satmıyoruz. Biz ona yaşam veya yatırım hayalini kurabileceği <strong>"Kullanıma Hazır Emlak Paketi"</strong> sunuyoruz. Sunduğumuz katma değerler fiyat farkını tamamen meşrulaştırır:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-slate-200 rounded-xl text-center space-y-2">
                <div className="w-8 h-8 mx-auto rounded-full bg-cyan-50 flex items-center justify-center text-cyan-700 font-bold">✓</div>
                <h6 className="font-bold text-xs text-slate-900">Görsel & Koordinat Hazırlığı</h6>
                <p className="text-[11px] text-slate-500">Drone çekimleri, arsa köşelerinin GPS koordinatları ile işaretlenmesi ve yola cephesinin net kanıtlanması.</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-xl text-center space-y-2">
                <div className="w-8 h-8 mx-auto rounded-full bg-cyan-50 flex items-center justify-center text-cyan-700 font-bold">✓</div>
                <h6 className="font-bold text-xs text-slate-900">İmar & İzin Raporu</h6>
                <p className="text-[11px] text-slate-500">County imar dairesinden onaylı: tiny house, karavan, kampçılık veya prefabrik ev koyma kılavuzu.</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-xl text-center space-y-2">
                <div className="w-8 h-8 mx-auto rounded-full bg-cyan-50 flex items-center justify-center text-cyan-700 font-bold">✓</div>
                <h6 className="font-bold text-xs text-slate-900">Garanti & İade Güvencesi</h6>
                <p className="text-[11px] text-slate-500">Sözleşmede yer alan "30 gün içinde başka bir arsa ile takas hakkı" ve temiz tapu sigortası garantisi.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <strong>Sonuç olarak:</strong> Tıpkı bir süpermarketin tarladan kilosunu 0.50$'a aldığı patatesi yıkayıp, paketleyip, market rafında 3.50$'a satması gibidir. Alıcı tarlaya gitme maliyetini, çamurlu patatesi yıkama zahmetini ve nakliye riskini üstlenmek istemez. TerraLot, arazi sektörünün bu katma değerli "yıkama, paketleme ve finansman" rafıdır.
            </p>
          </div>

        </div>

        {/* Financial Arbitrage Illustration Table */}
        <div className="mt-10 border-t border-slate-200 pt-8">
          <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-slate-900" /> Arbitraj Durum Karşılaştırması (Case Study)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-3 border border-slate-700">Aşama</th>
                  <th className="p-3 border border-slate-700">TerraLot Maliyeti / Aksiyonu</th>
                  <th className="p-3 border border-slate-700">Müşteriye Sağlanan Fayda / Değer</th>
                  <th className="p-3 border border-slate-700">Finansal Karşılık</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-3 font-semibold bg-slate-50">1. Tedarik</td>
                  <td className="p-3">$3,700 Nakit Ödeme (Off-market mektup ile)</td>
                  <td className="p-3">Vergi borcundan ve icra riskinden kurtarılan temiz arsa.</td>
                  <td className="p-3 font-semibold text-slate-800">$3,700 (Temel Değer)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold bg-slate-50">2. Değer Katma</td>
                  <td className="p-3">Due Diligence, Yol Kontrolü, İmar Onayı Alınması</td>
                  <td className="p-3">Hemen kullanılabilir, imar engeli olmayan, sınırları belli arsa paketi.</td>
                  <td className="p-3 font-semibold text-slate-800">$7,500 (Paket Değeri)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold bg-slate-50">3. Finansman</td>
                  <td className="p-3">Banka Dışı Taksit İmkanı ($499 Peşin, $249/ay)</td>
                  <td className="p-3">Banka kredisine ihtiyaç duymadan, FICO skoru aranmadan toprak edinimi.</td>
                  <td className="p-3 font-semibold text-emerald-700">$16,200+ (Finansal Vade Toplamı)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 7 Onaylandı — Arbitraj Paketi Sunuma Hazır</span>
        </div>
      </div>
    </div>
  );
}
