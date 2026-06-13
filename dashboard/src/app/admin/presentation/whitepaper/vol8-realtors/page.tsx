"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Building2, BadgePercent, Coins, ArrowRight, CheckCircle2, UserCheck, Milestone } from "lucide-react";
import Link from "next/link";

export default function Vol8Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 8'i PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 8</p>
          <h1 className="text-3xl font-black text-slate-900">B2B Emlakçı & Acente Ortaklığı Modeli</h1>
          <p className="text-sm text-slate-600 mt-2">Lisanslı emlak acenteleri (Realtors) üzerinden para kazanma modelinin en sade, adım adım açıklaması</p>
        </div>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">
          
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-2">Özet Mantık: Emlakçılar Neden Bizimle Çalışır?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Amerika'da emlakçılar arsa satmayı hiç sevmez. Çünkü $15,000'lık bir arsanın komisyonu çok düşüktür ($450) ve bankalar arsaya kredi vermediği için alıcı bulamazlar. Biz emlakçılara hem satamadıkları arsaları sattırıyoruz hem de boşa giden datalarından oturduğumuz yerden para kazanıyoruz.
            </p>
          </div>

          <div className="space-y-8">
            <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">3 Temel B2B İş Modeli (Adım Adım Çalışma Senaryoları)</h3>
            
            {/* Sütun 1: Detaylı Referral */}
            <div className="p-6 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-2">
                <Coins className="w-5 h-5 text-emerald-700" /> 1. Perakende İlan Yönlendirme (Referral Commissions)
              </h4>
              <p className="text-xs text-slate-600">
                Mektup kampanyalarımızda arsa sahiplerine <em>"Arsanızı $3,700 nakit paraya hemen alalım"</em> diye mektup atarız. Bazı satıcılar geri döner ve der ki: <strong>"Arsamı satmak istiyorum ama $3,700 çok az, benimki piyasada $15,000 eder."</strong> Biz bu arsayı $15,000 verip ALAMAYIZ (kâr marjımız kalmaz, nakitimiz bağlanır). Normalde bu müşteri çöpe gider.
              </p>
              
              <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-3">
                <span className="text-xs font-bold text-emerald-900 block">Basit Senaryo (Adım Adım Nasıl Çalışır?):</span>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-emerald-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <p><strong>Datayı Paslarız:</strong> Robert ismindeki bu satıcının bilgilerini, bölgede çalışan yerel emlakçımız John'a veririz.</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-emerald-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <p><strong>Emlakçı Satışı Yapar:</strong> John arsayı MLS'e yükler ve piyasa fiyatı olan $15,000'a başka birine satar. John bu satıştan %10 (yani $1,500) komisyon kazanır.</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-emerald-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <p><strong>Payımızı Alırız:</strong> Emlakçı John, aramızdaki referans sözleşmesi gereği kazandığı $1,500 komisyonun %30'unu (yani <strong>$450</strong>) bize gönderir.</p>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-800 bg-white p-2.5 rounded-lg border border-emerald-100/60 font-semibold mt-2">
                  ✓ Sonuç: Sıfır lira para bağlayarak, arsayı hiç satın almadan, sadece mektup datamızdan emlakçı sayesinde oturduğumuz yerden $450 komisyon kazandık.
                </div>
              </div>
            </div>

            {/* Sütun 2: Detaylı Co-Brokerage */}
            <div className="p-6 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-2">
                <Building2 className="w-5 h-5 text-amber-700" /> 2. MLS ve Satış Ortaklığı Gücü (MLS Co-Brokerage)
              </h4>
              <p className="text-xs text-slate-600">
                Bizim satın aldığımız arsaları MLS (Amerika'nın ortak ilan sistemi) üzerine koyarız ve emlakçılara %10 gibi yüksek bir komisyon vaat ederiz.
              </p>
              
              <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100 space-y-3">
                <span className="text-xs font-bold text-amber-900 block">Basit Senaryo (Adım Adım Nasıl Çalışır?):</span>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-amber-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <p><strong>Emlakçı Müşteri Getirir:</strong> Çevredeki emlakçılar, cebinde peşin $15,000 nakiti olmayan veya banka kredi notu düşük olan alıcılarını bizim arsamıza yönlendirir.</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-amber-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <p><strong>Finansmanı Açarız:</strong> Alıcıya kredi kontrolsüz $499 peşinat ve aylık $249 taksit imkanımızı sunarız. Emlakçı satışı hemen kapatır.</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-amber-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <p><strong>Komisyonu Veririz:</strong> Biz emlakçıya komisyonunu peşin öderiz. Karşılığında aylık düzenli taksit ödeyen uzun vadeli bir müşteri kazanmış oluruz.</p>
                  </div>
                </div>
                <div className="text-[11px] text-amber-800 bg-white p-2.5 rounded-lg border border-amber-100/60 font-semibold mt-2">
                  ✓ Sonuç: Emlakçılar bizim için ücretsiz çalışan birer satış temsilcisi haline gelir. Reklam bütçesi harcamadan arsaları hızla eritiriz.
                </div>
              </div>
            </div>

            {/* Sütun 3: Detaylı SaaS */}
            <div className="p-6 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-2">
                <BadgePercent className="w-5 h-5 text-cyan-700" /> 3. SaaS - Platform Kiralama (Platform-as-a-Service)
              </h4>
              <p className="text-xs text-slate-600">
                Piyasada kendi arsalarını taksitle (Owner Financing) satmak isteyen başka arsa sahipleri ve emlakçılar da vardır. Ancak taksitle satıldığında karttan parayı her ay kimin çekeceği, borç takibi, ödemeyen alıcılara ihtar yollama gibi yasal ve yazılımsal süreçler büyük bir operasyonel yüktür.
              </p>
              
              <div className="bg-cyan-50/40 p-4 rounded-xl border border-cyan-100 space-y-3">
                <span className="text-xs font-bold text-cyan-900 block">Basit Senaryo (Adım Adım Nasıl Çalışır?):</span>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-cyan-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <p><strong>Altyapımızı Kiralarız:</strong> Başka bir arsa satıcısı, kendi alıcısını bizim sisteme kaydeder. Kayıt için bize tek seferlik <strong>$299 kurulum ücreti</strong> öder.</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-cyan-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <p><strong>Sistem Otomatik Yönetir:</strong> Panelimiz alıcının kartından her ay taksidi çeker, satıcının hesabına aktarır ve kalan borç tablosunu günceller.</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-5 h-5 bg-cyan-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <p><strong>Aylık Servis Bedeli Alırız:</strong> Sistemimiz bu takip ve tahsilat hizmeti karşılığında aktif sözleşme başına her ay <strong>$29 servis ücreti</strong> keser.</p>
                  </div>
                </div>
                <div className="text-[11px] text-cyan-800 bg-white p-2.5 rounded-lg border border-cyan-100/60 font-semibold mt-2">
                  ✓ Sonuç: Hiç toprak alıp satmadan, sadece geliştirdiğimiz yazılımsal altyapıyı başkalarına kiralayarak aylık düzenli pasif abonelik geliri elde ederiz.
                </div>
              </div>
            </div>

          </div>

          {/* Finansal Simülasyon Tablosu */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">B2B Yıllık Ek Gelir Potansiyeli Simülasyonu</h3>
            <p className="text-xs text-slate-600">
              Yalnızca 10 yerel emlakçı ile kurulacak aktif iş birliği ağının getireceği ek gelir simülasyonu:
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden mt-2">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-3">Gelir Kanalı</th>
                    <th className="p-3">Hacim (Yıllık)</th>
                    <th className="p-3">TerraLot Komisyon/Servis Payı</th>
                    <th className="p-3">Tahmini Yıllık Ek Net Kâr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-3 font-semibold">Referral (İlan Yönlendirme)</td>
                    <td className="p-3">15 Başarılı Satış Ortaklığı (Ort. $15k Değer)</td>
                    <td className="p-3">%30 Referral Fee (Satış başına ~$1,350)</td>
                    <td className="p-3 font-semibold text-emerald-700">+$20,250</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">MLS Co-Broke Satış</td>
                    <td className="p-3">25 Kendi Arsamızın Emlakçılarca Satılması</td>
                    <td className="p-3">Hızlı Satış & Düşük Pazarlama Maliyeti</td>
                    <td className="p-3 font-semibold text-emerald-700">+$37,500 (Vade Tasarrufu)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">SaaS Platform Kiralama</td>
                    <td className="p-3">5 Emlak Ofisi, 100 Aktif Taksitli Sözleşme</td>
                    <td className="p-3 text-[11px]">$299 kurulum + $29/ay sözleşme takip ücreti</td>
                    <td className="p-3 font-semibold text-emerald-700">+$36,295</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="p-3" colSpan={3}>Toplam Yıllık B2B Ek Gelir Potansiyeli:</td>
                    <td className="p-3 text-emerald-800">+$94,045</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 8 Onaylandı — B2B Acente Paketi Hazır</span>
        </div>
      </div>
    </div>
  );
}
