"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, Mail, Phone, MessageSquare, Database, Target, CheckCircle2, AlertCircle, Zap, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";

const skipTraceTools = [
  {
    name: "BatchSkipTracing",
    url: "batchskiptracing.com",
    emailHitRate: "%55–70",
    costPerRecord: "$0.17",
    bestFor: "Toplu liste — binlerce kayıt tek seferde",
    pros: ["Abonelik yok, kullandıkça öde", "Email + telefon + adres tek pakette", "CSV import/export kolay"],
    cons: ["Tek tek sorgulama yok", "Bazı veriler eski olabilir"],
    color: "border-blue-400 bg-blue-50 ring-2 ring-blue-500 shadow-md",
    badge: "🏆 BİZİM TERCİHİMİZ",
    badgeColor: "bg-blue-600 text-white shadow-sm",
  },
  {
    name: "REISkip",
    url: "reiskip.com",
    emailHitRate: "%60–75",
    costPerRecord: "$0.15",
    bestFor: "Gayrimenkul yatırımcısı odaklı — kaliteli veri",
    pros: ["Yüksek email isabeti", "DNC (Do Not Call) temizliği dahil", "Hızlı teslimat"],
    cons: ["Minimum 100 kayıt", "Aylık plan gerekli ($49+)"],
    color: "border-emerald-200 bg-emerald-50",
    badge: "Yüksek Kalite",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    name: "PropStream",
    url: "propstream.com",
    emailHitRate: "%50–65",
    costPerRecord: "$0.12 (dahili)",
    bestFor: "Hepsi bir arada: veri + skip trace + kampanya",
    pros: ["County verisi + skip trace tek platformda", "Email kampanya aracı dahil", "Absentee owner filtresi"],
    cons: ["$97/ay sabit ücret", "Email kalitesi diğerlerinden düşük"],
    color: "border-purple-200 bg-purple-50",
    badge: "All-in-One",
    badgeColor: "bg-purple-100 text-purple-800",
  },
  {
    name: "Skip Genie",
    url: "skipgenie.com",
    emailHitRate: "%45–60",
    costPerRecord: "$0.20",
    bestFor: "Küçük listeler, bireysel araştırma",
    pros: ["Tek kayıt sorgulanabilir", "Kullanımı kolay", "Mobil uygulama var"],
    cons: ["Büyük listede pahalılaşır", "Hit rate diğerlerinden düşük"],
    color: "border-amber-200 bg-amber-50",
    badge: "Bireysel Kullanım",
    badgeColor: "bg-amber-100 text-amber-800",
  },
];

const emailInfraTools = [
  { name: "Instantly.ai", role: "Email gönderim + domain warming", cost: "$37/ay", note: "En çok kullanılan cold email aracı. Günde 500+ email için otomatik domain ısıtma." },
  { name: "Smartlead.ai", role: "Multi-domain rotation + analytics", cost: "$59/ay", note: "Birden fazla domain üzerinden gönderim — spam filtresini atlatmak için kritik." },
  { name: "Lemlist", role: "Personalizasyon + görselli email", cost: "$59/ay", note: "Kişiselleştirilmiş görselli emailler — 'Your land at Cox Hollow Rd' gibi özel içerik." },
  { name: "Hunter.io", role: "Email doğrulama + format tahmini", cost: "$49/ay", note: "Gönderim öncesi email listesi doğrulama — hard bounce'u sıfıra indirir." },
  { name: "NeverBounce", role: "Email liste temizleme", cost: "$0.008/kayıt", note: "Toplu liste temizleme. 10.000 kayıt = $80. Zorunlu adım." },
];

const campaignFlow = [
  {
    step: "1",
    title: "Liste Oluştur",
    time: "Gün 1",
    description: "PropStream veya County Assessor'dan hedef parsel listesini çek. Filtre: Vakant arsa + absentee owner + 5+ yıllık sahiplik + borçsuz.",
    tool: "PropStream / County GIS",
    color: "bg-slate-900 text-white",
  },
  {
    step: "2",
    title: "Skip Trace Yap",
    time: "Gün 1",
    description: "İsim + adres listesini BatchSkipTracing'e yükle. Email + telefon verisi CSV olarak geri al. Ortalama %60 hit rate beklenir.",
    tool: "BatchSkipTracing ($0.17/kayıt)",
    color: "bg-blue-700 text-white",
  },
  {
    step: "3",
    title: "Lob Mektubu Gönder",
    time: "Gün 2",
    description: "Lob API ile fiziksel el yazısı görünümlü mektup gönder. İçinde QR kodu ile terralot.com'a yönlendirme ve teklifin detayları olsun.",
    tool: "Lob API ($0.85/mektup)",
    color: "bg-emerald-700 text-white",
  },
  {
    step: "4",
    title: "Email Listesini Doğrula",
    time: "Gün 3",
    description: "Skip trace'den gelen email listesini NeverBounce ile doğrula. Geçersiz adresleri temizle. Bu adım domain itibarını korur.",
    tool: "NeverBounce ($0.008/kayıt)",
    color: "bg-amber-700 text-white",
  },
  {
    step: "5",
    title: "İlk Email — 7. Gün",
    time: "Gün 9",
    description: "Mektuptan 7 gün sonra kısa, kişisel email at. Konusu: 'Your land on [Road Name]'. 3 cümle max. Sonunda tek soru sor.",
    tool: "Instantly.ai",
    color: "bg-purple-700 text-white",
  },
  {
    step: "6",
    title: "Follow-up Dizisi",
    time: "Gün 14–45",
    description: "Yanıt gelmeyene 7 günde bir 2 email daha gönder. Toplamda 3 email temas noktası. Sonra 30 günde bir 2. mektup.",
    tool: "Instantly.ai (otomasyon)",
    color: "bg-slate-700 text-white",
  },
];

const emailTemplates = [
  {
    label: "Email #1 — Mektup Sonrası (Gün 9)",
    subject: "Your land on [Road Name], [County] County",
    body: `Hi [First Name],

I recently sent you a letter regarding your [X acres] parcel in [County], [State].

We're actively acquiring land in that area and would be interested in making you a fair cash offer — no agents, no closing costs.

Is this something you'd be open to discussing?

Best,
[Your Name]
TerraLot Land Investment Group`,
    color: "border-blue-300 bg-blue-50",
  },
  {
    label: "Email #2 — Follow-up (Gün 16)",
    subject: "Quick follow-up — [City], [State] land",
    body: `Hi [First Name],

Just wanted to follow up on my previous note about your land in [County].

No pressure at all — just checking if you'd considered selling or if the timing isn't right.

Even if you're not ready now, I'd love to connect for the future.

Thanks,
[Your Name]`,
    color: "border-emerald-300 bg-emerald-50",
  },
  {
    label: "Email #3 — Son Deneme (Gün 30)",
    subject: "Last note about your [County] property",
    body: `Hi [First Name],

This will be my last email — I don't want to clutter your inbox.

If you ever consider selling your land in [County], I'd love to make you an offer.

You can reply here or call/text me anytime.

[Your Name] | TerraLot
[Phone] | terralot.com`,
    color: "border-amber-300 bg-amber-50",
  },
];

const complianceRules = [
  { rule: "CAN-SPAM Yasası", detail: "Her emailde unsubscribe linki zorunlu. Fiziksel adres belirtilmeli. Yanıltıcı konu satırı yasak." },
  { rule: "TCPA (SMS/Telefon)", detail: "Telefon ve SMS kampanyaları için önceden yazılı onay gerekir. Email için bu kural geçerli değil." },
  { rule: "Domain Warming", detail: "Yeni domainle günde 50'den fazla email atmayın. Haftalık artışla 3-4 haftada 500/gün'e ulaşın." },
  { rule: "Spam Tetikleyiciler", detail: "'Free', 'Guaranteed', 'Cash offer!!!' gibi ifadeler spam filtresine düşürür. Sade dil kullanın." },
  { rule: "Ayrı Domain Kullan", detail: "Ana domaininizden (terralot.com) email atmayın. Alias domain kurun: outreach.terralot.com gibi." },
];

export default function Vol16Page() {
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
        <div className="border-b-4 border-slate-900 pb-6 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 16</p>
          <h1 className="text-3xl font-black text-slate-900">Arsa Sahibi Erişim Stratejisi: Email + Mektup Omnichannel</h1>
          <p className="text-sm text-slate-600 mt-2">Skip tracing ile email bulma, Lob + cold email kombinasyonu, şablon metinler ve yasal uyumluluk</p>
        </div>

        <div className="space-y-12 text-sm text-slate-700 leading-relaxed">

          {/* Giriş */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 flex items-center gap-2">
              <Target className="w-5 h-5" /> Gerçek Cevap: Email Tek Başına Çalışmaz
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <span className="font-black text-red-800 block mb-1">❌ Sadece Email</span>
                <span className="text-slate-600">Yanıt oranı: %0.1–1. Spam algısı. Domain itibarı risk altında. Düşük güven.</span>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="font-black text-amber-800 block mb-1">⚠️ Sadece Lob Mektup</span>
                <span className="text-slate-600">Yanıt oranı: %2–5. Güvenilir ama tek temas. Takip yok. Kayıp lead riski.</span>
              </div>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="font-black text-emerald-800 block mb-1">✅ Mektup + Email Kombini</span>
                <span className="text-slate-600">Yanıt oranı: %4–8. Araştırmalar: kombinasyon yanıtı %63 artırıyor. Altın standart.</span>
              </div>
            </div>
          </div>

          {/* Skip Trace Araçları */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-blue-600 pl-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-700" /> Skip Tracing Araçları — Email Bulmak İçin
            </h2>
            <p className="text-xs text-slate-600">County Assessor'dan sahibin adını aldıktan sonra bu araçlar email + telefon numarasını appende eder. <strong>Bizim kesin tercihimiz BatchSkipTracing'dir çünkü aylık abonelik kitlemez.</strong></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {skipTraceTools.map((t, i) => (
                <div key={i} className={`border rounded-2xl p-4 space-y-3 ${t.color}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-black text-slate-900">{t.name}</h3>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${t.badgeColor}`}>{t.badge}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">{t.url}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block text-sm">{t.costPerRecord}</span>
                      <span className="text-[10px] text-slate-500">kayıt başı</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/70 rounded-lg p-2">
                      <span className="text-[10px] text-slate-500 block font-bold">Email Hit Rate</span>
                      <span className="font-black text-emerald-700">{t.emailHitRate}</span>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2">
                      <span className="text-[10px] text-slate-500 block font-bold">En İyi Kullanım</span>
                      <span className="text-slate-700">{t.bestFor}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-0.5">
                      {t.pros.map((p, j) => <div key={j} className="flex items-start gap-1"><span className="text-emerald-600 shrink-0">✓</span><span className="text-slate-700">{p}</span></div>)}
                    </div>
                    <div className="space-y-0.5">
                      {t.cons.map((c, j) => <div key={j} className="flex items-start gap-1"><span className="text-red-500 shrink-0">✗</span><span className="text-slate-700">{c}</span></div>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kampanya Akışı */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-emerald-600 pl-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-700" /> 45 Günlük Omnichannel Kampanya Akışı
            </h2>
            <div className="space-y-2">
              {campaignFlow.map((f, i) => (
                <div key={i} className="flex gap-4 items-stretch">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${f.color}`}>{f.step}</div>
                  <div className="flex-1 border border-slate-200 rounded-xl p-4 bg-slate-50 grid grid-cols-1 md:grid-cols-4 gap-2 items-center text-xs">
                    <div className="md:col-span-1">
                      <span className="font-black text-slate-900 block">{f.title}</span>
                      <span className="text-slate-500 text-[10px]">{f.time}</span>
                    </div>
                    <div className="md:col-span-2 text-slate-700">{f.description}</div>
                    <div className="text-right">
                      <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-2 py-1 rounded-lg">{f.tool}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email Şablonları */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-purple-600 pl-3 flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-700" /> Hazır Email Şablonları (İngilizce)
            </h2>
            <div className="space-y-4">
              {emailTemplates.map((tpl, i) => (
                <div key={i} className={`border rounded-2xl p-5 space-y-2 ${tpl.color}`}>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide block">{tpl.label}</span>
                  <div className="bg-white rounded-xl p-4 space-y-2 text-xs font-mono text-slate-800">
                    <div className="border-b border-slate-100 pb-2">
                      <span className="text-slate-400 text-[10px] block">KONU:</span>
                      <span className="font-bold">{tpl.subject}</span>
                    </div>
                    <pre className="whitespace-pre-wrap text-slate-700 text-xs font-mono">{tpl.body}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email Altyapı Araçları */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-amber-600 pl-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-700" /> Email Altyapı Araçları
            </h2>
            <div className="space-y-2">
              {emailInfraTools.map((t, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs items-center">
                  <span className="font-black text-slate-900">{t.name}</span>
                  <span className="text-slate-600">{t.role}</span>
                  <span className="font-bold text-blue-700">{t.cost}</span>
                  <span className="text-slate-600">{t.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Yasal Uyumluluk */}
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-700" /> Yasal Uyumluluk — Mutlaka Bilinmesi Gerekenler
            </h3>
            <div className="space-y-2">
              {complianceRules.map((r, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 bg-white border border-amber-100 rounded-xl text-xs">
                  <span className="font-black text-amber-800">{r.rule}</span>
                  <span className="text-slate-700 md:col-span-3">{r.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Maliyet Hesabı */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> 1.000 Sahip İçin Kampanya Maliyet Hesabı
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                ["Skip Trace (1.000 kayıt × $0.17)", "$170"],
                ["Email Doğrulama (1.000 × $0.008)", "$8"],
                ["Lob Mektup (1.000 × $0.85)", "$850"],
                ["Email Aracı (Instantly.ai)", "$37/ay"],
                ["TOPLAM 1. Ay", "$1,065"],
                ["Beklenen Yanıt (%5 = 50 kişi)", "50 lead"],
                ["Dönüşüm (%10 alım = 5 arsa)", "5 alım"],
                ["Kampanya başına ROI (5 × $8K margin)", "~$40,000"],
              ].map(([label, val], i) => (
                <div key={i} className={`rounded-xl p-3 border space-y-1 ${i >= 4 ? "border-emerald-500 bg-emerald-900/30" : "border-white/10 bg-white/10"}`}>
                  <span className="text-slate-400 text-[10px] block">{label}</span>
                  <span className={`font-black text-lg block ${i >= 4 ? "text-emerald-400" : "text-white"}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 16 — Email + Mektup Omnichannel Strateji</span>
        </div>
      </div>
    </div>
  );
}
