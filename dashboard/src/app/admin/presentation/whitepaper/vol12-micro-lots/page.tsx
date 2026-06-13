"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Coins, TrendingUp, BadgePercent, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";

const payments = [
  {
    label: "Peşin (Nakit)",
    term: "Tek Seferlik",
    apr: "—",
    monthly: "—",
    total: 8450,
    interest: 0,
    discount: "10% İndirim",
    tag: "Hızlı Kâr",
    color: "bg-amber-50 border-amber-300",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  {
    label: "1 Yıl",
    term: "12 Ay",
    apr: "%1.0",
    monthly: 796.56,
    total: 9558,
    interest: 169,
    discount: null,
    tag: "En Az Faiz",
    color: "bg-slate-50 border-slate-200",
    badgeColor: "bg-slate-100 text-slate-700",
  },
  {
    label: "2 Yıl",
    term: "24 Ay",
    apr: "%3.5",
    monthly: 415.53,
    total: 9973,
    interest: 584,
    discount: null,
    tag: null,
    color: "bg-slate-50 border-slate-200",
    badgeColor: "bg-slate-100 text-slate-700",
  },
  {
    label: "3 Yıl",
    term: "36 Ay",
    apr: "%4.5",
    monthly: 289.19,
    total: 10411,
    interest: 1022,
    discount: null,
    tag: null,
    color: "bg-slate-50 border-slate-200",
    badgeColor: "bg-slate-100 text-slate-700",
  },
  {
    label: "4 Yıl",
    term: "48 Ay",
    apr: "%5.5",
    monthly: 228.26,
    total: 10957,
    interest: 1568,
    discount: null,
    tag: null,
    color: "bg-slate-50 border-slate-200",
    badgeColor: "bg-slate-100 text-slate-700",
  },
  {
    label: "5 Yıl",
    term: "60 Ay",
    apr: "%6.5",
    monthly: 193.61,
    total: 11617,
    interest: 2228,
    discount: null,
    tag: "En Popüler",
    color: "bg-emerald-50 border-emerald-300",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    label: "6 Yıl",
    term: "72 Ay",
    apr: "%7.5",
    monthly: 172.24,
    total: 12401,
    interest: 3012,
    discount: null,
    tag: "Max Kazanç",
    color: "bg-blue-50 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-800",
  },
];

// Satın alım maliyeti (toptan)
const COST = 1800;

export default function Vol12Page() {
  const reportRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      {/* Top Nav */}
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 12'yi PDF Olarak Kaydet
        </button>
      </div>

      <div ref={reportRef} className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="border-b-4 border-slate-900 pb-6 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 12</p>
          <h1 className="text-3xl font-black text-slate-900">Mikro-Arsa Segmenti & LandZero Vaka Analizi</h1>
          <p className="text-sm text-slate-600 mt-2">Rakip LandZero'nun Florida ilanındaki tüm 7 ödeme seçeneğinin matematik ve kâr analizi</p>
        </div>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">

          {/* Giriş */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3">LandZero Florida Lot — Gerçek İlan Analizi</h2>
            <p>
              LandZero, Florida'nın Putnam County bölgesinde bulunan <strong>0.22 Acre (yaklaşık 900 m²)</strong> büyüklüğündeki bir mikro-arsayı listede <strong>$9,389 fiyatla</strong> satışa çıkarmıştır.
              Tahmini toptan alım maliyeti <strong>$1,500 – $2,000</strong> aralığındadır. Aşağıdaki tabloda bu ilanın <strong>7 farklı ödeme seçeneğinin tamamı</strong> matematiksel olarak incelenmiştir.
            </p>
          </div>

          {/* Ödeme Seçenekleri Tablosu */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-emerald-600 pl-3 flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-700" />
              7 Ödeme Seçeneği — Tam Kâr & Faiz Tablosu
            </h2>
            <p className="text-xs text-slate-500">* Satın alım maliyeti (toptan) ≈ $1,800 | Liste fiyatı: $9,389</p>

            {/* Tablo Header */}
            <div className="hidden md:grid grid-cols-7 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1 border-b border-slate-200">
              <span>Seçenek</span>
              <span>Vade</span>
              <span>Yıllık Faiz</span>
              <span>Aylık Ödeme</span>
              <span>Toplam Tutar</span>
              <span>Faiz Kazancı</span>
              <span>Kâr Çarpanı</span>
            </div>

            <div className="space-y-2">
              {payments.map((p, i) => {
                const multiplier = (p.total / COST).toFixed(1);
                return (
                  <div key={i} className={`border rounded-xl px-4 py-3 grid grid-cols-2 md:grid-cols-7 gap-x-2 gap-y-1 items-center ${p.color}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{p.label}</span>
                      {p.tag && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.tag}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 font-medium">{p.term}</span>
                    <span className="text-xs text-slate-700 font-semibold">{p.apr}</span>
                    <span className="text-xs font-bold text-slate-900">
                      {p.monthly !== "—" ? `$${p.monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}/ay` : <span className="text-amber-700 font-bold">$8,450 tek ödeme</span>}
                    </span>
                    <span className="text-xs font-bold text-slate-900">${p.total.toLocaleString("en-US")}</span>
                    <span className={`text-xs font-bold ${p.interest > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                      {p.interest > 0 ? `+$${p.interest.toLocaleString("en-US")}` : "—"}
                    </span>
                    <span className="text-xs font-black text-blue-700">{multiplier}x</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Faiz Mühendisliği Analizi */}
          <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-700" />
              Faiz Mühendisliği: Artan APR Sistemi
            </h3>
            <p className="text-xs text-slate-700">
              LandZero vade uzadıkça <strong>faiz oranını kademeli olarak artırmaktadır</strong>. Bu strateji iki açıdan kazandırır:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white border border-blue-100 rounded-xl p-4 space-y-1">
                <span className="font-bold text-blue-800 block">1 Yıl = %1.0 APR</span>
                <span className="text-slate-600">Alıcıyı cezbetmek için düşük giriş oranı. Hızlı kapanma için cazip.</span>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl p-4 space-y-1">
                <span className="font-bold text-blue-800 block">3 Yıl = %4.5 APR</span>
                <span className="text-slate-600">Piyasa ortası oran. Alıcı için "makul" gözükür, satıcıya +$1,022 faiz getirir.</span>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl p-4 space-y-1">
                <span className="font-bold text-blue-800 block">6 Yıl = %7.5 APR</span>
                <span className="text-slate-600">Aylık $172 ödeme "ucuz" görünür. Ama toplam $12,401 = $3,012 saf faiz geliri.</span>
              </div>
            </div>
          </div>

          {/* Temerrüt Kâr Analizi */}
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-700" />
              Temerrüt (Default) Kâr Analizi — Florida Örneği
            </h3>
            <p className="text-xs text-slate-700">
              Alıcı 5 yıllık vadeyi seçer ve <strong>2 yıl düzenli ödeme yaptıktan sonra ödemeyi keser</strong>. Florida'da doğrudan arsayı el koyamayacağımız için aracı kurum (Trustee) devreye girer:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between border-b border-amber-200 pb-1">
                  <span className="text-slate-600">2 yılda tahsil edilen (24 × $193.61)</span>
                  <span className="font-bold text-slate-900">$4,647</span>
                </div>
                <div className="flex justify-between border-b border-amber-200 pb-1">
                  <span className="text-slate-600">Arsa geri alınır (Trustee / Aracı Kurum)</span>
                  <span className="font-bold text-red-600">-$1,500 Masraf</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Arsa yeniden satışa çıkarılır</span>
                  <span className="font-bold text-blue-700">+$9,389 tekrar</span>
                </div>
              </div>
              <div className="bg-white border border-amber-200 rounded-xl p-4 text-center space-y-1">
                <span className="text-[11px] text-slate-500 block">Tek Arsa — Çift Satış Geliri (Masraf Düşülmüş)</span>
                <span className="text-2xl font-black text-slate-900">$12,536</span>
                <span className="text-[10px] text-emerald-700 font-bold block">1,800$ maliyet × 6.9 Kâr Çarpanı</span>
              </div>
            </div>
          </div>

          {/* Abonelik Psikolojisi */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-slate-700" />
              "Abonelik" Tarzı Düşük Aylık Ödeme Psikolojisi
            </h2>
            <p>
              Amerikalı tüketici için aylık <strong>$172</strong>, bir Netflix + Spotify aboneliğinden biraz daha fazladır. Bu eşik psikolojik direnci sıfırlar:
            </p>
            <ul className="space-y-2 text-xs text-slate-600 pl-4 list-disc">
              <li><strong>Sıfır Kredi Çekimi:</strong> Banka reddine gerek yok, herkese açık finansman.</li>
              <li><strong>Kolay Giriş:</strong> $499 peşinat + ilk ay ödemesi ile arazi sahipliği başlar.</li>
              <li><strong>Düşük Pişmanlık Riski:</strong> Alıcı birkaç ay sonra vazgeçerse psikoljik kayıp az hissedilir — bu satıcı için tekrar-satış fırsatıdır.</li>
              <li><strong>Sürümden Kazanma:</strong> Yüzlerce mikro-arsa portföyü = istikrarlı aylık nakit akışı (MRR).</li>
            </ul>
          </div>

          {/* TerraLot için çıkarımlar */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-3">
            <h3 className="font-bold text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              TerraLot İçin Alınan Dersler
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">→</span> <span><strong className="text-white">Kademeli APR sistemi uygula:</strong> Vade uzadıkça %1'den %8'e çıkan oran şeması aynı şekilde uygulanabilir.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">→</span> <span><strong className="text-white">6 Vade Seçeneği sun:</strong> Alıcıya seçim hakkı vermek satın alma kararını hızlandırır.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">→</span> <span><strong className="text-white">Peşin indirim koy (%10):</strong> Nakit alıcıyı cezbeder, hızlı ciro sağlar, NPV kaybını minimize eder.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">→</span> <span>
                <strong>Temerrüt = Bonus Kâr (Sadece Uygun Eyaletlerde):</strong>{" "}
                TX, NM, TN, WY gibi Contract for Deed'e açık eyaletlerde sözleşme feshi mahkemesiz ve düşük maliyetle yapılır, arsa geri alınır ve tekrar satılır.{" "}
                <span className="text-red-400 font-semibold">⚠️ California, Oregon, Washington gibi tüketici dostu eyaletlerde bu yol kapalıdır</span> — orada Deed of Trust + lisanslı Trustee şirketi atanması zorunludur ve dosya başına $1,500–2,500 ekstra maliyet + ~4 aylık süreç gerekir.
              </span></li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 12 — LandZero Ödeme Mühendisliği Analizi</span>
        </div>
      </div>
    </div>
  );
}
