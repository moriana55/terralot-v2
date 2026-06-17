"use client";

import { useState, useEffect } from "react";
import { Plus, ChevronDown, CalendarDays, Trash2, Lock, Bot, Landmark, CheckCircle2, Clock, Circle, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Update {
  id: string;
  week: string;
  title: string;
  items: string[];
  created_at: string;
  type: "milestone";
  emoji?: string;
  category?: string;
}

interface DBBotStatus {
  bot_no: number;
  status: string;
  updated_at: string;
}

interface CombinedItem {
  id: string;
  dateStr: string;
  timestamp: string;
  title: string;
  items: string[];
  type: "milestone" | "bot";
  emoji: string;
  category: string;
  color?: string;
  rawBotNo?: number;
}

const ADMIN_PIN = "1234";

// 21 Bots definition from kickoff to map metadata
const BOTS_METADATA: Record<number, { emoji: string; title: string; category: string; summary: string; color: string; subs: { title: string; desc: string }[] }> = {
  1: {
    emoji: "🏠", title: "Zillow Scraper Bot", category: "Veri Toplama", color: "#3b82f6",
    summary: "Zillow'da listelenen arsaları otomatik tarar, fiyat/konum/boyut bilgilerini çeker.",
    subs: [
      { title: "İlan tarama", desc: "Hedef eyalet + county filtresiyle düzenli arama yapar" },
      { title: "Veri çekme", desc: "Fiyat, boyut (acres), konum, ilan tarihi, APN numarası" },
      { title: "DB'ye kayıt", desc: "Yeni ilan bulununca otomatik kayıt, tekrar kaydı önleme" },
      { title: "Fiyat değişim takibi", desc: "İlan fiyatı düşerse bildirim gönderir" },
    ],
  },
  2: {
    emoji: "🌐", title: "Land.com / LandWatch Scraper", category: "Veri Toplama", color: "#6366f1",
    summary: "En büyük arazi satış platformlarından ilan ve fiyat verisi çeker.",
    subs: [
      { title: "Land.com tarama", desc: "Kategori + eyalet bazlı filtrelenmiş arama" },
      { title: "LandWatch tarama", desc: "Paralel tarama, aynı parselin farklı fiyatını karşılaştır" },
      { title: "Satış geçmişi", desc: "\"Sold\" ilanları çekerek comps veritabanı oluştur" },
      { title: "Rakip fiyat analizi", desc: "Bizim ilanlarla rakip ilanları yan yana karşılaştır" },
    ],
  },
  3: {
    emoji: "🏛️", title: "County Tax Records Bot", category: "Veri Toplama", color: "#ec4899",
    summary: "Her county'nin vergi kayıtlarına girerek borçlu parsel listesini otomatik çeker.",
    subs: [
      { title: "County portal girişi", desc: "Her county'nin farklı arayüzü için ayrı scraper modülü" },
      { title: "Vergi borçlu liste", desc: "2+ yıl borçlu, düşük değerli parselleri filtrele" },
      { title: "Sahip bilgisi", desc: "Mülk sahibinin adı ve adresi — direct mail için" },
      { title: "Tapu kayıt tarihi", desc: "Ne zaman alınmış, kaç yıldır borçlu" },
      { title: "Otomatik önceliklendirme", desc: "En yüksek borç/değer oranına göre sırala" },
    ],
  },
  4: {
    emoji: "🔨", title: "Tax Deed Auction Bot", category: "Veri Toplama", color: "#f59e0b",
    summary: "County açık artırma takvimlerini takip eder, yaklaşan müzayedeleri bildirir.",
    subs: [
      { title: "Takvim tarama", desc: "Hedef county'lerin açık artırma takvimlerini haftalık kontrol" },
      { title: "Parsel listesi çekme", desc: "Açık artırmaya çıkacak parsellerin detayları" },
      { title: "Minimum teklif bilgisi", desc: "Starting bid + tahmin edilen piyasa değeri" },
      { title: "Erken uyarı", desc: "30 gün öncesinden bildirim — araştırma için zaman kalır" },
      { title: "Sonuç takibi", desc: "Kazanan teklif ve fiyatı kaydet — veri birikimi" },
    ],
  },
  5: {
    emoji: "📱", title: "Facebook Marketplace Bot", category: "Veri Toplama", color: "#1877f2",
    summary: "Facebook Marketplace'teki arazi ilanlarını tarar, düşük fiyatlı fırsatları yakalar.",
    subs: [
      { title: "Kategori tarama", desc: "\"Land for sale\" + hedef eyalet araması" },
      { title: "Fiyat filtresi", desc: "Piyasa değerinin altında ilanları otomatik işaretle" },
      { title: "Satıcı bilgisi", desc: "İlan sahibine otomatik mesaj şablonu hazırla" },
      { title: "Yeni ilan alarmı", desc: "Kriterlere uyan yeni ilan çıkınca anlık bildirim" },
    ],
  },
  6: {
    emoji: "📋", title: "Craigslist Bot", category: "Veri Toplama", color: "#6b7280",
    summary: "Craigslist'teki \"land for sale\" ilanlarını tarar — hâlâ büyük hacim var.",
    subs: [
      { title: "Şehir bazlı tarama", desc: "Her hedef county için ayrı Craigslist araması" },
      { title: "Fiyat + konum eşleştirme", desc: "İlan başlığından acres ve fiyat parse et" },
      { title: "Duplicate temizleme", desc: "Aynı ilanın farklı şehirlerde kopyasını algıla" },
      { title: "Satıcı iletişim", desc: "İlgili ilanlara otomatik e-posta şablonu gönder" },
    ],
  },
  7: {
    emoji: "🗺️", title: "County GIS Bot", category: "Due Diligence", color: "#10b981",
    summary: "County GIS sistemlerinden parsel koordinatları, zoning ve arazi sınırlarını çeker.",
    subs: [
      { title: "APN'den koordinat çekme", desc: "Parsel numarasından lat/lng ve sınır poligonu" },
      { title: "Zoning bilgisi", desc: "Residential / agricultural / commercial — yapılabilir mi?" },
      { title: "Parsel boyut doğrulama", desc: "İlan'daki acre bilgisini resmi kayıtla karşılaştır" },
      { title: "Komşu parsel analizi", desc: "Çevredeki parsellerin kullanım durumu" },
      { title: "Haritaya işleme", desc: "Admin panelinde interaktif haritada görselleştir" },
    ],
  },
  8: {
    emoji: "🌊", title: "FEMA Flood Zone Checker", category: "Due Diligence", color: "#06b6d4",
    summary: "Her parsel için FEMA flood haritasını sorgular, risk skoru atar.",
    subs: [
      { title: "FEMA API sorgusu", desc: "Koordinat → flood zone kodu (X, AE, VE vs.)" },
      { title: "Risk skoru", desc: "Zone X = düşük risk ✓, Zone AE = sigorta zorunlu ✗" },
      { title: "İlan sayfasına yaz", desc: "Her ilanda flood risk otomatik gösterilir" },
      { title: "Riskli parselleri filtrele", desc: "Yüksek flood riskli parseller öneri listesinden çıkar" },
    ],
  },
  9: {
    emoji: "🛣️", title: "Road Access Checker", category: "Due Diligence", color: "#84cc16",
    summary: "Google Maps API ile parselin yola erişimi olup olmadığını otomatik doğrular.",
    subs: [
      { title: "En yakın yol mesafesi", desc: "Google Roads API ile parsele en yakın asfalt/toprak yol" },
      { title: "Landlocked kontrolü", desc: "Çevresi tamamen başkasının arazisiyse alarm" },
      { title: "Yol türü tespiti", desc: "Asfalt / stabilize / toprak yol ayrımı" },
      { title: "Street View doğrulama", desc: "Otomatik Street View snapshot çekerek görsel kanıt" },
      { title: "İlana erişim notu", desc: "\"Paved road access\" veya \"Dirt road - 2WD\" otomatik yaz" },
    ],
  },
  10: {
    emoji: "💸", title: "Back Taxes & Lien Checker", category: "Due Diligence", color: "#f97316",
    summary: "Parsel üzerindeki tüm vergi borçlarını ve hacizleri sorgular.",
    subs: [
      { title: "County vergi borcu sorgulama", desc: "Güncel vergi borcu tutarı ve kaç yıllık olduğu" },
      { title: "Federal lien kontrolü", desc: "IRS veya federal kurumlar tarafından haciz var mı" },
      { title: "HOA borcu kontrolü", desc: "Bölgede HOA varsa aidatlar ödenmiş mi" },
      { title: "Toplam borç hesaplama", desc: "Satın alma maliyetine otomatik ekle — gerçek maliyet" },
      { title: "Temiz tapu skoru", desc: "Tüm kontroller geçilince \"Clear Title ✓\" etiketi" },
    ],
  },
  11: {
    emoji: "🤖", title: "AI Fiyat Analizi (Comps Bot)", category: "AI & Analiz", color: "#8b5cf6",
    summary: "Son 12 aydaki benzer parsel satışlarını analiz edip gerçekçi piyasa değeri tahmini yapar.",
    subs: [
      { title: "Benzer parsel bulma", desc: "Aynı county, benzer boyut, benzer zoning" },
      { title: "Satış fiyatı veritabanı", desc: "Zillow + Land.com + county records kombine" },
      { title: "Düzeltme faktörleri", desc: "Yol erişimi, utilities, şehre mesafe — fiyata ekle/çıkar" },
      { title: "Değer aralığı", desc: "\"$4,500 – $7,200 arasında satar\" tahmini üret" },
      { title: "Güven skoru", desc: "Yeterli comp varsa yüksek güven, yoksa \"veri yetersiz\" uyarısı" },
    ],
  },
  12: {
    emoji: "📊", title: "AI Parsel Skorlama Botu", category: "AI & Analiz", color: "#a855f7",
    summary: "Her parseli 0-100 arası puanlar: \"al\" / \"atla\" / \"araştır\" kararını otomatik verir.",
    subs: [
      { title: "Kar marjı skoru", desc: "Maliyet vs tahmini satış fiyatı — %40 altı = kırmızı" },
      { title: "Likidite skoru", desc: "Bu bölgede son 6 ayda kaç satış olmuş" },
      { title: "Risk skoru", desc: "Flood, lien, landlocked — her biri puan düşürür" },
      { title: "Lokasyon skoru", desc: "Şehre mesafe, utilities, gelişim potansiyeli" },
      { title: "Final karar", desc: "🟢 AL (70+) / 🟡 ARAŞTIR (50-69) / 🔴 ATLA (50 altı)" },
    ],
  },
  13: {
    emoji: "💬", title: "Lead Takip Botu", category: "Satış & CRM", color: "#22c55e",
    summary: "Talep gelen lead'e 1 saat içinde otomatik iletişim başlatır, satışa taşır.",
    subs: [
      { title: "Anlık e-posta", desc: "Lead form doldurur → 2 dakikada parsel detay maili gider" },
      { title: "WhatsApp mesajı", desc: "Telefon varsa WhatsApp'tan kişiselleştirilmiş mesaj" },
      { title: "Follow-up serisi", desc: "Cevap yoksa: 24s / 3 gün / 7 gün otomatik hatırlatma" },
      { title: "Sıcaklık takibi", desc: "Link açıldı mı, kaç kez bakıldı — hot/warm/cold etiket" },
      { title: "Admin bildirimi", desc: "Sıcak lead gelince sana anında Telegram bildirimi" },
    ],
  },
  14: {
    emoji: "📣", title: "Sosyal Medya Bot", category: "Pazarlama", color: "#f43f5e",
    summary: "Yeni ilan yayınlandığında TikTok, Instagram ve Facebook'a otomatik içerik atar.",
    subs: [
      { title: "TikTok otomatik post", desc: "AI video + caption + hashtag → TikTok API ile yayınla" },
      { title: "Instagram Reels", desc: "9:16 video + hikaye formatı — Meta API" },
      { title: "Facebook ilanı", desc: "FB Marketplace + sayfa paylaşımı otomatik" },
      { title: "Caption AI", desc: "Her ilan için GPT ile 3 farklı caption üret, en iyisini seç" },
      { title: "Optimal zaman", desc: "En çok etkileşim alınan saatte otomatik gönder" },
      { title: "Performans takibi", desc: "Görüntülenme, tıklama, lead dönüşümünü admin'de göster" },
    ],
  },
  15: {
    emoji: "⚠️", title: "Ödeme Gecikme Botu", category: "Satış & CRM", color: "#ef4444",
    summary: "Taksit gecikmelerini izler, otomatik uyarılar gönderir, yasal süreci başlatır.",
    subs: [
      { title: "D+1 e-posta", desc: "Ödeme günü geçince nazik hatırlatma maili" },
      { title: "D+7 WhatsApp", desc: "7 gün geçince WhatsApp + SMS ile ikinci uyarı" },
      { title: "D+15 resmi uyarı", desc: "Formal default notice e-postası — hukuki dil" },
      { title: "D+30 aksiyon", desc: "Admin'e bildir: \"parsel geri al\" veya \"uzlaşma yap\" seçeneği" },
      { title: "Otomatik parsel iptali", desc: "Onay sonrası sözleşme iptal, parsel tekrar satışa çıkar" },
      { title: "Default kayıt", desc: "Tüm default geçmişi raporlanır — Ahmet panelinde görünür" },
    ],
  },
  16: {
    emoji: "✉️", title: "Direct Mail & Teklif Botu", category: "Pazarlama", color: "#ec4899",
    summary: "Lob / Pebble API'leri üzerinden sahiplere all-cash teklif mektubu gönderir ve teslimatını takip eder.",
    subs: [
      { title: "Teklif Şablonu", desc: "Piyasa değerine göre teklif mektubunu dinamik üretir" },
      { title: "API Entegrasyonu", desc: "Lob/Pebble üzerinden tek tıkla mektubu fiziki postaya verir" },
      { title: "Teslimat Takibi", desc: "Posta durumunu (Mailed, Delivered) gerçek zamanlı günceller" },
      { title: "İade Kartı Takibi", desc: "Geri dönen zarfların takibini ve sisteme girişini sağlar" }
    ]
  },
  17: {
    emoji: "📐", title: "Subdivision & İmar Analiz Botu", category: "Due Diligence", color: "#10b981",
    summary: "County imar yönetmeliklerini tarayarak arsanın bölünme (subdivision) potansiyelini sorgular.",
    subs: [
      { title: "Yönetmelik Tarama", desc: "County imar kodlarını (Zoning Ordinance) indirip LLM ile analiz eder" },
      { title: "Minimum Lot Boyutu", desc: "Arsanın minimum kaç dönümlük parçalara bölünebileceğini doğrular" },
      { title: "Bölünme Şartları", desc: "Cephe genişliği, çekme mesafeleri ve yol erişimi kurallarını kontrol eder" },
      { title: "Potansiyel Hesaplama", desc: "Arsadan maksimum kaç alt parsel çıkacağını otomatik raporlar" }
    ]
  },
  18: {
    emoji: "⚡", title: "Altyapı & Yakınlık Kontrol Botu", category: "Due Diligence", color: "#10b981",
    summary: "Arsanın elektrik direklerine, su şebekesine ve en yakın konuta mesafesini otomatik ölçer.",
    subs: [
      { title: "Elektrik Hattı Analizi", desc: "GIS katmanlarından en yakın elektrik direği ve hattını tespit eder" },
      { title: "Şebeke Sorgusu", desc: "Su ve kanalizasyon şebekesi sınırlarını GIS üzerinden kontrol eder" },
      { title: "Mesafe Ölçümü", desc: "En yakın yerleşim yerine veya konuta olan kuş uçuşu mesafeyi ölçer" },
      { title: "Raporlama", desc: "Altyapı durumunu (Elektrik/Su/Kanalizasyon) detay sayfasına not olarak ekler" }
    ]
  },
  19: {
    emoji: "📢", title: "Çoklu Platform İlan Yayınlama Botu", category: "Pazarlama", color: "#ec4899",
    summary: "Satın alınan arsaları LandWatch, Craigslist, FB Marketplace ve Zillow'da aynı anda yayına alır.",
    subs: [
      { title: "LandWatch Entegrasyonu", desc: "Land.com grubu API/Feed sistemiyle ilan detaylarını senkronize eder" },
      { title: "Craigslist Otomasyonu", desc: "Craigslist üzerinde hedeflenen şehirlerde otomatik ilan oluşturur" },
      { title: "Marketplace Senkronizasyonu", desc: "Facebook Marketplace ve ilan gruplarında otomatik listeleme yapar" },
      { title: "Zillow Listing", desc: "Zillow For Sale By Owner (FSBO) ilanını otomatik hazırlar" }
    ]
  },
  20: {
    emoji: "🎯", title: "Alıcı Eşleştirme & Bülten Botu", category: "Satış & CRM", color: "#f59e0b",
    summary: "Yeni eklenen arsayı, kriterleri uyan aktif alıcılara otomatik eşleştirip SMS ve e-posta gönderir.",
    subs: [
      { title: "Alıcı Kriter Filtresi", desc: "Alıcı listesindeki bütçe, eyalet ve acres tercihlerini tarar" },
      { title: "Otomatik Eşleşme", desc: "Yeni arsa ile uyumlu en sıcak 50 alıcı adayını tespit eder" },
      { title: "SMS / E-posta Kampanyası", desc: "Eşleşen alıcılara anlık kişiselleştirilmiş teklif gönderir" },
      { title: "Geri Dönüş Takibi", desc: "Teklife tıklayan veya yanıt veren alıcıları CRM'de üste taşır" }
    ]
  },
  21: {
    emoji: "📸", title: "Drone Çekim Rezervasyon Botu", category: "Due Diligence", color: "#10b981",
    summary: "Sözleşmesi imzalanan arsa için en yakın yerel drone fotoğrafçısını bulup otomatik rezervasyon yapar.",
    subs: [
      { title: "Lokasyon Eşleştirme", desc: "Arsanın koordinatlarına en yakın drone fotoğrafçılarını tarar" },
      { title: "Fiyat Teklifi", desc: "En uygun fiyatlı çekim paketi için otomatik rezervasyon talebi gönderir" },
      { title: "Teslimat Kontrolü", desc: "Yüklenen drone fotoğraflarını ve videolarını otomatik Google Drive'a çeker" },
      { title: "İlan Hazırlığı", desc: "Gelen görsel dosyalarını ilan editörüne taslak olarak iliştirir" }
    ]
  }
};

export default function UpdatesPage() {
  const [items, setItems] = useState<CombinedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  
  // Tab filters: All, Milestones (Business), Bots (Automations)
  const [activeTab, setActiveTab] = useState<"all" | "milestones" | "bots">("all");

  const [showForm, setShowForm] = useState(false);
  const [formWeek, setFormWeek] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formItems, setFormItems] = useState("");

  useEffect(() => { 
    fetchData(); 
  }, []);

  async function fetchData() {
    setLoading(true);
    
    // 1. Fetch manual updates
    const { data: dbMilestones } = await supabase
      .from("updates")
      .select("*")
      .order("created_at", { ascending: false });

    // 2. Fetch bot statuses that are completed
    const { data: dbBotStatuses } = await supabase
      .from("bot_statuses")
      .select("*")
      .eq("status", "tamamlandı");

    // 3. Map and merge
    const list: CombinedItem[] = [];

    if (dbMilestones) {
      dbMilestones.forEach((u: Update) => {
        list.push({
          id: `m-${u.id}`,
          dateStr: u.week,
          timestamp: u.created_at,
          title: u.title,
          items: u.items,
          type: "milestone",
          emoji: u.emoji || "💼",
          category: u.category || "Şirket",
          color: "#1e293b"
        });
      });
    }

    if (dbBotStatuses) {
      dbBotStatuses.forEach((bs: DBBotStatus) => {
        const meta = BOTS_METADATA[bs.bot_no];
        if (meta) {
          const date = new Date(bs.updated_at).toLocaleDateString("tr-TR", { 
            day: "numeric", 
            month: "short", 
            year: "numeric", 
            hour: "2-digit", 
            minute: "2-digit" 
          });
          list.push({
            id: `b-${bs.bot_no}`,
            dateStr: date,
            timestamp: bs.updated_at,
            title: `${meta.title} Aktif Edildi`,
            items: meta.subs.map(s => `${s.title}: ${s.desc}`),
            type: "bot",
            emoji: meta.emoji,
            category: meta.category,
            color: meta.color,
            rawBotNo: bs.bot_no
          });
        }
      });
    }

    // Sort combined list by timestamp descending
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setItems(list);
    if (list.length > 0) {
      setExpanded(list[0].id);
    }
    setLoading(false);
  }

  function tryLogin() {
    if (pinInput === ADMIN_PIN) {
      setIsAdminMode(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
    }
  }

  async function addUpdate() {
    const lines = formItems.split("\n").map(s => s.trim()).filter(Boolean);
    if (!formWeek || !formTitle || lines.length === 0) return;
    const { data, error } = await supabase
      .from("updates")
      .insert({ week: formWeek, title: formTitle, items: lines })
      .select()
      .single();
    if (!error && data) {
      // Re-fetch to merge cleanly
      fetchData();
      setFormWeek("");
      setFormTitle("");
      setFormItems("");
      setShowForm(false);
    }
  }

  async function deleteUpdate(combinedId: string) {
    // Check if it's milestone or bot
    if (combinedId.startsWith("m-")) {
      const dbId = combinedId.replace("m-", "");
      await supabase.from("updates").delete().eq("id", dbId);
      setItems(prev => prev.filter(item => item.id !== combinedId));
    }
  }

  const filteredItems = items.filter(item => {
    if (activeTab === "all") return true;
    if (activeTab === "milestones") return item.type === "milestone";
    return item.type === "bot";
  });

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1c1917] font-sans antialiased relative selection:bg-stone-200 pb-24">
      
      {/* Decorative Grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-0" style={{
        backgroundImage: `
          linear-gradient(to right, #000 1px, transparent 1px),
          linear-gradient(to bottom, #000 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px"
      }} />

      {/* Header bar */}
      <header className="max-w-3xl mx-auto px-5 pt-12 pb-8 flex items-center justify-between border-b border-stone-200/50 relative z-10">
        <div className="flex flex-col">
          <span className="font-light text-lg tracking-[0.2em] uppercase leading-none text-[#1c1917]">
            TerraLot<span className="text-emerald-800 font-semibold">Updates</span>
          </span>
          <span className="text-[7.5px] font-bold tracking-[0.25em] text-stone-400 uppercase mt-1.5">
            Realtime System & Milestone Registry
          </span>
        </div>
        
        <button
          onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPinModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all"
          style={{
            background: isAdminMode ? "#dcfce7" : "#ffffff",
            borderColor: isAdminMode ? "#bbf7d0" : "#e2e8f0",
            color: isAdminMode ? "#16a34a" : "#888",
          }}
        >
          <Lock className="w-3 h-3" />
          {isAdminMode ? "Admin" : "Login"}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-12 relative z-10">
        
        {/* Intro */}
        <div className="mb-10 text-center md:text-left">
          <p className="text-[9px] font-extrabold tracking-widest uppercase mb-2 text-emerald-800">Sistem & Geliştirme Günlüğü</p>
          <h1 className="text-3xl font-light font-serif tracking-tight text-stone-900">Bu hafta neler tamamlandı?</h1>
          <p className="text-xs text-stone-500 mt-2 leading-relaxed">
            Kickoff otomasyon sistemlerimizin hangilerinin aktif olduğunu ve genel iş geliştirme adımlarımızı canlı olarak buradan takip edebilirsiniz.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 border-b border-stone-200/50 pb-3 mb-8 overflow-x-auto">
          {[
            { id: "all", label: "Tüm Akış" },
            { id: "milestones", label: "💼 Şirket Gelişmeleri" },
            { id: "bots", label: "🤖 Aktif Otomasyonlar" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setExpanded(null); }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? "#15803d15" : "transparent",
                color: activeTab === tab.id ? "#15803d" : "#78716c",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Admin manual form */}
        {isAdminMode && (
          <div className="mb-8 p-5 rounded-2xl border bg-white border-stone-200 shadow-sm">
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-stone-900 text-white hover:bg-stone-850 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Manuel Güncelleme Ekle
            </button>

            {showForm && (
              <div className="mt-4 space-y-3 pt-4 border-t border-stone-100">
                <input 
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-250 outline-none"
                  placeholder="Tarih / Hafta (örn: 14 Haziran 2026)"
                  value={formWeek} onChange={e => setFormWeek(e.target.value)} 
                />
                <input 
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-250 outline-none"
                  placeholder="Başlık (örn: Wyoming LLC Resmi Kurulumu Tamamlandı)"
                  value={formTitle} onChange={e => setFormTitle(e.target.value)} 
                />
                <textarea 
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-250 outline-none resize-none min-h-[120px]"
                  placeholder={"Her satır bir madde olacak şekilde yazın:\nWyoming'de LLC kaydı tescil edildi.\nStripe vergi formları dolduruldu."}
                  value={formItems} onChange={e => setFormItems(e.target.value)} 
                />
                <div className="flex gap-2 pt-2">
                  <button onClick={addUpdate}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-800 text-white hover:bg-emerald-950 transition-colors"
                  >
                    Kaydet
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-stone-250 text-stone-500 hover:bg-stone-50 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeline Items */}
        {loading ? (
          <div className="text-center py-20 text-xs font-bold text-stone-400 uppercase tracking-widest">Yükleniyor...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-xs font-bold text-stone-400 uppercase tracking-widest bg-white border border-stone-200/50 rounded-2xl p-6">
            Bu kategoride henüz güncelleme bulunmuyor.
          </div>
        ) : (
          <div className="relative border-l border-stone-200/60 pl-6 ml-3 space-y-6">
            {filteredItems.map((u, idx) => {
              const isOpen = expanded === u.id;
              const isLatest = idx === 0;

              return (
                <div key={u.id} className="relative transition-all duration-300">
                  
                  {/* Timeline bullet dot */}
                  <div 
                    className="absolute -left-[35px] top-4 w-4.5 h-4.5 rounded-full border bg-white flex items-center justify-center shadow-sm z-10"
                    style={{ borderColor: isOpen ? u.color || "#047857" : "#cbd5e1" }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ background: isOpen ? u.color || "#047857" : "#94a3b8" }} 
                    />
                  </div>

                  {/* Card Container */}
                  <div 
                    className="rounded-2xl border overflow-hidden transition-all duration-300"
                    style={{ 
                      borderColor: isOpen ? `${u.color || "#047857"}30` : "#e2e8f0", 
                      background: isOpen ? "#white" : "#fafafa",
                      boxShadow: isOpen ? "0 4px 12px rgba(0,0,0,0.02)" : "none"
                    }}
                  >
                    {/* Header Row */}
                    <button 
                      onClick={() => setExpanded(isOpen ? null : u.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left focus:outline-none"
                    >
                      <span className="text-xl shrink-0">{u.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isLatest && (
                            <span className="text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                              Yeni
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-stone-400 uppercase">{u.dateStr}</span>
                          <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.2 rounded border" style={{ borderColor: `${u.color || "#475569"}30`, color: u.color || "#475569" }}>
                            {u.category}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-stone-850 mt-1">{u.title}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {isAdminMode && u.type === "milestone" && (
                          <button onClick={e => { e.stopPropagation(); deleteUpdate(u.id); }}
                            className="p-1.5 rounded-lg text-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronDown 
                          className="w-4 h-4 transition-transform text-stone-400"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} 
                        />
                      </div>
                    </button>

                    {/* Expandable tasks list */}
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 border-t border-stone-50 bg-[#fdfdfb] animate-fadeIn">
                        <ul className="space-y-2.5">
                          {u.items.map((item, i) => {
                            // Split subtask title and details
                            const splitIdx = item.indexOf(":");
                            const hasSplit = splitIdx > -1;
                            const label = hasSplit ? item.substring(0, splitIdx) : "";
                            const content = hasSplit ? item.substring(splitIdx + 1) : item;
                            
                            return (
                              <li key={i} className="flex gap-2.5 items-start text-xs text-stone-600 leading-relaxed">
                                <span className="text-emerald-700 font-extrabold shrink-0 mt-0.5">✓</span>
                                <div>
                                  {hasSplit ? (
                                    <span>
                                      <strong className="text-stone-800 font-bold">{label}:</strong>{content}
                                    </span>
                                  ) : (
                                    <span>{content}</span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        
                        {u.type === "bot" && (
                          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[9px] text-stone-400 uppercase tracking-widest font-extrabold">
                            <span>Sistem Modülü Aktif</span>
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-16">
          TerraLot · {new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Admin Login Modal */}
      {showPinModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-xs">
          <div className="p-6 rounded-2xl w-72 bg-white border border-stone-200 shadow-xl animate-scaleIn">
            <p className="text-sm font-bold text-stone-800 mb-1">Admin Girişi</p>
            <p className="text-xs text-stone-400 mb-4">PIN Kodunu Girin</p>
            <input type="password"
              className="w-full text-sm px-3 py-2 rounded-xl border border-stone-250 outline-none mb-3 text-center tracking-widest font-bold bg-[#fbfbfa]"
              placeholder="••••" value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={e => { if (e.key === "Enter") tryLogin(); }} autoFocus 
            />
            {pinError && <p className="text-xs text-center mb-3 text-rose-600 font-semibold">Hatalı PIN Kodu</p>}
            <div className="flex gap-2">
              <button onClick={tryLogin} className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                Giriş
              </button>
              <button 
                onClick={() => { setShowPinModal(false); setPinInput(""); setPinError(false); }}
                className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-stone-250 text-stone-500 hover:bg-stone-50 transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
