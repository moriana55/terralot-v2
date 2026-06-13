"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Printer, Compass, ShieldAlert, CheckCircle2, XCircle, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import Link from "next/link";

export default function Vol2Page() {
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Accordion toggle states
  const [approvedOpen, setApprovedOpen] = useState(true);
  const [rejectedOpen, setRejectedOpen] = useState(false);

  // 50 states database grouped
  const approvedStates = [
    { name: "Arizona (AZ) — PİLOT BÖLGE", code: "ARS § 32-2181", platting: "10 Acre (~40,470 m²) limitli splits (en fazla 5 parsel) county onayından tamamen muaftır.", con: "Su kuyusu derinlikleri ve taşıma su (water haul) kısıtlamaları alıcıya iyi anlatılmalıdır. Off-grid talebi zirvededir.", region: "Batı Yakası / Güneybatı" },
    { name: "Arkansas (AR) — PİLOT BÖLGE", code: "AR Code § 14-17-201", platting: "Unincorporated alanlarda 5-10 Acre üstü bölünmeler county imar denetimi dışındadır.", con: "Dağlık ve dik yamaçlı arazilerde fiziki yol açma ve inşaat alanı düzleme maliyetleri yüksektir.", region: "Güney / Orta" },
    { name: "Missouri (MO) — PİLOT BÖLGE", code: "MO Rev Stat Ch 64", platting: "Kırsal alanlarda bölünme sınırı veya zoning denetimi yoktur.", con: "Yoğun ormanlık ve bitki örtüsü nedeniyle arazinin sınırlarını belirlemek ve drone çekimi yapmak zordur.", region: "Orta Batı" },
    { name: "New Mexico (NM) — ANA PİLOT BÖLGE", code: "NM Stat § 47-6-2(M)", platting: "35 Acre (~141,600 m²) ve üstü bölünmeler county imar onayından tamamen muaftır.", con: "Bazı çöl havzalarında su kuyusu açma derinlikleri ve maliyeti yüksektir. (Alıcıya bildirilerek aşılır).", region: "Güneybatı" },
    { name: "Texas (TX) — PİLOT BÖLGE", code: "TX Local Gov Code § 232.0015", platting: "Belediye sınırları dışında 5 Acre (~20,200 m²) üstü splits sıfır onayla tescil edilir.", con: "Yol hakkı (easement) ve mülk sınırı ihtilafları çok yaşanır. (Titiz tapu araştırmasıyla aşılır).", region: "Güney" }
  ];

  const rejectedStates = [
    { name: "Alabama (AL)", code: "AL Code § 35-4-360", platting: "Kırsal alan imar muafiyeti 5-10 Acre arasındadır.", con: "Taksit sözleşmesi iptallerinde yerel mahkemeler tüketici koruma yasaları nedeniyle süreci aşırı zorlaştırır ve yavaşlatır.", region: "Güney" },
    { name: "Alaska (AK)", code: "AK Stat § 29.40.010", platting: "Borough kırsal muafiyetleri 10-20 Acre arasındadır.", con: "Arazilerin %90'ında fiziki yol veya elektrik altyapısı yoktur, sadece helikopterle veya kar motoruyla ulaşım sağlanır.", region: "Batı / Pasifik" },
    { name: "California (CA)", code: "CA Subdivision Map Act § 66410", platting: "Muafiyet yoktur. En küçük parsel bölme işlemi dahi planlama komisyonu onayına tabidir.", con: "Çevre etki raporu (EIR), su testi, yol yapımı zorunludur. Süreç minimum 2 yıl sürer, giriş maliyeti fahiştir ($50k+).", region: "Batı Yakası" },
    { name: "Colorado (CO)", code: "CO Rev Stat § 30-28-101(10)", platting: "35 Acre (~141,600 m²) altındaki bölünmeler doğrudan yasak veya ağır denetime tabidir.", con: "Su hakları (Water Rights) yasaları dünyanın en katısıdır; arsanın altındaki su kuyusundan su çekmek yasal olarak yasaktır.", region: "Batı" },
    { name: "Connecticut (CT)", code: "CT Gen Stat § 8-18", platting: "Muafiyet yoktur. Her türlü imar bölmesi Town planlama kurullarının onayına tabidir.", con: "Aşırı yüksek yıllık emlak vergileri, küçük yüzölçümü ve kırsal boş arazi eksikliği.", region: "Doğu Yakası" },
    { name: "Delaware (DE)", code: "DE Code Tit. 9 § 4801", platting: "Muafiyet yoktur. Eyalet yüzölçümü çok küçük olup arazilerin tamamı belediye sınırları içindedir.", con: "Tarımsal koruma alanları dışında boş parsel bulunmamaktadır, fiyatlar kırsal yatırım için anlamsızdır.", region: "Doğu Yakası" },
    { name: "Florida (FL)", code: "FL Stat § 177.011", platting: "Kırsal alanlarda bile 5-10 Acre sınırları vardır.", con: "Arazilerin %70'i koruma altındaki 'Wetlands' (sulak alan) kapsamındadır. Çevre koruma komisyonu (DEP) dolgu toprak izni vermez.", region: "Doğu / Güney" },
    { name: "Georgia (GA)", code: "GA Code § 44-2-1", platting: "Genellikle 5 ila 25 Acre arasındadır.", con: "Contract for Deed yerine mortgage tescili zorunludur. Alıcı ödemeyi keserse mahkemesiz arsayı geri alamazsınız.", region: "Doğu / Güney" },
    { name: "Hawaii (HI)", code: "HI Rev Stat Ch 205", platting: "Eyalet Land Use Commission (LUC) onayları zorunludur. Kırsal tarım bölünmesi yasaktır.", con: "Arazi fiyatları astronomik seviyede yüksek olup, volkanik gas ve lav akıntı risk bölgeleri vardır.", region: "Pasifik" },
    { name: "Idaho (ID)", code: "ID Code § 50-1301", platting: "Genellikle kırsal bölgelerde 5 ila 20 Acre arasıdır.", con: "Arazi fiyatları son 3 yılda spekülatif olarak çok yükselmiştir, kar marjı düşüktür ($5,000+ / Acre).", region: "Batı" },
    { name: "Illinois (IL)", code: "765 ILCS 205/", platting: "Genellikle 5 Acre limitleri vardır.", con: "Taksit ödenmediğinde aylar süren resmi Foreclosure (icra-tahliye mahkemesi) açmak zorunludur. Vergiler çok yüksektir.", region: "Orta Batı" },
    { name: "Indiana (IN)", code: "IN Code § 36-7-4-700", platting: "Kırsal alanlarda genellikle 10 Acre sınırları vardır.", con: "Eyalet yüksek mahkemesi kararlarına göre, alıcı arsa bedelinin az bir kısmını dahi ödemiş olsa foreclosure davası şarttır.", region: "Orta Batı" },
    { name: "Iowa (IA)", code: "IA Code Ch 354", platting: "10-40 Acre sınırları mevcuttur.", con: "Tarım arazilerinin korunması yasaları (Agricultural preservation) nedeniyle toprağı tarım dışı amaçla bölmek yasaktır.", region: "Orta Batı" },
    { name: "Kansas (KS)", code: "KS Stat § 12-752", platting: "Genellikle 20-40 Acre kırsal sınırları vardır.", con: "Kırsal Kansas arazilerine off-grid veya tiny house alıcılarından neredeyse hiç talep yoktur, satış hızı aşırı yavaştır.", region: "Orta Batı" },
    { name: "Kentucky (KY)", code: "KRS § 100.111", platting: "5 Acre üstü tarım dışı arazilerde yerel muafiyetler vardır.", con: "Mineral hakları (Mineral Rights) ve kömür madenciliği tescil sorunları tapu devirlerini hukuken karmaşıklaştırır.", region: "Doğu / Güney" },
    { name: "Louisiana (LA)", code: "LA Rev Stat § 33:101", platting: "Muafiyet yoktur. Fransız Medeni Kanunu kökenli (Napoleonic Code) hukuk sistemi uygulanır.", con: "Emlak ve miras hukuku diğer 49 eyaletten tamamen farklı ve karmaşıktır, yasal hata riski çok yüksektir.", region: "Güney" },
    { name: "Maine (ME)", code: "30-A MRSA § 4401", platting: "5 yıl içinde bir arazinin 3 veya daha fazla parçaya bölünmesi planlama kurulu onayına tabidir.", con: "Aşırı soğuk kış iklimi nedeniyle yılın 6 ayı arazi satışı ve gösterimi tamamen durur.", region: "Doğu Yakası / Kuzey" },
    { name: "Maryland (MD)", code: "MD Code Real Prop § 3-101", platting: "Muafiyet yoktur. Kıyı şeridi koruma kanunları (Critical Area Act) imarı tamamen kilitler.", con: "Arazi fiyatları çok yüksek, kırsal boş alan kalmamıştır.", region: "Doğu Yakası" },
    { name: "Massachusetts (MA)", code: "MGL Ch 41 § 81L", platting: "Muafiyet yoktur. Her bölünmüş parselin yola resmi cephesi ve genişliği (frontage) olmak zorundadır.", con: "ABD'nin imar izinleri en pahalı ve bürokratik eyaletlerindendir.", region: "Doğu Yakası" },
    { name: "Michigan (MI)", code: "MI Land Division Act 288 of 1967", platting: "Planlama onayı olmadan bir arsayı 10 yılda en fazla 4 parçaya bölebilirsiniz.", con: "Bölünme adet sınırı nedeniyle arazileri seri şekilde parsellemek ve satmak yasal olarak engellenmiştir.", region: "Orta Batı / Kuzey" },
    { name: "Minnesota (MN)", code: "MN Stat § 505.01", platting: "Kırsal alanlarda genellikle 10-40 Acre sınırları vardır.", con: "Göl kıyıları koruma kanunları ve sulak alan yasal engelleri arazilerin fiziki kullanımını kısıtlar.", region: "Orta Batı / Kuzey" },
    { name: "Mississippi (MS)", code: "MS Code § 17-1-23", platting: "Kırsal bölgelerde 5-10 Acre limitleri geçerlidir.", con: "Eyaletin ekonomik büyüme hızı çok yavaştır, kırsal topraklara dışarıdan talep yok denecek kadar azdır.", region: "Güney" },
    { name: "Montana (MT)", code: "MCA § 76-3-101", platting: "20 Acre (~80,940 m²) altındaki her bölünme resmi planlama onayına tabidir.", con: "Çok büyük araziler ucuzdur ancak kış şartları ve fiziki dağ yolu erişimi ulaşımı imkansız hale getirir.", region: "Batı / Kuzey" },
    { name: "Nebraska (NE)", code: "NE Rev Stat § 23-372", platting: "Genellikle 10-20 Acre kırsal sınırları.", con: "Tarım arazisi koruma yasaları nedeniyle tarım dışı konut veya karavan tescili yaptırılamaz.", region: "Orta Batı" },
    { name: "Nevada (NV)", code: "NRS § 278.320", platting: "Kırsal alanlarda 10 Acre sınırları vardır.", con: "Nevada topraklarının %80'inden fazlası federal hükümete (BLM) aittir. Özel mülkiyet boş arazi bulmak imkansıza yakındır.", region: "Batı" },
    { name: "New Hampshire (NH)", code: "NH Rev Stat § 672:14", platting: "Kırsal muafiyet yoktur. Her kasaba (Town) kendi imar komisyonu kurallarını uygular.", con: "Emlak vergileri ve yerel kasaba meclislerinin yabancı yatırımcılara karşı katı kuralları.", region: "Doğu Yakası" },
    { name: "New Jersey (NJ)", code: "NJ Rev Stat § 40:55D-1", platting: "Muafiyet yoktur. Kırsal alan kalmamıştır.", con: "Yüzölçümü küçük ve nüfus yoğunluğu çok yüksek olduğundan boş arazi yatırımı yapılamaz.", region: "Doğu Yakası" },
    { name: "New York (NY)", code: "NY Town Law § 276", platting: "Muafiyet yoktur. Township onayları, elektrik hattı çekme zorunlulukları vardır.", con: "Bölünme süreci fahiş maliyetlidir ($30k+), emlak vergileri çok yüksektir.", region: "Doğu Yakası" },
    { name: "North Carolina (NC)", code: "NC Gen Stat § 160D-802", platting: "Genellikle kırsal alanlarda 10 Acre sınırları.", con: "Kıyı ve dağlık bölgelerde imar izin ücretleri son yıllarda çok artırılmıştır.", region: "Doğu Yakası / Güney" },
    { name: "North Dakota (ND)", code: "ND Cent Code § 40-48-01", platting: "Genellikle 40 Acre kırsal sınırları.", con: "Aşırı soğuk iklim nedeniyle off-grid veya karavan yerleşimi talebi sıfıra yakındır.", region: "Orta Batı / Kuzey" },
    { name: "Ohio (OH)", code: "OH Rev Code § 711.001", platting: "Genellikle 5-20 Acre arasıdır.", con: "Taksit ödemeyen alıcıyı tahliye etmek için foreclosure davası açmak zorunludur. Mahkeme süreci 6-12 ay sürer.", region: "Orta Batı" },
    { name: "Oklahoma (OK)", code: "OK Stat Tit. 19 § 863.9", platting: "Kırsal alanlarda genellikle 10-20 Acre sınırları.", con: "Kızılderili kabile federal arazileri (Tribal Lands) nedeniyle tapu geçmişinde tescil karmaşası riski yüksektir.", region: "Güney / Orta" },
    { name: "Oregon (OR)", code: "ORS Ch 92 (Planning & Subdivisions)", platting: "Muafiyet yoktur. Tarım arazilerinin korunması adına kırsal bölünmeler tamamen yasaklanmıştır.", con: "Eyalet kanunları kırsal arazilerin bölünmesini imkansız kılmaktadır.", region: "Batı Yakası" },
    { name: "Pennsylvania (PA)", code: "PA Municipalities Planning Code § 107", platting: "Muafiyet yoktur. Townships çok katı altyapı ve imar kuralları koyar.", con: "Arsa bölmek için yol cephesi ve asfalt yol yapım şartı aranır.", region: "Doğu Yakası" },
    { name: "Rhode Island (RI)", code: "RI Gen Laws § 45-23-32", platting: "Muafiyet yoktur. Amerika'nın en küçük eyaletidir.", con: "Kırsal boş arazi yatırımı için yüzölçümü ve arazi miktarı yetersizdir.", region: "Doğu Yakası" },
    { name: "South Carolina (SC)", code: "SC Code § 6-29-1110", platting: "Genellikle 5-10 Acre arası sınırlar mevcuttur.", con: "Kıyı bölgelerindeki bataklık ve orman arazilerinde imar izin maliyetleri yüksektir.", region: "Doğu Yakası / Güney" },
    { name: "South Dakota (SD)", code: "SD Codified Laws § 11-3-1", platting: "Genellikle 40 Acre kırsal sınırları.", con: "Aşırı soğuk iklim ve zayıf off-grid/tiny house alıcı talebi.", region: "Orta Batı / Kuzey" },
    { name: "Tennessee (TN)", code: "TCA § 13-3-401", platting: "Genellikle kırsal alanlarda 5 Acre limitleri vardır.", con: "Arazi fiyatları son yıllarda çok yükselmiştir, kar marjı diğer pilot eyaletlere göre düşüktür.", region: "Güney" },
    { name: "Utah (UT)", code: "UT Code § 17-27a-601", platting: "Kırsal alanlarda genellikle 20-40 Acre sınırları.", con: "Yerel yönetimler kırsal alanlarda bile çadır kurmaya, karavanda yaşamaya çok katı yasaklar uygulamaktadır.", region: "Batı" },
    { name: "Vermont (VT)", code: "10 VSA Ch 151 (Act 250)", platting: "Act 250 çevre yasası nedeniyle 10 Acre altı bölünmeler ağır denetlenir.", con: "Çevre koruma izin maliyetleri ve yüksek eyalet vergileri.", region: "Doğu Yakası / Kuzey" },
    { name: "Virginia (VA)", code: "VA Code § 15.2-2240", platting: "Genellikle 10-20 Acre kırsal sınırlar.", con: "Yerel komisyonların altyapı (yol cephesi ve yol yapım) zorunlulukları.", region: "Doğu Yakası" },
    { name: "Washington (WA)", code: "RCW 58.17.020", platting: "Muafiyet yoktur. Growth Management Act kırsal bölünmeyi yasal olarak yasaklamıştır.", con: "Eyalet kanunları kırsal arazilerin bölünmesini engellemektedir.", region: "Batı Yakası" },
    { name: "West Virginia (WV)", code: "WV Code § 8-24-28", platting: "Kırsal alanlarda 5 Acre muafiyetleri vardır.", con: "Aşırı engebeli dağlık coğrafya nedeniyle düzlük arazi yoktur, yol erişimi fiziksel olarak çok zordur.", region: "Doğu / Güney" },
    { name: "Wisconsin (WI)", code: "WI Stat § 236.02", platting: "Genellikle 15 Acre kırsal sınırları vardır.", con: "Aşırı soğuk iklim, kışın donan yollar ve mevsimsel yavaş satış hızı.", region: "Orta Batı / Kuzey" },
    { name: "Wyoming (WY)", code: "WY Stat § 18-5-302", platting: "35 Acre (~141,600 m²) altındaki bölünmeler ağır denetime tabidir.", con: "Nüfus yoğunluğu çok düşük olduğundan New Mexico'ya göre alıcı bulma hızı yavaştır.", region: "Batı / Kuzey" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-6 md:px-12 print:p-0 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Link href="/admin/presentation/whitepaper" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kütüphaneye Dön
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer">
          <Printer className="w-4 h-4" /> Cilt 2'yi PDF Olarak Kaydet / Yazdır
        </button>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-16 shadow-xl print:shadow-none print:border-none print:p-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">TerraLot Yatırım Kütüphanesi — Cilt 2</p>
          <h1 className="text-3xl font-black text-slate-900">50 Eyalet İmar ve Bölünme Yasaları</h1>
          <p className="text-sm text-slate-600 mt-2">Tüm ABD eyaletlerinin Platting Kanun Kodları ve Karşılaştırmalı Yatırım Analizleri</p>
        </div>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <p className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 text-xs text-red-950 font-semibold rounded-r-xl">
            ÖNEMLİ YASAL GERÇEK: Amerika Birleşik Devletleri genelindeki 50 eyaletin hiçbirinde, altyapı dökmeden (asfalt yol, su, elektrik) ve county meclis izni almadan bir araziyi 1'er Acre'lik (4.047 m²) küçük parsellere bölüp satamazsınız. Bu işlem "Major Subdivision" kapsamına girer, minimum 2 yıl sürer ve $100k+ sermaye kilitler. Bizim modelimiz, imar onayına takılmadan tescil edilebilen kırsal "Muafiyet Sınırları" (Exemption Limits) dahilinde sıfır altyapı bütçesiyle çalışmaktadır.
          </p>

          <h3 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 pt-4">50 Eyalet Detaylı Platting Kanun Kodları Veritabanı</h3>
          <p className="text-xs text-slate-500">
            Kullanılabilir (Pilot Bölge) eyaletler yeşil, elenen eyaletler kırmızı olarak işaretlenmiştir. İncelemek istediğiniz grubu tıklayarak açabilirsiniz:
          </p>

          {/* ACCORDION 1: APPROVED STATES */}
          <div className="border border-emerald-200 rounded-2xl overflow-hidden shadow-sm mt-4">
            <button
              onClick={() => setApprovedOpen(!approvedOpen)}
              className="w-full bg-emerald-50 hover:bg-emerald-100/80 px-6 py-4 flex justify-between items-center text-emerald-900 font-bold transition-all text-sm cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                ONAYLANAN / KULLANILABİLİR PİLOT EYALETLER ({approvedStates.length} Eyalet)
              </span>
              {approvedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {approvedOpen && (
              <div className="p-6 bg-white divide-y divide-slate-100 space-y-4">
                {approvedStates.map((s, idx) => (
                  <div key={idx} className="pt-4 first:pt-0 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between font-bold text-slate-900 text-xs gap-1.5">
                      <span className="text-emerald-800 text-sm flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {s.name}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {s.code}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 bg-emerald-50/20 p-3.5 rounded-xl border border-emerald-100/50">
                      <div>
                        <strong>Yasa & Bölünme Limiti:</strong> {s.platting}
                      </div>
                      <div>
                        <strong>Bölgesel Kısıt & Fırsat:</strong> {s.con}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                      Coğrafi Bölge: <span className="text-slate-600">{s.region}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACCORDION 2: REJECTED STATES */}
          <div className="border border-red-200 rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setRejectedOpen(!rejectedOpen)}
              className="w-full bg-red-50 hover:bg-red-100/80 px-6 py-4 flex justify-between items-center text-red-900 font-bold transition-all text-sm cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-700" />
                ELENEN / RİSKLİ EYALETLER ({rejectedStates.length} Eyalet)
              </span>
              {rejectedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {rejectedOpen && (
              <div className="p-6 bg-white divide-y divide-slate-100 max-h-[600px] overflow-y-auto space-y-4">
                {rejectedStates.map((s, idx) => (
                  <div key={idx} className="pt-4 first:pt-0 space-y-1.5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between font-bold text-slate-900 text-xs gap-1.5">
                      <span className="text-red-900 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" /> {s.name}
                      </span>
                      <span className="text-[9px] text-red-700 font-mono bg-red-50 border border-red-150 px-2 py-0.5 rounded">
                        {s.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700"><strong>Sınır:</strong> {s.platting}</p>
                    <p className="text-[11px] text-red-800 bg-red-50/30 px-3 py-1.5 rounded-lg border border-red-100/40">
                      <strong>Neden Elendi?</strong> {s.con}
                    </p>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Coğrafi Bölge: <span className="text-slate-500">{s.region}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        
        <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
          <span>TerraLot Land Investment Group LLC</span>
          <span className="font-bold text-slate-800">Cilt 2 Onaylandı</span>
        </div>
      </div>
    </div>
  );
}
