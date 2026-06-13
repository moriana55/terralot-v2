"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Mail } from "lucide-react";
import Link from "next/link";

export default function Vol3Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 3'ü PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 3</p>
          <h1 className="text-3xl font-black text-slate-900">Mektup & Off-Market Tedarik Akışı</h1>
          <p className="text-sm text-slate-600 mt-2">Doğrudan teklif mektubu (direct mail) metodolojisi ve veri filtreleme</p>
        </div>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">1. Veri Çekme (List Pulling) & Filtreler</h3>
          <p>
            County veritabanlarındaki tüm arazileri değil, sadece **satış ihtimali en yüksek (motivated sellers)** olan mülk sahiplerini hedefliyoruz. Bunun için şu 4 filtre uygulanır:
          </p>
          <ul className="space-y-2 text-xs text-slate-600 pl-4 list-disc">
            <li>**Out-of-State Owners:** Arazi New Mexico'da, ancak sahibi California'da yaşıyor. (Yıllardır arsayı görmemiş, satmaya en hevesli kitle).</li>
            <li>**Tax Delinquent:** En az 3 yıldır arsanın emlak vergisini (property tax) ödememiş, faiz birikmiş sahipler.</li>
            <li>**Absentee Landowners:** Bölgede hiçbir ikameti veya binası olmayan ham toprak sahipleri.</li>
            <li>**Corporate Landowner:** Miras kalmış veya iflas etmiş tüzel kişilere ait boş arsalar.</li>
          </ul>

          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">2. Lob API ile Otomatik Teklif Mektupları</h3>
          <p>
            Sistemimiz, belirlenen kriterlere uyan adresleri otomatik olarak **Lob.com** API servisine gönderir. Lob, fiziki mektupları şirkete özel antetli kağıda basıp resmi teklif sözleşmesi (Purchase Agreement) ekinde mülk sahibinin evine postalar. Mektup başı gönderim maliyeti $0.75'tır.
          </p>

          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">3. Matematiksel Teklif Formülü</h3>
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center font-mono my-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Resmi Teklif Hesaplama Algoritması</p>
            <p className="text-xl font-bold text-slate-900">Teklif Bedeli = (Market Değeri * 0.25) - Gecikmiş Vergi Borcu</p>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Örnek: Luna County'de benzer emsal (comps) satış ortalaması $12,000 olan 10 Acre bir arsanın sahibine $3,000 teklif mektubu gönderilir. Eğer arsanın $400 vergi borcu varsa teklif mektubunda net ödenecek rakam $2,600 olarak basılır.
          </p>
        </div>
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 3 Onaylandı</span>
        </div>
      </div>
    </div>
  );
}
