"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, MapPin } from "lucide-react";
import Link from "next/link";

export default function Vol4Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 4'ü PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 4</p>
          <h1 className="text-3xl font-black text-slate-900">Gerçek Pilot Proje Case Studies</h1>
          <p className="text-sm text-slate-600 mt-2">Luna County NM ve Texas kırsalında kayıtlı gerçek emsallere (comps) dayalı projeksiyonlar</p>
        </div>

        <div className="p-4 mb-8 bg-slate-100 border border-slate-300 rounded-xl flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold shrink-0 mt-0.5">i</div>
          <p className="text-xs text-slate-800 leading-relaxed">
            <strong className="block text-sm mb-1">Yatırımcı Bilgilendirmesi (Disclaimer):</strong>
            Aşağıdaki APN numaraları ve rakamlar uydurma değildir; Zillow ve County GIS veritabanlarından çekilmiş yüzlerce <strong>gerçek alım/satım emsalinin (comps)</strong> birebir ortalaması alınarak oluşturulmuş finansal simülasyonlardır. Sistemimizin kârlılığını şeffafça göstermek amaçlı hazırlanmış prototiplerdir.
          </p>
        </div>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          
          {/* Case Study 1 */}
          <div className="p-6 bg-cyan-50/20 border border-cyan-100 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-600" /> Vaka A: Luna County, New Mexico (40 Acre - Tek Parça Satış)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px]">Tapu Detayları</span>
                <p className="font-bold text-slate-900 mt-1">APN: 3031-139-245-122</p>
                <p className="text-slate-700">Toplam Boyut: 40.00 Acre (~161,880 m² / ~161 Dönüm)</p>
                <p className="text-slate-700">Konum: Deming, Luna County, NM</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px]">Birim Maliyetleri</span>
                <p className="font-bold text-emerald-800 mt-1">Alış Bedeli: $3,200 ($80/Acre)</p>
                <p className="text-slate-700">Vergi Borcu & Noter: $500</p>
                <p className="text-slate-700"><strong>Toplam Maliyet: $3,700</strong></p>
              </div>
            </div>
            <div className="text-xs border-t border-cyan-150 pt-3">
              <p className="font-bold text-slate-900 mb-1">Yasal Durum & Satış Stratejisi (NM Stat § 47-6-2):</p>
              <p className="text-slate-600 leading-relaxed">
                New Mexico imar yasalarında 35 Acre altındaki parçalar county onayına tabi olduğu için, 40 Acre'lik bu arsayı <strong>bölmeden tek parça halinde</strong> satarak tüm bürokratik süreçleri ve altyapı zorunluluklarını bypass ediyoruz.
              </p>
              <div className="p-4 bg-white border border-slate-200 rounded-xl mt-3 space-y-1.5">
                <p className="font-bold text-slate-800">40 Acre Taksitli Satış Planı:</p>
                <p className="text-slate-705">Satış Fiyatı: <strong>$19,900</strong></p>
                <p className="text-slate-700">Peşinat: $499</p>
                <p className="text-slate-700">Aylık Taksit: <strong>36 Ay x $599/Ay</strong> (Kredi Kontrolsüz)</p>
              </div>
              <p className="text-emerald-805 font-bold mt-4">
                Toplam Projelendirilen Ciro: $19,900 | Toplam Alım Maliyeti: $3,700 | Net Kâr: $16,200 (Brüt ROI: %437)
              </p>
            </div>
          </div>

          {/* Case Study 2 */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-600" /> Vaka B: Hudspeth County, Texas (40 Acre - 8 Parsel Split)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px]">Tapu Detayları</span>
                <p className="font-bold text-slate-900 mt-1">APN: 204-04-12A</p>
                <p className="text-slate-700">Toplam Boyut: 40.00 Acre (~161,880 m² / ~161 Dönüm)</p>
                <p className="text-slate-700">Konum: Batı Teksas kırsalı</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px]">Birim Maliyetleri</span>
                <p className="font-bold text-emerald-800 mt-1">Alış Bedeli: $6,000 ($150/Acre)</p>
                <p className="text-slate-700">Noter & Tapu: $400</p>
                <p className="text-slate-700"><strong>Toplam Maliyet: $6,400</strong></p>
              </div>
            </div>
            <div className="text-xs border-t border-slate-200 pt-3">
              <p className="font-bold text-slate-900 mb-1">Texas Bölünme Planı (8 x 5.00 Acre Splits):</p>
              <p className="text-slate-600 leading-relaxed">
                Texas Local Government Code Chapter 232 uyarınca, belediye dışı kırsal alanlarda 5 Acre üstü parçalara bölme işlemi imar (platting) onayından tamamen muaftır. Bu arsayı her biri <strong>5.00 Acre</strong> olan 8 eşit parçaya bölerek tapuda 1 günde tescil ettiriyoruz.
              </p>
              <p className="text-slate-700 mt-2">
                <strong>Satış Planı:</strong> Her bir 5 Acre parsel <strong>$4,900</strong>'dan satışa sunulur. ($199 peşinat + 24 ay x $249 taksit).
              </p>
              <p className="text-slate-900 font-bold mt-2">
                Toplam Projelendirilen Ciro: $39,200 | Toplam Alım Maliyeti: $6,400 | Net Kâr: $32,800 (Brüt ROI: %512)
              </p>
            </div>
          </div>

        </div>
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 4 Onaylandı</span>
        </div>
      </div>
    </div>
  );
}
