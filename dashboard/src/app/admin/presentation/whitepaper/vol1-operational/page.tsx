"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Landmark } from "lucide-react";
import Link from "next/link";

export default function Vol1Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 1'i PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 1</p>
          <h1 className="text-3xl font-black text-slate-900">Yol Haritası & Operasyonel İş Planı</h1>
          <p className="text-sm text-slate-600 mt-2">İlk 30 gün kurulum, yasal kurumsal şema ve altyapı dağılımı</p>
        </div>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">1. Wyoming LLC Anonimlik ve Şirket Kurulumu</h3>
          <p>
            Operasyonlarımızın temeli, ABD'de varlık koruması (asset protection) ve gizlilik açısından en avantajlı eyalet olan <strong>Wyoming</strong>'de kurulacak olan <strong>Anonymous LLC (Anonim Şirket)</strong> yapısıdır. Wyoming yasaları uyarınca, şirket ortaklarının isimleri kamuya açık ticaret sicilinde (public records) yer almaz. Bu durum, alıcılarla çıkabilecek olası yasal uyuşmazlıklarda şahsımızın ve diğer ticari faaliyetlerimizin gizli kalmasını sağlar.
          </p>
          <p>
            LLC kurulumu, aracı kurum (Registered Agent) üzerinden $350 harç bedeliyle 3 iş günü içinde tamamlanır. Kurulum sonrasında IRS'ten vergi kimlik numarası (EIN) alınarak Mercury Bank veya Relay Financial üzerinden şirket adına kurumsal hesap açılır.
          </p>

          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">2. Stripe Taksit Sistemi & Ödeme Ağ Gatewayleri</h3>
          <p>
            Taksitli arsa satış modelinde en kritik süreç aylık ödemelerin otomatik tahsil edilmesidir. Platformumuza entegre edeceğimiz <strong>Stripe Billing</strong> API'si sayesinde alıcıların kredi kartlarından veya ABD banka hesaplarından (ACH) peşinat ve aylık taksitler otomatik çekilir. Müşteriye ödeme günü öncesinde otomatik e-posta ve WhatsApp hatırlatması iletilir. Stripe, 135+ farklı para birimiyle global tahsilat yapmamızı sağlar.
          </p>

          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">3. Operasyonel Yol Haritası ve Süreç Matrixi</h3>
          <p>
            Yatırım bütçesi serbest bırakıldıktan sonraki ilk 30 günde yapılacak tüm operasyonel adımlar ve tahmini gider kalemleri aşağıdaki tabloda detaylandırılmıştır:
          </p>

          <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden mt-4">
            <thead className="bg-slate-100 font-bold text-slate-700">
              <tr>
                <th className="p-3">Hafta</th>
                <th className="p-3">Operasyonel Adım</th>
                <th className="p-3">Bütçe</th>
                <th className="p-3">Hedeflenen Çıktı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-3 font-bold">1. Hafta</td>
                <td className="p-3">Wyoming LLC Kurulumu + Banka Hesabı</td>
                <td className="p-3 font-bold">$350</td>
                <td className="p-3">Yasal tüzel kişilik ve kurumsal hesap aktif.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">1. Hafta</td>
                <td className="p-3">Stripe Gateway & Amortizasyon Entegrasyonu</td>
                <td className="p-3 font-bold">$0</td>
                <td className="p-3">Müşteri portalı ve otomatik taksit çekim modülü hazır.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">2. Hafta</td>
                <td className="p-3">Eyalet Bazlı Sözleşmeler (Contract for Deed)</td>
                <td className="p-3 font-bold text-amber-700">$350</td>
                <td className="p-3">Avukat onaylı, tahliyesiz hızlı fesih şablonları.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">2-3. Hafta</td>
                <td className="p-3">İlk 1-2 Pilot Arsanın Satın Alınması</td>
                <td className="p-3 font-bold text-emerald-700">$5,500</td>
                <td className="p-3">Luna County ve Texas kırsalında tapu devirleri.</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">4. Hafta</td>
                <td className="p-3">Pazarlama Lansmanı & Yazılım Altyapısı</td>
                <td className="p-3 font-bold text-blue-700">$500</td>
                <td className="p-3">Facebook Ads testleri ve id.land/Proxy giderleri.</td>
              </tr>
              <tr className="bg-slate-100">
                <td className="p-3 font-black">TOPLAM</td>
                <td className="p-3 font-black text-slate-800">SMOKE TEST (PİLOT) BÜTÇESİ</td>
                <td className="p-3 font-black text-slate-900 text-base">$6,700</td>
                <td className="p-3 font-bold text-emerald-700">Riski minimize edilmiş otonom operasyon başlangıcı.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 1 Onaylandı</span>
        </div>
      </div>
    </div>
  );
}
