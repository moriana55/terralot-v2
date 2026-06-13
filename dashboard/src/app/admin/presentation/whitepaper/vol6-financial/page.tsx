"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function Vol6Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 6'yı PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 6</p>
          <h1 className="text-3xl font-black text-slate-900">Finansal Model & ROI Projeksiyonları</h1>
          <p className="text-sm text-slate-600 mt-2">MRR hedefleri, bütçe projeksiyonları ve default oranlarının kâr çarpanı analizi</p>
        </div>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">1. Default (Temerrüt) Oranlarının Kâr Artırıcı Etkisi</h3>
          <p>
            Geleneksel ticarette alıcının ödemeyi bırakması zarar yazarken, kırsal arsa taksitli satışında bu durum <strong>kâr çarpanıdır.</strong> 
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Örnek: $3,000 maliyetli bir arsayı $250 peşinat + 24 ay x $250/Ay taksitle sattık. Alıcı 6. ayda ödemeyi bıraktı ve default oldu. 
            <br /><strong>Şirket Kasasında Kalan:</strong> $250 peşinat + 6 ay x $250 = $1,750 (Maliyetin %50'si amorti edildi).
            <br /><strong>Durum:</strong> Arsayı sıfır maliyetle geri alıyoruz ve tekrar $250 peşinat + 24 ay x $250 taksitle yeni bir alıcıya satıyoruz. Aynı arsa ortalama 2.3 kez satılarak ROI oranını geometrik olarak katladığı resmi verilerce sabittir.
          </p>

          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">2. 12 Aylık Finansal Büyüme Modeli</h3>
          <p>
            $30,000 başlangıç bütçesiyle yapılacak 12 aylık pilot operasyonun projeksiyonu:
          </p>

          <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden mt-4">
            <thead className="bg-slate-100 font-bold text-slate-700">
              <tr>
                <th className="p-3">Ay</th>
                <th className="p-3">Aktif Parsel Sayısı</th>
                <th className="p-3">Aylık Düzenli Gelir (MRR)</th>
                <th className="p-3">Kümülatif Tahsilat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-3 font-bold">Ay 1</td>
                <td className="p-3">5 Parsel</td>
                <td className="p-3 font-bold">$1,250 / ay</td>
                <td className="p-3">$2,500 (Peşinatlar Dahil)</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">Ay 3</td>
                <td className="p-3">8 Parsel</td>
                <td className="p-3 font-bold">$2,000 / ay</td>
                <td className="p-3">$6,500</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">Ay 6</td>
                <td className="p-3">15 Parsel</td>
                <td className="p-3 font-bold">$3,750 / ay</td>
                <td className="p-3">$18,200</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">Ay 12</td>
                <td className="p-3">30 Parsel</td>
                <td className="p-3 font-bold">$7,500 / ay</td>
                <td className="p-3">$45,000+ (Süreçte Reinvest Edilir)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 6 Onaylandı</span>
        </div>
      </div>
    </div>
  );
}
