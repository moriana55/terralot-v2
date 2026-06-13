"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Zap, Rocket, PieChart, Target, Coins, ShieldCheck, Cog, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function Vol0Page() {
  const reportRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> PDF Olarak Kaydet
        </button>
      </div>

      <div ref={reportRef} className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="border-b-4 border-slate-900 pb-6 mb-10 text-center md:text-left">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-2">TerraLot Executive Summary</p>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Yatırımcı Özet Sayfası & İş Teklifi</h1>
          <p className="text-base text-slate-600 mt-4 max-w-3xl">Geleneksel arsa ticaretini %100 yapay zeka otomasyonu ile birleştiren, düşük riskli ve yüksek marjlı "Smoke Test" yatırım teklifi.</p>
        </div>

        <div className="space-y-12 text-sm text-slate-700 leading-relaxed">

          {/* Fırsat ve Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                <Target className="w-6 h-6 text-blue-600" /> TerraLot Modeli Nedir?
              </h2>
              <p>
                Geleneksel gayrimenkulün aksine, kırsal ham arsa pazarı banka kredisi (mortgage) verilmediği için büyük kurumsalların giremediği bir <strong>"satıcı finansmanı" (Owner Financing)</strong> cennetidir.
              </p>
              <p>
                TerraLot, ucuz eyaletlerden (TX, NM, TN) vergisi ödenmemiş parselleri doğrudan mektupla (off-market) nakit ucuza kapatır. Ardından, bunu kendi geliştirdiği ödeme platformu (Stripe + SaaS) üzerinden perakende müşterilere <strong>hiçbir kredi skoru sormadan taksitle</strong> çok daha yüksek fiyata satar.
              </p>
            </div>
            
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-black flex items-center gap-2 mb-4 text-emerald-400">
                <Zap className="w-6 h-6" /> Otomasyon Devrimi (Görsel Fabrikası)
              </h2>
              <p className="text-slate-300 mb-4">Rakipler arsa sınırlarını elle çizerken, TerraLot sistemi %100 otomatizedir:</p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>County GIS Botları:</strong> Regrid/ATTOM gibi yıllık $65K isteyen Enterprise API'ler yerine, kendi yazdığımız kazıyıcı (scraper) botlarla parsel sınırlarını devletten bedavaya çeker.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Claude AI & Puppeteer:</strong> İnsan analistlere para ödemek yerine, Zillow üzerinden fiyat analizi (comps) yapar ve arsanın pazarlama metnini kendi yazar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Sunucusuz Görsel Motoru:</strong> Bannerbear gibi aylık ücretli araçları kullanmaz; kendi Node.js kütüphaneleriyle yüksek çözünürlüklü ilan görsellerini otomatik basar.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* İş Modeli ve Kârlılık */}
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
              <PieChart className="w-6 h-6 text-purple-600" /> Kârlılık ve İş Modeli
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 bg-white p-6 rounded-2xl">
                <h3 className="font-bold text-slate-900 text-base mb-2">Risksiz Alım (Acquisition)</h3>
                <ul className="space-y-2 text-slate-600">
                  <li>• Geleneksel startupların aksine <strong>devasa yazılım bütçelerine boğulmayız</strong> (Gerilla Altyapısı).</li>
                  <li>• Sadece tapusu temiz ve piyasa değerinin (Comps) en az %50 altına satılmaya razı olunan arsaları nakit alırız.</li>
                  <li>• Banka kredisine bulaşmadan <strong>%100 varlık (tapu) garantili</strong> ve sıfır borçla ilerleriz.</li>
                </ul>
              </div>
              <div className="border border-slate-200 bg-white p-6 rounded-2xl">
                <h3 className="font-bold text-slate-900 text-base mb-2">Pasif Gelir Satışı (Disposition)</h3>
                <ul className="space-y-2 text-slate-600">
                  <li>• Aldığımız ucuz arsayı perakende müşteriye <strong>Peşinat + 60 Aylık Taksitlerle</strong> çok daha yüksek fiyattan satarız.</li>
                  <li>• Müşteri kredisi (Owner Financing) yapıldığı için, alıcı ödemeyi bıraktığı an arsa yasal olarak şirketimize geri döner (Default).</li>
                  <li>• Tüm taksit/tahsilat sistemi Stripe üzerinden insan eli değmeden <strong>otonom</strong> tahsil edilir.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Smoke Test */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-emerald-900 flex items-center gap-2">
                  <Rocket className="w-7 h-7" /> İlk Aşama: 90 Günlük "Smoke Test"
                </h2>
                <p className="text-emerald-800 mt-2">Sistemin gerçekten çalıştığını büyük sermaye riske atmadan 90 günde test ediyoruz.</p>
              </div>
              <div className="bg-white px-6 py-3 rounded-xl border border-emerald-200 shadow-sm text-center">
                <span className="block text-xs font-bold text-slate-500 uppercase">Toplam Risk Sermayesi</span>
                <span className="block text-3xl font-black text-emerald-700">~$6,700</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 bg-white p-5 rounded-2xl">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Bütçe Dağılımı</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-600">Arsa Alım Sermayesi (2-3 parsel)</span><span className="font-bold text-slate-900">$5,000 – $6,000</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">İlk Lob Mektup Kampanyası</span><span className="font-bold text-slate-900">~$425</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Yazılım ve AI Maliyeti (1 Aylık)</span><span className="font-bold text-emerald-600 text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">Gerilla + Claude API (Scale): ~$150</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Hukuk (LLC Kurulum vs.)</span><span className="font-bold text-slate-900">~$150</span></div>
                </div>
              </div>

              <div className="space-y-3 bg-white p-5 rounded-2xl">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">90 Günlük Hedef (Milestones)</h3>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex gap-2 items-start"><strong className="text-slate-900 w-12">Ay 1:</strong> AI altyapısı, şirket kurulumu ve ilk doğrudan mektup kampanyasının başlatılması.</div>
                  <div className="flex gap-2 items-start"><strong className="text-slate-900 w-12">Ay 2:</strong> Gelen tekliflerle 2-3 adet parselin ucuza nakit kapatılması. Otomatik görsellerin basılıp ilanların açılması.</div>
                  <div className="flex gap-2 items-start"><strong className="text-slate-900 w-12">Ay 3:</strong> <span className="font-bold text-emerald-700">Başarı Kriteri:</span> En az 1 arsanın Contract for Deed ile satılması ve ilk taksitin Stripe üzerinden tahsil edilmesi.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Güvence */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
            <ShieldCheck className="w-12 h-12 text-slate-400 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-900 mb-1">En Kötü Senaryo (Worst-Case Scenario)</h3>
              <p className="text-slate-600 text-sm">
                İşler planlandığı gibi gitmezse ve tek bir satış bile yapılamazsa, yatırımcı yatırdığı $7,500'ın karşılığında piyasa değeri $15,000 olan gerçek tapulara sahip olur. Sistemdeki sıfır borç (nakit alım) yapısı sayesinde para asla havaya uçmaz; arsa varlık olarak yatırımcıda kalır.
              </p>
            </div>
          </div>

        </div>

        <div className="border-t border-slate-200 pt-8 mt-16 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 0 — Executive Summary</span>
        </div>
      </div>
    </div>
  );
}
