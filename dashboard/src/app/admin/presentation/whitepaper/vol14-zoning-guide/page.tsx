"use client";

import { useRef } from "react";
import { ArrowLeft, Printer, MapPin, Home, Tractor, Trees, Building2, AlertCircle, CheckCircle2, XCircle, Zap } from "lucide-react";
import Link from "next/link";

const zoningTypes = [
  {
    code: "A-1 / AG",
    fullName: "Agricultural (Tarım Arazisi)",
    color: "border-green-400 bg-green-50",
    badgeColor: "bg-green-100 text-green-800",
    icon: Tractor,
    iconColor: "text-green-700",
    description: "Tarımsal faaliyetler için ayrılmış arazi. Genellikle büyük parseller. ABD kırsalında en yaygın zoning tipi.",
    canDo: [
      "Tarım & hayvancılık (at, inek, tavuk vb.)",
      "Müstakil ev / çiftlik evi inşaatı (tek hane)",
      "Ahır, depo, tarım yapıları",
      "Tiny Home / Barndominium (çoğu ilde)",
      "Karavan / RV park etme (bazı ilçelerde izinli)",
      "Güneş paneli çiftliği",
      "Avcılık & balıkçılık (kendi parseli içinde)",
    ],
    cannotDo: [
      "Çok katlı veya ticari yapı",
      "Parsel bölme (imar izni gerektirir)",
      "Endüstriyel tesis",
      "Konut sitesi / HOA geliştirme",
    ],
    terraNote: "TerraLot'un en çok çalıştığı tip. NM, TX, WY'daki hedef parseller genellikle A-1 veya AG kodludur.",
    usStates: ["TX", "NM", "TN", "WY", "FL", "KY"],
  },
  {
    code: "RR / R-R",
    fullName: "Rural Residential (Kırsal Konut)",
    color: "border-emerald-400 bg-emerald-50",
    badgeColor: "bg-emerald-100 text-emerald-800",
    icon: Home,
    iconColor: "text-emerald-700",
    description: "Kırsal alanda konut amaçlı kullanım. AG'den daha az tarım odaklı, ama şehir dışı sakin yaşam için ideal.",
    canDo: [
      "Müstakil tek aile evi",
      "Modüler / prefabrik ev",
      "Tiny Home (çoğu ilçede)",
      "Karavan / RV (geçici veya kalıcı, ilçeye göre)",
      "Küçük çaplı hayvancılık (at, eşek vb.)",
      "Bahçe & küçük çiftlik",
      "Küçük Airbnb / kısa kiralama (bazı ilçelerde)",
    ],
    cannotDo: [
      "Çok katlı konut",
      "Ticari işletme (market, depo vb.)",
      "Sanayi tesisi",
      "3+ birimlik apartman",
    ],
    terraNote: "Tennessee ve Florida'daki mikro-arsa ilanlarının büyük çoğunluğu RR kodludur. Alıcıya 'ev kurabilirsiniz' demek için ideal.",
    usStates: ["TN", "FL", "NC", "GA", "MO"],
  },
  {
    code: "R-1 / SFR",
    fullName: "Single Family Residential (Tek Aile Konut)",
    color: "border-blue-400 bg-blue-50",
    badgeColor: "bg-blue-100 text-blue-800",
    icon: Home,
    iconColor: "text-blue-700",
    description: "Şehir veya banliyö içindeki tek aile konut arsası. Belirli yapı standartları ve setback (mesafe) kuralları vardır.",
    canDo: [
      "Müstakil tek aile evi (izinli boyutlarda)",
      "Garaj, carport, bahçe yapıları",
      "Havuz & terrace",
      "ADU (Accessory Dwelling Unit) — bazı eyaletlerde",
      "Home office (ticari tabela olmadan)",
    ],
    cannotDo: [
      "İkinci bağımsız konut birimi (çoğu ilçede)",
      "Hayvan barındırma / tarım",
      "Ticari faaliyet",
      "Karavan / RV kalıcı ikamet",
      "Modüler veya Tiny Home (çoğu R-1'de reddedilir)",
    ],
    terraNote: "Şehir parseli. Fiyatı yüksek ama kısıtlamalar çok fazla. TerraLot için genellikle hedef değil.",
    usStates: ["CA", "TX (şehiriçi)", "FL (şehiriçi)", "OR", "WA"],
  },
  {
    code: "V / VAC",
    fullName: "Vacant Land (Boş Arsa — Zoning Yok)",
    color: "border-amber-400 bg-amber-50",
    badgeColor: "bg-amber-100 text-amber-800",
    icon: Trees,
    iconColor: "text-amber-700",
    description: "Henüz bir zoning kodu atanmamış veya 'unzoned' olarak bırakılmış arazi. Çoğunlukla kırsal / taşra ilçelerinde görülür.",
    canDo: [
      "Karavan / RV park etme (çoğu unzoned alanda serbest)",
      "Kamp alanı & outdoor rekreasyon",
      "Hayvancılık & tarım",
      "Tiny Home (local permit ile)",
      "Prefabrik yapı (izin süreçleri daha kolay)",
      "Avcılık & balıkçılık",
    ],
    cannotDo: [
      "Kalıcı yapı (elektrik, su bağlantısı olmadan onay güç)",
      "Ticari işletme (izinsiz)",
      "Çöp depolaması / hurdalık",
    ],
    terraNote: "TerraLot'un en cazip segmenti. 'NO Restrictions' diye pazarlanan parseller genellikle bu kategoridedir. Alıcıya maksimum özgürlük vadeder.",
    usStates: ["NM", "TX (kırsal)", "WY", "MT", "NV"],
  },
  {
    code: "C-1 / COM",
    fullName: "Commercial (Ticari)",
    color: "border-purple-400 bg-purple-50",
    badgeColor: "bg-purple-100 text-purple-800",
    icon: Building2,
    iconColor: "text-purple-700",
    description: "İşyeri, mağaza, ofis gibi ticari kullanım için. Konut genellikle yasak ya da çok kısıtlıdır.",
    canDo: [
      "Perakende mağaza, ofis binası",
      "Restoran, kafe, market",
      "Depo (light industrial)",
      "Otopark / servis istasyonu",
      "Otel / motel",
    ],
    cannotDo: [
      "Tek aile konutu (genellikle yasak)",
      "Tarım / hayvancılık",
      "Ağır sanayi",
    ],
    terraNote: "TerraLot hedef alanı değil. Ama yol kenarı ticari arsa arbitrajı için alternatif bir kol olabilir.",
    usStates: ["TX", "FL", "TN", "GA"],
  },
  {
    code: "MH / MHP",
    fullName: "Mobile Home / Manufactured Housing",
    color: "border-orange-400 bg-orange-50",
    badgeColor: "bg-orange-100 text-orange-800",
    icon: Home,
    iconColor: "text-orange-700",
    description: "Mobil ev (trailer) ve fabrikasyon evlere özel zoning. Bazı ilçelerde ayrı bir kod olarak tanımlanır.",
    canDo: [
      "HUD onaylı mobil / prefabrik ev",
      "Çift veya tek genişlikli manufactured home",
      "Küçük hayvancılık (ilçeye göre)",
      "Bahçe yapıları, carport",
    ],
    cannotDo: [
      "Geleneksel inşaat (Site-Built Home) — bazı MH zonelerinde yasak",
      "Ticari faaliyet",
      "RV kalıcı ikamet (çoğu yerde ayrıca MH'tan ayrı)",
    ],
    terraNote: "Tennessee ve Florida'da alıcılara 'mobil ev kurabilirsiniz' diyebilmek için MH veya RR zoning olması şart.",
    usStates: ["TN", "FL", "TX", "NC", "SC"],
  },
];

const zoningRules = [
  { topic: "Setback (Geri Çekilme Mesafesi)", explanation: "Yapının parsel sınırından ne kadar uzak olması gerektiği. Örnek: 'Front setback 25ft, Side 10ft.' Bu mesafeler içine yapı yapılamaz.", risk: "Küçük parselde setback sonrası buildable alan çok az kalabilir." },
  { topic: "Lot Coverage (%)", explanation: "Parselin yüzde kaçına yapı yapılabileceği. Örnek: %30 coverage → 1,000 m² parselde 300 m² yapı alanı.", risk: "Küçük parselde kullanılabilir alan çok kısıtlanır." },
  { topic: "Height Restriction", explanation: "Yapı yükseklik sınırı. Kırsal alanlarda genellikle 35ft (≈10m) üst sınır.", risk: "Çok katlı yapı planı varsa engel." },
  { topic: "Minimum Lot Size", explanation: "O zoning kodunda izin verilen minimum parsel büyüklüğü. Örnek: A-1 zoning için minimum 5 acre.", risk: "5 acre altındaki parsel A-1'de yapılaşamaz." },
  { topic: "Deed Restrictions / CCR", explanation: "HOA veya eski mülk sahipleri tarafından tapuya işlenmiş kısıtlamalar. Zoning'den bağımsız özel sözleşmelerdir.", risk: "County izin verse bile deed restriction nedeniyle yapı engellenebilir." },
  { topic: "Flood Zone (FEMA)", explanation: "FEMA haritasında 'Special Flood Hazard Area' (SFHA) olarak işaretlenmiş alanlarda yapı yasak veya zorunlu sigorta/yükseltme şartı vardır.", risk: "AE, AO, VE zonlarındaki arsa neredeyse değersizdir." },
  { topic: "Perc Test (Septik Uygunluğu)", explanation: "Şehir kanalizasyonu olmayan kırsal alanda septik tank kurulabilmesi için toprağın suyu emmesi test edilir.", risk: "Perc test başarısız → Tuvalet, kanalizasyon kurulamaz → Arsa yaşanabilir değildir." },
  { topic: "Easement (Geçiş Hakkı)", explanation: "Parselin üzerinden veya kenarından başkasına ait geçiş hakları (kamu hattı, su borusu, yol vb.).", risk: "Easement alanına yapı yapılamaz. Alıcıyı itiraz sonrası tahliye etmek zor olabilir." },
];

export default function Vol14Page() {
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
        <div className="border-b-4 border-slate-900 pb-6 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 14</p>
          <h1 className="text-3xl font-black text-slate-900">Arsa Tipleri & Zoning Rehberi</h1>
          <p className="text-sm text-slate-600 mt-2">Her arsa tipinde ne yapılabilir, ne yapılamaz — alım öncesi kritik imar sözlüğü</p>
        </div>

        <div className="space-y-12 text-sm text-slate-700 leading-relaxed">

          {/* Giriş */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Zoning Nedir ve Neden Kritiktir?
            </h2>
            <p>
              Zoning (İmar Kodu), County (ilçe) veya Belediye tarafından belirlenen ve o parselde <strong>ne yapılabileceğini, ne kadar büyük yapı kurulabileceğini</strong> belirleyen yasal sınıflandırmadır.
              Aynı eyalette, hatta aynı kasabada yan yana iki parsel farklı zoning koduna sahip olabilir.
              <strong> Alım öncesi County GIS veya parsel sorgulama sisteminden zoning kodu doğrulanmadan teklif verilmez.</strong>
            </p>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span><strong>Kritik:</strong> İlana "NO Restrictions" yazması her şeye izin verildiği anlamına gelmez. County zoning kuralları her zaman geçerlidir. Bu ifade genellikle sadece HOA ve Deed Restriction olmadığını belirtir.</span>
            </div>
          </div>

          {/* Zoning Tipleri */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-green-600 pl-3 flex items-center gap-2">
              <Trees className="w-5 h-5 text-green-700" /> Arsa Zoning Tipleri — Detaylı Rehber
            </h2>

            {zoningTypes.map((z, i) => {
              const Icon = z.icon;
              return (
                <div key={i} className={`border-2 rounded-2xl p-6 space-y-4 ${z.color}`}>
                  {/* Title */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                        <Icon className={`w-5 h-5 ${z.iconColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg ${z.badgeColor}`}>{z.code}</span>
                        </div>
                        <h3 className="font-black text-slate-900 text-base">{z.fullName}</h3>
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 shrink-0">
                      <span className="font-bold block text-slate-700">Yaygın Eyaletler</span>
                      {z.usStates.join(" · ")}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700">{z.description}</p>

                  {/* Can Do / Cannot Do */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white/70 rounded-xl p-4 space-y-1.5">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide block flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 inline" /> Yapılabilir / İzinli
                      </span>
                      <ul className="space-y-1">
                        {z.canDo.map((item, j) => (
                          <li key={j} className="text-xs text-slate-700 flex items-start gap-1.5">
                            <span className="text-emerald-500 mt-0.5 shrink-0">✓</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white/70 rounded-xl p-4 space-y-1.5">
                      <span className="text-[10px] font-black text-red-700 uppercase tracking-wide block flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 inline" /> Yasak / İzinsiz Yapılamaz
                      </span>
                      <ul className="space-y-1">
                        {z.cannotDo.map((item, j) => (
                          <li key={j} className="text-xs text-slate-700 flex items-start gap-1.5">
                            <span className="text-red-500 mt-0.5 shrink-0">✗</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* TerraLot Notu */}
                  <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 text-xs flex items-start gap-2">
                    <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong className="text-emerald-400">TerraLot için:</strong> {z.terraNote}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Kritik Imar Terimleri */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-l-4 border-red-600 pl-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-700" /> Alımda Dikkat Edilecek 8 Kritik İmar Terimi
            </h2>
            <p className="text-xs text-slate-600">Bu kavramları bilmeden due diligence eksik sayılır. Her birine ilişkin potansiyel risk de aşağıda belirtilmiştir.</p>

            <div className="space-y-3">
              {zoningRules.map((r, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Terim</span>
                    <span className="font-bold text-slate-900">{i + 1}. {r.topic}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Açıklama</span>
                    <span className="text-slate-700">{r.explanation}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-wide block mb-1">⚠ Risk</span>
                    <span className="text-red-800">{r.risk}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TerraLot Due Diligence Özet */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              TerraLot Arsa Alım Zoning Kontrol Listesi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                ["County GIS'ten zoning kodunu doğrula", "A-1, RR, VAC — hedef tipler bunlar"],
                ["FEMA Flood Map'te parsel durumunu kontrol et", "AE/VE zonu → reddet"],
                ["Deed Restriction & HOA kaydına bak", "\"NO Restrictions\" ifadesine güvenme"],
                ["Minimum lot size kuralını kontrol et", "Parsel bu zoning için yeterli mi?"],
                ["Setback hesapla — buildable alan ne kadar?", "Küçük parselde çok kritik"],
                ["Perc Test yapılmış mı / yapılabilir mi?", "Kırsal alanlarda septik zorunlu"],
                ["Road access / easement var mı?", "Landlocked arsa = değersiz arsa"],
                ["Utility (elektrik/su) mesafesini öğren", "İlan 'Power along road' diyorsa mesafeyi sor"],
              ].map(([check, note], i) => (
                <div key={i} className="bg-white/10 rounded-xl p-3 border border-white/10 space-y-0.5">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="font-bold text-white">{check}</span>
                  </div>
                  <p className="text-slate-400 pl-5">{note}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 14 — Arsa Tipleri & Zoning Rehberi</span>
        </div>
      </div>
    </div>
  );
}
