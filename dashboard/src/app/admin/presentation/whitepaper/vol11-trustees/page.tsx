"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, ShieldAlert, Scale, Building2, Coins, Calendar, HelpCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function Vol11Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 11'i PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 11</p>
          <h1 className="text-3xl font-black text-slate-900">Trustee (Yediemin) Aracı Kurumları & Tahliye Hizmetleri</h1>
          <p className="text-sm text-slate-600 mt-2">Amerika'da mahkemesiz icra (Non-Judicial Foreclosure) yürüten lisanslı aracı kurumlar ve maliyetleri</p>
        </div>

        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">
          
          {/* Nedir Bölümü */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">Trustee (Yediemin / İcra Aracısı) Nedir?</h3>
            <p>
              California, Texas, Tennessee ve Arizona gibi eyaletlerde taksitli arsa satışı yaparken <strong>Deed of Trust (İpotek Belgesi)</strong> kullanılır. Bu sistemde tapu dairesine kayıtlı üçüncü bir bağımsız kurum yer alır. Bu kuruma <strong>Trustee (Yediemin)</strong> denir. 
              <br />
              Alıcı ödemeyi kestiğinde, satıcı mahkemeye gitmez. Yetkili Trustee firmasına başvurarak tapunun mahkemesiz olarak geri alınması sürecini (Non-Judicial Foreclosure) başlatır.
            </p>
          </div>

          {/* Lisanslı Trustee Şirketleri */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">Amerika'daki Lisanslı Resmi Trustee Firmaları</h3>
            <p className="text-xs text-slate-600">
              Rakiplerimizin (Landio vb.) California ve diğer pahalı eyaletlerde taksitli satışları geri almak için resmi olarak çalıştığı lisanslı kurumlar ve ortalama işlem masrafları:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Kurum 1 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block text-xs">• Allied Trustee Services</span>
                <p className="text-[11px] text-slate-600">
                  <strong>Hizmet Alanı:</strong> California, Nevada, Arizona.
                  <br />
                  <strong>Ortalama Masraf:</strong> İşlem başına 1,500$ ile 2,200$ arası dosya ücreti alırlar.
                  <br />
                  <strong>Özellik:</strong> Kırsal boş arazilerin mahkemesiz icra işlemlerinde en hızlı çalışan butik kurumlardan biridir.
                </p>
              </div>

              {/* Kurum 2 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block text-xs">• First American Title (Foreclosure Division)</span>
                <p className="text-[11px] text-slate-600">
                  <strong>Hizmet Alanı:</strong> Ulusal (Tüm ABD eyaletleri).
                  <br />
                  <strong>Ortalama Masraf:</strong> 1,800$ ile 2,500$ arası işlem ve tescil bedeli.
                  <br />
                  <strong>Özellik:</strong> Amerika'nın en büyük tapu sigortası devlerinden biridir. Güvenilirdir ancak bürokratik süreci ağırdır.
                </p>
              </div>

              {/* Kurum 3 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block text-xs">• Fidelity National Title (Trustee Services)</span>
                <p className="text-[11px] text-slate-600">
                  <strong>Hizmet Alanı:</strong> Batı ve Güney eyaletleri (Texas, Tennessee dahil).
                  <br />
                  <strong>Ortalama Masraf:</strong> 2,000$ ile 2,700$ arası dosya ücreti.
                  <br />
                  <strong>Özellik:</strong> Hukuki altyapısı çok güçlüdür. Tapu temizleme (Quiet Title) garantisiyle süreci yürütürler.
                </p>
              </div>

              {/* Kurum 4 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block text-xs">• T.D. Service Company</span>
                <p className="text-[11px] text-slate-600">
                  <strong>Hizmet Alanı:</strong> California, Arizona, Washington.
                  <br />
                  <strong>Ortalama Masraf:</strong> 1,600$ ile 2,300$ arası hizmet bedeli.
                  <br />
                  <strong>Özellik:</strong> Sadece icra ve temerrüt takibi üzerine odaklanmış bağımsız bir servis sağlayıcıdır.
                </p>
              </div>

            </div>
          </div>

          {/* Süreç Akışı */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">Mahkemesiz İcra (Non-Judicial Foreclosure) Adım Adım İşleyişi</h3>
            <p className="text-xs text-slate-600">
              Alıcı ödemeyi kestiğinde Trustee üzerinden yürütülen yasal süreç şu 3 adımdan oluşur:
            </p>

            <div className="space-y-3">
              <div className="p-4 border border-slate-200 rounded-xl flex gap-3 items-start">
                <span className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Notice of Default (NOD - Temerrüt İhbarı) Tescili</h5>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Alıcı taksidini 30 gün geciktirdiğinde satıcı Trustee'ye başvurur. Trustee resmi temerrüt ihbarnamesini tapu dairesine (County Recorder) tescil ettirir ve alıcıya noterli olarak gönderir. Yasa gereği alıcıya borcunu kapatması için <strong>90 gün (3 ay)</strong> süre verilir.
                  </p>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl flex gap-3 items-start">
                <span className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Notice of Trustee Sale (NOS - Satış İlanı)</h5>
                  <p className="text-[11px] text-slate-600 mt-1">
                    90 gün geçmesine rağmen alıcı borcunu ödemezse, Trustee arsanın açık artırmayla satılacağını ilan eder. Bu ilan tapuya tescil edilir ve yerel gazetede 3 hafta boyunca yayınlanır. Alıcıya verilen son süre <strong>21 gündür</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl flex gap-3 items-start">
                <span className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Açık Artırma (Trustee Auction) & Tapu Geri Alımı</h5>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Belirlenen gün ve saatte arsa adliye önünde açık artırmaya çıkarılır. Eğer borç miktarını ödeyen üçüncü bir alıcı çıkmazsa (ki kırsal arsalarda genellikle çıkmaz), Trustee arsayı otomatik olarak satıcıya (bize) devreder. Tapu temiz bir şekilde envanterimize geri döner.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
              * Not: Bu 4-5 aylık süreç ve 2,000 dolarlık maliyet, lüks segment arsa satan rakipler için kabul edilebilirdir. Ancak TerraLot'un 16,200 dolarlık ucuz ve hızlı sürüm modelinde bu masraflardan kaçınmak için süreçleri mahkemesiz ve Trustee masrafsız (Contract for Deed ile 30 günde ve 0 masrafla) tamamlayabildiğimiz New Mexico ve Texas gibi eyaletleri tercih ediyoruz.
            </p>
          </div>

        </div>

        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 11 Onaylandı — Trustee Verileri Hazır</span>
        </div>
      </div>
    </div>
  );
}
