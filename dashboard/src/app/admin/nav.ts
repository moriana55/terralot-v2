// ─────────────────────────────────────────────────────────────────────────────
// ADMIN MENÜSÜ — TEK KAYNAK
//
// Gruplama ALFABETİK veya TEKNİK değil, SAHİBİN GÜNLÜK İŞ AKIŞINA göredir:
//   arsa bul → değerlendir/ele → sahibini bul → mektup at → satışa koy → takip.
//
// Kurallar:
//  • Bir sayfa menüde YOKSA route'u silinmiş değildir; sadece günlük akıştan
//    çıkarılmıştır (bkz. ADMIN-ENVANTER.md, "arşiv" satırları). URL hâlâ çalışır.
//  • `lab: true` grubu yalnızca NEXT_PUBLIC_SHOW_WIP="1" iken görünür
//    (mock/yarım/eski veri içeren ekranlar müşteri görünümüne çıkmaz).
//  • `hint` = menüde tooltip, aramada eşleşme yüzeyi. Benzer adlı sayfaları
//    ("harita" 4 tane, "rakip" 5 tane) burada AYIRT EDİYORUZ.
//  • `alias` = arama kutusunda eşleşsin diye eski/İngilizce adlar.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Map, Award, Target, MapPin, Radio, BellRing, Globe, Layers,
  FileSearch, ShieldCheck, Brain, Hammer, Calculator, TrendingDown, Compass,
  MailPlus, PhoneCall, Send, Mail, Handshake, Users,
  Sparkles, MessageSquare, CircleDollarSign, CreditCard,
  Database, Swords, Radar, BarChart3, Cpu, Rocket, Copy, Tv, LayoutDashboard,
} from "lucide-react";

export type MenuItem = {
  href: string;
  label: string;
  icon: typeof Map;
  /** Sayfanın ne işe yaradığı — tooltip + arama yüzeyi. */
  hint?: string;
  /** Arama kutusunda da eşleşsin istediğimiz eski/alternatif adlar. */
  alias?: string[];
};

export type MenuGroup = {
  label: string;
  /** true → sadece geliştirici görünümünde (NEXT_PUBLIC_SHOW_WIP=1). */
  lab?: boolean;
  items: MenuItem[];
};

export const MENU: MenuGroup[] = [
  {
    label: "Başlangıç",
    items: [
      {
        href: "/admin",
        label: "Bugün",
        icon: LayoutDashboard,
        hint: "Bugün ne yapılmalı — bekleyen iş ve canlı sayaçlar",
        alias: ["dashboard", "ana sayfa", "operasyon ozeti", "komuta"],
      },
    ],
  },

  // ── 1 · BUL ────────────────────────────────────────────────────────────────
  {
    label: "1 · Bul",
    items: [
      {
        href: "/admin/harita",
        label: "Harita",
        icon: Map,
        hint: "TEK HARİTA — mod seçiciyle: off-market envanteri · vergi & ihale · alınabilir parseller (2D/3D)",
        alias: [
          "map", "sunum haritasi", "tam ekran", "off market map", "eyalet haritasi",
          "cluster", "deal map", "ihale", "tax sale", "katalizor",
          "alinabilir", "firsat haritasi", "3d", "spread",
        ],
      },
      {
        href: "/admin/arsa-notlari",
        label: "Arsa Notları · A+ vitrin",
        icon: Award,
        hint: "Not motorunun (A+..F) seçtiği satılabilir arsalar — yol/elektrik/su mesafesiyle",
        alias: ["grade", "not motoru", "a plus"],
      },
      {
        href: "/admin/all-deals",
        label: "Tüm Fırsatlar",
        icon: Target,
        hint: "ANA TARAYICI — bütün kaynakların birleştiği filtreli deal listesi",
        alias: ["all deals", "ulusal firsatlar", "deal listesi", "tarayici"],
      },
      {
        href: "/admin/satilabilir-cekirdek",
        label: "Doğrulanmış Çekirdek",
        icon: Target,
        hint: "Mohave yığınından mektup atılacak en iyi ~500 parsel",
        alias: ["cekirdek", "top 500"],
      },
      {
        href: "/admin/canli-sorgu",
        label: "Canlı County Sorgu",
        icon: Radio,
        hint: "Statik havuz dışında, bir county'yi O AN sorgula ve kaydet",
        alias: ["live county", "canli sorgu", "arcgis"],
      },
      {
        href: "/admin/saved-searches",
        label: "Kayıtlı Aramalar",
        icon: BellRing,
        hint: "Filtre setini kaydet, çalıştır, yeni eşleşmeleri gör",
        alias: ["saved searches", "alarm", "alert"],
      },
      {
        href: "/admin/ucuz-arsa",
        label: "Ucuz Boş Arsa",
        icon: MapPin,
        hint: "Vergi-borçlu ucuz arsa listesi (TX snapshot) + puanlama rubriği",
        alias: ["cheap land", "ucuz arsa"],
      },
      {
        href: "/admin/real-deals",
        label: "Küratörlü Dealler · Dallas",
        icon: Target,
        hint: "Dallas County için elle doğrulanmış 246 deal (DCAD + Regrid)",
        alias: ["real deals", "dallas", "curated"],
      },
      {
        href: "/admin/off-market-envanter",
        label: "Off-Market Envanteri",
        icon: MapPin,
        hint: "TEK ENVANTER — 15 eyalet, 206 county, 565.930 lead; eyalet/county filtresi + 0-100 skor",
        alias: [
          "envanter", "off market", "offmarket leads", "mohave", "meadview",
          "golden valley", "arizona", "luna", "new mexico", "propstream", "skor",
        ],
      },
    ],
  },

  // ── 2 · DEĞERLENDİR ────────────────────────────────────────────────────────
  {
    label: "2 · Değerlendir",
    items: [
      {
        href: "/admin/acquisitions",
        label: "Satın Alma Konsolu",
        icon: Target,
        hint: "TEK EKRAN, 3 sekme — Ele (buy-box kararı) · Çalış (DD + aşama) · Bölge (county skoru)",
        alias: [
          "acquisitions", "satin alma", "dd", "screener", "eleme", "buy box",
          "county skor", "grade", "direct mail",
        ],
      },
      {
        href: "/admin/underwrite",
        label: "Underwrite · tek parsel",
        icon: Brain,
        hint: "Tek parsel için açıklamalı AL/İZLE/GEÇ kararı + finansman senaryoları",
        alias: ["underwrite", "underwriting", "karar"],
      },
      {
        href: "/admin/buildability",
        label: "İnşa Edilebilirlik",
        icon: Hammer,
        hint: "Eğim, su, taşkın, yol erişimi — lead'siz manuel giriş de yapılabilir",
        alias: ["buildability", "insa", "egim", "taskin"],
      },
      {
        href: "/admin/arbitrage",
        label: "Arbitraj Radarı",
        icon: TrendingDown,
        hint: "İçsel değer ile minimum teklif arasındaki fark",
        alias: ["arbitrage", "arbitraj", "gap"],
      },
      {
        href: "/admin/apn-dogrula",
        label: "APN Doğrulama",
        icon: ShieldCheck,
        hint: "Bizim kayıt vs resmî county kaydı — uyum kontrolü + TRS modu",
        alias: ["apn dogrula", "county dogrulama", "trs"],
      },
      {
        href: "/admin/cerberus",
        label: "Cerberus Analiz",
        icon: Brain,
        hint: "Otomatik analiz motorunun kokpiti — huni, AL/BEKLE/GEÇ, toplu analiz",
        alias: ["cerberus", "analiz", "intel"],
      },
    ],
  },

  // ── 3 · SAHİBE ULAŞ ────────────────────────────────────────────────────────
  {
    label: "3 · Sahibe ulaş",
    items: [
      {
        href: "/admin/off-market-leads",
        label: "Malik & Lead'ler",
        icon: MailPlus,
        hint: "Motive sahipler (mektup atılabilir) + ham kayıt/DD tablosu",
        alias: ["off market leads", "malik", "tax leads", "motive sahipler", "dd tablosu"],
      },
      {
        href: "/admin/arama",
        label: "Sıcak Arama",
        icon: PhoneCall,
        hint: "Marj sıralı arama kuyruğu, saat dilimi kontrolü, geri arama takvimi",
        alias: ["arama", "call center", "telefon", "skip trace"],
      },
      {
        href: "/admin/outreach",
        label: "Mektup & Kadans",
        icon: Send,
        hint: "Tek lead'e mektup (Lob) + 3 dokunuşlu kadansın ilerletilmesi",
        alias: ["outreach", "mektup", "lob", "kadans", "cadence"],
      },
      {
        href: "/admin/mohave/kampanya",
        label: "Toplu Kampanya",
        icon: Mail,
        hint: "Segment seç → dedupe → Lob-ready CSV veya toplu gönderim",
        alias: ["kampanya", "campaign", "toplu mektup", "csv"],
      },
      {
        href: "/admin/anlasma-hatti",
        label: "Anlaşma Hattı",
        icon: Handshake,
        hint: "İlgileniyor → Teklif → Pazarlık → Sözleşme → Tapu",
        alias: ["pipeline", "anlasma", "hat", "asama"],
      },
      {
        href: "/admin/contacts",
        label: "Kişiler",
        icon: Users,
        hint: "Wholesaler / scout / realtor / yatırımcı ağı",
        alias: ["contacts", "kisiler", "network"],
      },
    ],
  },

  // ── 4 · SAT ────────────────────────────────────────────────────────────────
  {
    label: "4 · Sat",
    items: [
      {
        href: "/admin/satis-sayfalari",
        label: "Satış Sayfaları & İlan Üreteci",
        icon: Globe,
        hint: "TEK EKRAN — yayındaki /p linkleri + kaynak filtresi + toplu kopyalama; parsel seçince ilan üretici açılır",
        alias: ["satis sayfalari", "linkler", "p sayfasi", "ilan", "listing builder", "uretec"],
      },
      {
        href: "/admin/talepler",
        label: "Alıcı Talepleri",
        icon: MessageSquare,
        hint: "Satış sayfasındaki formdan düşen alıcı talepleri",
        alias: ["talepler", "inquiry", "buyer", "lead"],
      },
      {
        href: "/admin/owner-finance",
        label: "Owner-Finance İlanları",
        icon: CircleDollarSign,
        hint: "Taksitli satış ilanları + vade preset'leri + kredi ön-elemesi",
        alias: ["owner finance", "taksit", "vade"],
      },
      {
        href: "/admin/payments",
        label: "Tahsilatlar",
        icon: CreditCard,
        hint: "Ödeme kayıtları ve durumları",
        alias: ["payments", "tahsilat", "odeme"],
      },
    ],
  },

  // ── 5 · PAZAR & RAKİP ──────────────────────────────────────────────────────
  {
    label: "5 · Pazar & rakip",
    items: [
      {
        href: "/admin/istihbarat",
        label: "Pazar İstihbaratı",
        icon: Database,
        hint: "GERÇEK tapu satışları + county değerlemesi + rakip profilleri",
        alias: ["istihbarat", "intel", "tapu", "market intelligence"],
      },
      {
        href: "/admin/market",
        label: "Market Analitik",
        icon: BarChart3,
        hint: "County/eyalet kokpiti + county A ile B'yi yan yana karşılaştırma",
        alias: ["market", "analitik", "karsilastirma", "costar"],
      },
      {
        href: "/admin/rakip-radar",
        label: "Rakip Radar",
        icon: Radar,
        hint: "TEK RAKİP EKRANI, 5 sekme — Radar · Manzara (PropStream CSV) · Defter · Bölgeler · Ekonomi",
        alias: [
          "rakip radar", "competitor", "snapshot", "diff", "dom",
          "rakip defteri", "discount lots", "carpan", "propstream", "csv import",
          "rakip istihbarat", "pazar ortusme", "taksit analizi", "arbitraj",
        ],
      },
      {
        href: "/admin/lookalike",
        label: "Benzer County Bul",
        icon: Copy,
        hint: "Kazanan county'yi seç → demografik olarak benzeyenleri bul",
        alias: ["lookalike", "benzer county", "cosine"],
      },
      {
        href: "/admin/path-of-growth",
        label: "Büyüme Yolu",
        icon: Rocket,
        hint: "Önümüzdeki 12-18 ayda ısınacak county'ler (momentum skoru)",
        alias: ["path of growth", "buyume", "momentum"],
      },
    ],
  },

  // ── 6 · TAKİP & SİSTEM ─────────────────────────────────────────────────────
  {
    label: "6 · Takip & sistem",
    items: [
      {
        href: "/admin/portfoy",
        label: "Portföy & KPI",
        icon: BarChart3,
        hint: "Sourced deal, potansiyel spread, grade dağılımı — potansiyel ≠ gerçekleşmiş",
        alias: ["portfoy", "kpi", "portfolio"],
      },
      {
        href: "/admin/yontem",
        label: "Sistem & Yöntem",
        icon: Compass,
        hint: "TEK EKRAN — eleme hunisi, kurallar, dürüstlük frenleri + eyalet detay tablosu (ppa/comp/absentee)",
        alias: ["yontem", "metod", "method", "kurallar", "sistem", "is modeli", "veri kaynaklari"],
      },
      {
        href: "/admin/eyalet-kapsami",
        label: "Eyalet Kapsamı",
        icon: Globe,
        hint: "Nerede varız, nerede yokuz — county başına gerçek ölçüm sonucu",
        alias: ["kapsam", "coverage", "eyalet"],
      },
      {
        href: "/admin/data-coverage",
        label: "Veri Kalitesi",
        icon: Database,
        hint: "Mailable %, absentee %, skip-trace % ve county hitlist kapsamı",
        alias: ["data coverage", "veri kapsami", "kalite", "mailable"],
      },
      {
        href: "/admin/markets",
        label: "Market Kayıt Defteri",
        icon: Globe,
        hint: "Hangi pazar hangi olgunlukta: izleme → araştırma → pilot → aktif",
        alias: ["markets", "registry", "kayit defteri", "olgunluk"],
      },
      {
        href: "/admin/scraper",
        label: "Bot Filosu",
        icon: Cpu,
        hint: "Scraper filosunun durumu + yaklaşan icra satışları takvimi",
        alias: ["scraper", "bot", "cerberus botlari", "fleet"],
      },
      {
        href: "/admin/sunum",
        label: "Müşteri Sunumu",
        icon: Tv,
        hint: "Mohave operasyonunun 3 ekranlık canlı-veri demosu",
        alias: ["sunum", "demo", "presentation"],
      },
    ],
  },

  // ── 🧪 LAB · yalnız geliştirici görünümü ───────────────────────────────────
  // Buradakiler SİLİNMEDİ. Mock/yarım/eski veri içerdikleri ya da başka bir
  // sayfayla örtüştükleri için günlük akıştan çıkarıldılar. Gerekçeler:
  // ADMIN-ENVANTER.md.
  {
    label: "🧪 Lab · arşiv",
    lab: true,
    items: [
      // ── Emekli edilen ekranlar: route SİLİNMEDİ, redirect() ile halefine gider.
      //    Eski gövdeleri kendi klasörlerinde `_arsiv-ekran.tsx` olarak duruyor.
      { href: "/admin/off-market-harita", label: "↪︎ Eyalet Haritası (eski)", icon: Map, hint: "Harita → ?mod=offmarket&gorunum=panel" },
      { href: "/admin/deal-map", label: "↪︎ Vergi & İhale Haritası (eski)", icon: Map, hint: "Harita → ?mod=anlasma" },
      { href: "/admin/alinabilir-harita", label: "↪︎ Alınabilir Parseller (eski)", icon: Layers, hint: "Harita → ?mod=alinabilir" },
      { href: "/admin/mohave", label: "↪︎ Mohave Envanteri (eski)", icon: MapPin, hint: "Off-Market Envanteri → ?state=AZ&county=Mohave" },
      { href: "/admin/luna", label: "↪︎ Luna Envanteri (eski)", icon: MapPin, hint: "Off-Market Envanteri → ?state=NM&county=Luna" },
      { href: "/admin/deal-screener", label: "↪︎ County Eleme (eski)", icon: Compass, hint: "Satın Alma Konsolu → ?sekme=bolge" },
      { href: "/admin/ilan-ureteci", label: "↪︎ İlan Üreteci (eski)", icon: Sparkles, hint: "Satış Sayfaları ekranına taşındı" },
      { href: "/admin/apn-sorgula", label: "↪︎ Parsel Sorgu (eski)", icon: FileSearch, hint: "APN Doğrulama → ham GIS alan tablosu oraya taşındı" },
      { href: "/admin/competitor-radar", label: "↪︎ Rakip Satış Radarı (eski)", icon: Radar, hint: "Rakip Radar → ?sekme=manzara (PropStream CSV içe aktarma orada)" },
      { href: "/admin/rakip-defteri", label: "↪︎ Rakip Defteri (eski)", icon: Swords, hint: "Rakip Radar → ?sekme=defter" },
      { href: "/admin/rakip-istihbarat", label: "↪︎ Rakip İstihbaratı (eski)", icon: Swords, hint: "Rakip Radar → ?sekme=bolgeler" },
      { href: "/admin/pazar-ortusme", label: "↪︎ Pazar Örtüşmesi (eski)", icon: Radar, hint: "Rakip Radar → ?sekme=bolgeler" },
      { href: "/admin/competitor-analysis", label: "↪︎ Rakip Taksit Analizi (eski)", icon: Calculator, hint: "Rakip Radar → ?sekme=ekonomi" },
      { href: "/admin/sistem", label: "↪︎ Sistem & Yöntem (eski)", icon: Brain, hint: "Yöntem ekranına taşındı (eyalet detay tablosu dahil)" },
      { href: "/admin/leads", label: "↪︎ Site Lead'leri (eski)", icon: MessageSquare, hint: "Alıcı Talepleri → tek huni parcel_inquiries" },

      // ── Hâlâ kendi başına duran, ama mock/yarım/eski veri içeren ekranlar.
      { href: "/admin/parcels", label: "Parcel Explorer (Regrid)", icon: Globe, hint: "REGRID_API_TOKEN yoksa mock döner" },
      { href: "/admin/flip-sim", label: "Flip Simülatörü", icon: Calculator, hint: "Yeniden satış = alış × 3.5 naif varsayımı" },
      { href: "/admin/market-listings", label: "Piyasa İlanları (Zillow, eski)", icon: CircleDollarSign, hint: "Eski Zillow kazıması" },
      { href: "/admin/listings", label: "Property Listesi", icon: MapPin, hint: "Düzenleme butonu devre dışı; 44 satırlık Property tablosu (public sayfalar okuyor)" },
      { href: "/admin/analytics", label: "Property Finansal", icon: BarChart3, hint: "Property tablosu doluysa çalışır" },
      { href: "/admin/deals", label: "Yatırımcı CRM", icon: Handshake, hint: "Arsa DEĞİL, yatırımcı ilişkisi — ayrı veri modeli, bilerek birleştirilmedi" },
      { href: "/admin/mailer", label: "Direct Mail (örnek veri)", icon: Mail, hint: "Kampanya istatistikleri mock; sadece hızlı gönderim gerçek" },
      { href: "/admin/presentation", label: "Yatırımcı Sunumu (statik)", icon: Tv, hint: "803 satır tamamen sabit içerik + 18 ciltlik whitepaper" },
      { href: "/admin/financing", label: "Owner Finance (kilitli)", icon: CircleDollarSign, hint: "ComingSoon ile kilitli; buildContracts mantığı içeride duruyor" },
      { href: "/admin/referrals", label: "Referans Programı (kilitli)", icon: Users, hint: "ComingSoon ile kilitli; veriler sabit dizi" },
    ],
  },
];

/** Lab grubunu göster/gizle — müşteri görünümünde kapalıdır. */
export const SHOW_LAB = process.env.NEXT_PUBLIC_SHOW_WIP === "1";
