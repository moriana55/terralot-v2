"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, MessageSquare, Send, CheckCircle2, Clock, Circle, Code2, AlignLeft, Copy, Check, Target, Milestone, Database, HelpCircle, BarChart3, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SubTask {
  title: string;
  desc: string;
}

interface Bot {
  no: number;
  emoji: string;
  title: string;
  summary: string;
  time: string;
  color: string;
  category: string;
  subs: SubTask[];
}

type Status = "bekliyor" | "devam ediyor" | "tamamlandı";

interface Comment {
  id: string;
  text: string;
  author: string;
  date: string;
  isCode?: boolean;
  lang?: string;
}
const INITIAL_STATUSES: Record<number, Status> = Object.fromEntries(
  Array.from({ length: 21 }, (_, i) => [i + 1, "bekliyor" as Status])
);

const bots: Bot[] = [
  {
    no: 1, emoji: "🏠", title: "Zillow Scraper Bot",
    category: "Veri Toplama",
    summary: "Zillow'da listelenen arsaları otomatik tarar, fiyat/konum/boyut bilgilerini çeker.",
    time: "3 gün", color: "#3b82f6",
    subs: [
      { title: "İlan tarama", desc: "Hedef eyalet + county filtresiyle düzenli arama yapar" },
      { title: "Veri çekme", desc: "Fiyat, boyut (acres), konum, ilan tarihi, APN numarası" },
      { title: "DB'ye kayıt", desc: "Yeni ilan bulununca otomatik kayıt, tekrar kaydı önleme" },
      { title: "Fiyat değişim takibi", desc: "İlan fiyatı düşerse bildirim gönderir" },
    ],
  },
  {
    no: 2, emoji: "🌐", title: "Land.com / LandWatch Scraper",
    category: "Veri Toplama",
    summary: "En büyük arazi satış platformlarından ilan ve fiyat verisi çeker.",
    time: "3 gün", color: "#6366f1",
    subs: [
      { title: "Land.com tarama", desc: "Kategori + eyalet bazlı filtrelenmiş arama" },
      { title: "LandWatch tarama", desc: "Paralel tarama, aynı parselin farklı fiyatını karşılaştır" },
      { title: "Satış geçmişi", desc: "\"Sold\" ilanları çekerek comps veritabanı oluştur" },
      { title: "Rakip fiyat analizi", desc: "Bizim ilanlarla rakip ilanları yan yana karşılaştır" },
    ],
  },
  {
    no: 3, emoji: "🏛️", title: "County Tax Records Bot",
    category: "Veri Toplama",
    summary: "Her county'nin vergi kayıtlarına girerek borçlu parsel listesini otomatik çeker.",
    time: "5 gün", color: "#ec4899",
    subs: [
      { title: "County portal girişi", desc: "Her county'nin farklı arayüzü için ayrı scraper modülü" },
      { title: "Vergi borçlu liste", desc: "2+ yıl borçlu, düşük değerli parselleri filtrele" },
      { title: "Sahip bilgisi", desc: "Mülk sahibinin adı ve adresi — direct mail için" },
      { title: "Tapu kayıt tarihi", desc: "Ne zaman alınmış, kaç yıldır borçlu" },
      { title: "Otomatik önceliklendirme", desc: "En yüksek borç/değer oranına göre sırala" },
    ],
  },
  {
    no: 4, emoji: "🔨", title: "Tax Deed Auction Bot",
    category: "Veri Toplama",
    summary: "County açık artırma takvimlerini takip eder, yaklaşan müzayedeleri bildirir.",
    time: "4 gün", color: "#f59e0b",
    subs: [
      { title: "Takvim tarama", desc: "Hedef county'lerin açık artırma takvimlerini haftalık kontrol" },
      { title: "Parsel listesi çekme", desc: "Açık artırmaya çıkacak parsellerin detayları" },
      { title: "Minimum teklif bilgisi", desc: "Starting bid + tahmin edilen piyasa değeri" },
      { title: "Erken uyarı", desc: "30 gün öncesinden bildirim — araştırma için zaman kalır" },
      { title: "Sonuç takibi", desc: "Kazanan teklif ve fiyatı kaydet — veri birikimi" },
    ],
  },
  {
    no: 5, emoji: "📱", title: "Facebook Marketplace Bot",
    category: "Veri Toplama",
    summary: "Facebook Marketplace'teki arazi ilanlarını tarar, düşük fiyatlı fırsatları yakalar.",
    time: "4 gün", color: "#1877f2",
    subs: [
      { title: "Kategori tarama", desc: "\"Land for sale\" + hedef eyalet araması" },
      { title: "Fiyat filtresi", desc: "Piyasa değerinin altında ilanları otomatik işaretle" },
      { title: "Satıcı bilgisi", desc: "İlan sahibine otomatik mesaj şablonu hazırla" },
      { title: "Yeni ilan alarmı", desc: "Kriterlere uyan yeni ilan çıkınca anlık bildirim" },
    ],
  },
  {
    no: 6, emoji: "📋", title: "Craigslist Bot",
    category: "Veri Toplama",
    summary: "Craigslist'teki \"land for sale\" ilanlarını tarar — hâlâ büyük hacim var.",
    time: "2 gün", color: "#6b7280",
    subs: [
      { title: "Şehir bazlı tarama", desc: "Her hedef county için ayrı Craigslist araması" },
      { title: "Fiyat + konum eşleştirme", desc: "İlan başlığından acres ve fiyat parse et" },
      { title: "Duplicate temizleme", desc: "Aynı ilanın farklı şehirlerde kopyasını algıla" },
      { title: "Satıcı iletişim", desc: "İlgili ilanlara otomatik e-posta şablonu gönder" },
    ],
  },
  {
    no: 7, emoji: "🗺️", title: "County GIS Bot",
    category: "Due Diligence",
    summary: "County GIS sistemlerinden parsel koordinatları, zoning ve arazi sınırlarını çeker.",
    time: "5 gün", color: "#10b981",
    subs: [
      { title: "APN'den koordinat çekme", desc: "Parsel numarasından lat/lng ve sınır poligonu" },
      { title: "Zoning bilgisi", desc: "Residential / agricultural / commercial — yapılabilir mi?" },
      { title: "Parsel boyut doğrulama", desc: "İlan'daki acre bilgisini resmi kayıtla karşılaştır" },
      { title: "Komşu parsel analizi", desc: "Çevredeki parsellerin kullanım durumu" },
      { title: "Haritaya işleme", desc: "Admin panelinde interaktif haritada görselleştir" },
    ],
  },
  {
    no: 8, emoji: "🌊", title: "FEMA Flood Zone Checker",
    category: "Due Diligence",
    summary: "Her parsel için FEMA flood haritasını sorgular, risk skoru atar.",
    time: "2 gün", color: "#06b6d4",
    subs: [
      { title: "FEMA API sorgusu", desc: "Koordinat → flood zone kodu (X, AE, VE vs.)" },
      { title: "Risk skoru", desc: "Zone X = düşük risk ✓, Zone AE = sigorta zorunlu ✗" },
      { title: "İlan sayfasına yaz", desc: "Her ilanda flood risk otomatik gösterilir" },
      { title: "Riskli parselleri filtrele", desc: "Yüksek flood riskli parseller öneri listesinden çıkar" },
    ],
  },
  {
    no: 9, emoji: "🛣️", title: "Road Access Checker",
    category: "Due Diligence",
    summary: "Google Maps API ile parselin yola erişimi olup olmadığını otomatik doğrular.",
    time: "3 gün", color: "#84cc16",
    subs: [
      { title: "En yakın yol mesafesi", desc: "Google Roads API ile parsele en yakın asfalt/toprak yol" },
      { title: "Landlocked kontrolü", desc: "Çevresi tamamen başkasının arazisiyse alarm" },
      { title: "Yol türü tespiti", desc: "Asfalt / stabilize / toprak yol ayrımı" },
      { title: "Street View doğrulama", desc: "Otomatik Street View snapshot çekerek görsel kanıt" },
      { title: "İlana erişim notu", desc: "\"Paved road access\" veya \"Dirt road - 2WD\" otomatik yaz" },
    ],
  },
  {
    no: 10, emoji: "💸", title: "Back Taxes & Lien Checker",
    category: "Due Diligence",
    summary: "Parsel üzerindeki tüm vergi borçlarını ve hacizleri sorgular.",
    time: "4 gün", color: "#f97316",
    subs: [
      { title: "County vergi borcu sorgulama", desc: "Güncel vergi borcu tutarı ve kaç yıllık olduğu" },
      { title: "Federal lien kontrolü", desc: "IRS veya federal kurumlar tarafından haciz var mı" },
      { title: "HOA borcu kontrolü", desc: "Bölgede HOA varsa aidatlar ödenmiş mi" },
      { title: "Toplam borç hesaplama", desc: "Satın alma maliyetine otomatik ekle — gerçek maliyet" },
      { title: "Temiz tapu skoru", desc: "Tüm kontroller geçilince \"Clear Title ✓\" etiketi" },
    ],
  },
  {
    no: 11, emoji: "🤖", title: "AI Fiyat Analizi (Comps Bot)",
    category: "AI & Analiz",
    summary: "Son 12 aydaki benzer parsel satışlarını analiz edip gerçekçi piyasa değeri tahmini yapar.",
    time: "5 gün", color: "#8b5cf6",
    subs: [
      { title: "Benzer parsel bulma", desc: "Aynı county, benzer boyut, benzer zoning" },
      { title: "Satış fiyatı veritabanı", desc: "Zillow + Land.com + county records kombine" },
      { title: "Düzeltme faktörleri", desc: "Yol erişimi, utilities, şehre mesafe — fiyata ekle/çıkar" },
      { title: "Değer aralığı", desc: "\"$4,500 – $7,200 arasında satar\" tahmini üret" },
      { title: "Güven skoru", desc: "Yeterli comp varsa yüksek güven, yoksa \"veri yetersiz\" uyarısı" },
    ],
  },
  {
    no: 12, emoji: "📊", title: "AI Parsel Skorlama Botu",
    category: "AI & Analiz",
    summary: "Her parseli 0-100 arası puanlar: \"al\" / \"atla\" / \"araştır\" kararını otomatik verir.",
    time: "4 gün", color: "#a855f7",
    subs: [
      { title: "Kar marjı skoru", desc: "Maliyet vs tahmini satış fiyatı — %40 altı = kırmızı" },
      { title: "Likidite skoru", desc: "Bu bölgede son 6 ayda kaç satış olmuş" },
      { title: "Risk skoru", desc: "Flood, lien, landlocked — her biri puan düşürür" },
      { title: "Lokasyon skoru", desc: "Şehre mesafe, utilities, gelişim potansiyeli" },
      { title: "Final karar", desc: "🟢 AL (70+) / 🟡 ARAŞTIR (50-69) / 🔴 ATLA (50 altı)" },
    ],
  },
  {
    no: 13, emoji: "💬", title: "Lead Takip Botu",
    category: "Satış & CRM",
    summary: "Talep gelen lead'e 1 saat içinde otomatik iletişim başlatır, satışa taşır.",
    time: "3 gün", color: "#22c55e",
    subs: [
      { title: "Anlık e-posta", desc: "Lead form doldurur → 2 dakikada parsel detay maili gider" },
      { title: "WhatsApp mesajı", desc: "Telefon varsa WhatsApp'tan kişiselleştirilmiş mesaj" },
      { title: "Follow-up serisi", desc: "Cevap yoksa: 24s / 3 gün / 7 gün otomatik hatırlatma" },
      { title: "Sıcaklık takibi", desc: "Link açıldı mı, kaç kez bakıldı — hot/warm/cold etiket" },
      { title: "Admin bildirimi", desc: "Sıcak lead gelince sana anında Telegram bildirimi" },
    ],
  },
  {
    no: 14, emoji: "📣", title: "Sosyal Medya Bot",
    category: "Pazarlama",
    summary: "Yeni ilan yayınlandığında TikTok, Instagram ve Facebook'a otomatik içerik atar.",
    time: "4 gün", color: "#f43f5e",
    subs: [
      { title: "TikTok otomatik post", desc: "AI video + caption + hashtag → TikTok API ile yayınla" },
      { title: "Instagram Reels", desc: "9:16 video + hikaye formatı — Meta API" },
      { title: "Facebook ilanı", desc: "FB Marketplace + sayfa paylaşımı otomatik" },
      { title: "Caption AI", desc: "Her ilan için GPT ile 3 farklı caption üret, en iyisini seç" },
      { title: "Optimal zaman", desc: "En çok etkileşim alınan saatte otomatik gönder" },
      { title: "Performans takibi", desc: "Görüntülenme, tıklama, lead dönüşümünü admin'de göster" },
    ],
  },
  {
    no: 15, emoji: "⚠️", title: "Ödeme Gecikme Botu",
    category: "Satış & CRM",
    summary: "Taksit gecikmelerini izler, otomatik uyarılar gönderir, yasal süreci başlatır.",
    time: "3 gün", color: "#ef4444",
    subs: [
      { title: "D+1 e-posta", desc: "Ödeme günü geçince nazik hatırlatma maili" },
      { title: "D+7 WhatsApp", desc: "7 gün geçince WhatsApp + SMS ile ikinci uyarı" },
      { title: "D+15 resmi uyarı", desc: "Formal default notice e-postası — hukuki dil" },
      { title: "D+30 aksiyon", desc: "Admin'e bildir: \"parsel geri al\" veya \"uzlaşma yap\" seçeneği" },
      { title: "Otomatik parsel iptali", desc: "Onay sonrası sözleşme iptal, parsel tekrar satışa çıkar" },
      { title: "Default kayıt", desc: "Tüm default geçmişi raporlanır — Ahmet panelinde görünür" },
    ],
  },
  {
    no: 16, emoji: "✉️", title: "Direct Mail & Teklif Botu",
    category: "Pazarlama",
    summary: "Lob / Pebble API'leri üzerinden sahiplere all-cash teklif mektubu gönderir ve teslimatını takip eder.",
    time: "3 gün", color: "#ec4899",
    subs: [
      { title: "Teklif Şablonu", desc: "Piyasa değerine göre teklif mektubunu dinamik üretir" },
      { title: "API Entegrasyonu", desc: "Lob/Pebble üzerinden tek tıkla mektubu fiziki postaya verir" },
      { title: "Teslimat Takibi", desc: "Posta durumunu (Mailed, Delivered) gerçek zamanlı günceller" },
      { title: "İade Kartı Takibi", desc: "Geri dönen zarfların takibini ve sisteme girişini sağlar" }
    ]
  },
  {
    no: 17, emoji: "📐", title: "Subdivision & İmar Analiz Botu",
    category: "Due Diligence",
    summary: "County imar yönetmeliklerini tarayarak arsanın bölünme (subdivision) potansiyelini sorgular.",
    time: "5 gün", color: "#10b981",
    subs: [
      { title: "Yönetmelik Tarama", desc: "County imar kodlarını (Zoning Ordinance) indirip LLM ile analiz eder" },
      { title: "Minimum Lot Boyutu", desc: "Arsanın minimum kaç dönümlük parçalara bölünebileceğini doğrular" },
      { title: "Bölünme Şartları", desc: "Cephe genişliği, çekme mesafeleri ve yol erişimi kurallarını kontrol eder" },
      { title: "Potansiyel Hesaplama", desc: "Arsadan maksimum kaç alt parsel çıkacağını otomatik raporlar" }
    ]
  },
  {
    no: 18, emoji: "⚡", title: "Altyapı & Yakınlık Kontrol Botu",
    category: "Due Diligence",
    summary: "Arsanın elektrik direklerine, su şebekesine ve en yakın konuta mesafesini otomatik ölçer.",
    time: "4 gün", color: "#10b981",
    subs: [
      { title: "Elektrik Hattı Analizi", desc: "GIS katmanlarından en yakın elektrik direği ve hattını tespit eder" },
      { title: "Şebeke Sorgusu", desc: "Su ve kanalizasyon şebekesi sınırlarını GIS üzerinden kontrol eder" },
      { title: "Mesafe Ölçümü", desc: "En yakın yerleşim yerine veya konuta olan kuş uçuşu mesafeyi ölçer" },
      { title: "Raporlama", desc: "Altyapı durumunu (Elektrik/Su/Kanalizasyon) detay sayfasına not olarak ekler" }
    ]
  },
  {
    no: 19, emoji: "📢", title: "Çoklu Platform İlan Yayınlama Botu",
    category: "Pazarlama",
    summary: "Satın alınan arsaları LandWatch, Craigslist, FB Marketplace ve Zillow'da aynı anda yayına alır.",
    time: "4 gün", color: "#ec4899",
    subs: [
      { title: "LandWatch Entegrasyonu", desc: "Land.com grubu API/Feed sistemiyle ilan detaylarını senkronize eder" },
      { title: "Craigslist Otomasyonu", desc: "Craigslist üzerinde hedeflenen şehirlerde otomatik ilan oluşturur" },
      { title: "Marketplace Senkronizasyonu", desc: "Facebook Marketplace ve ilan gruplarında otomatik listeleme yapar" },
      { title: "Zillow Listing", desc: "Zillow For Sale By Owner (FSBO) ilanını otomatik hazırlar" }
    ]
  },
  {
    no: 20, emoji: "🎯", title: "Alıcı Eşleştirme & Bülten Botu",
    category: "Satış & CRM",
    summary: "Yeni eklenen arsayı, kriterleri uyan aktif alıcılara otomatik eşleştirip SMS ve e-posta gönderir.",
    time: "3 gün", color: "#f59e0b",
    subs: [
      { title: "Alıcı Kriter Filtresi", desc: "Alıcı listesindeki bütçe, eyalet ve acres tercihlerini tarar" },
      { title: "Otomatik Eşleşme", desc: "Yeni arsa ile uyumlu en sıcak 50 alıcı adayını tespit eder" },
      { title: "SMS / E-posta Kampanyası", desc: "Eşleşen alıcılara anlık kişiselleştirilmiş teklif gönderir" },
      { title: "Geri Dönüş Takibi", desc: "Teklife tıklayan veya yanıt veren alıcıları CRM'de üste taşır" }
    ]
  },
  {
    no: 21, emoji: "📸", title: "Drone Çekim Rezervasyon Botu",
    category: "Due Diligence",
    summary: "Sözleşmesi imzalanan arsa için en yakın yerel drone fotoğrafçısını bulup otomatik rezervasyon yapar.",
    time: "3 gün", color: "#10b981",
    subs: [
      { title: "Lokasyon Eşleştirme", desc: "Arsanın koordinatlarına en yakın drone fotoğrafçılarını tarar" },
      { title: "Fiyat Teklifi", desc: "En uygun fiyatlı çekim paketi için otomatik rezervasyon talebi gönderir" },
      { title: "Teslimat Kontrolü", desc: "Yüklenen drone fotoğraflarını ve videolarını otomatik Google Drive'a çeker" },
      { title: "İlan Hazırlığı", desc: "Gelen görsel dosyalarını ilan editörüne taslak olarak iliştirir" }
    ]
  }
];

const categories = [...new Set(bots.map(b => b.category))];

const CAT_COLOR: Record<string, string> = {
  "Veri Toplama": "#3b82f6",
  "Due Diligence": "#10b981",
  "AI & Analiz": "#8b5cf6",
  "Satış & CRM": "#f59e0b",
  "Pazarlama": "#ec4899",
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  "bekliyor": { label: "Bekliyor", color: "#94a3b8", bg: "#f1f5f9", icon: <Circle className="w-3 h-3" /> },
  "devam ediyor": { label: "Devam Ediyor", color: "#f59e0b", bg: "#fffbeb", icon: <Clock className="w-3 h-3" /> },
  "tamamlandı": { label: "Tamamlandı", color: "#22c55e", bg: "#f0fdf4", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function KickoffPage() {
  const [open, setOpen] = useState<number | null>(null);
  const [catFilter, setCatFilter] = useState<string>("Tümü");
  const [statuses, setStatuses] = useState<Record<number, Status>>(INITIAL_STATUSES);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [commentOpen, setCommentOpen] = useState<number | null>(null);
  const [isCodeMode, setIsCodeMode] = useState<Record<number, boolean>>({});
  const [codeLang, setCodeLang] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("Ahmet");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const a = localStorage.getItem("terralot_author");
    if (a) setAuthorName(a);
    fetchData();
  }, []);

  async function fetchData() {
    const [{ data: statusData }, { data: commentData }] = await Promise.all([
      supabase.from("bot_statuses").select("*"),
      supabase.from("bot_comments").select("*").order("created_at", { ascending: true }),
    ]);

    if (statusData) {
      const map: Record<number, Status> = { ...INITIAL_STATUSES };
      statusData.forEach((r: { bot_no: number; status: Status }) => { map[r.bot_no] = r.status; });
      setStatuses(map);
    }

    if (commentData) {
      const map: Record<number, Comment[]> = {};
      commentData.forEach((r: { id: string; bot_no: number; author: string; text: string; is_code: boolean; lang: string; created_at: string }) => {
        const c: Comment = {
          id: r.id,
          text: r.text,
          author: r.author,
          date: new Date(r.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
          isCode: r.is_code,
          lang: r.lang,
        };
        if (!map[r.bot_no]) map[r.bot_no] = [];
        map[r.bot_no].push(c);
      });
      setComments(map);
    }
  }

  async function setStatus(no: number, status: Status) {
    setStatuses(prev => ({ ...prev, [no]: status }));
    await supabase.from("bot_statuses").upsert({ bot_no: no, status, updated_at: new Date().toISOString() });
  }

  async function addComment(no: number) {
    const text = (commentInputs[no] ?? "").trim();
    if (!text) return;
    const { data, error } = await supabase
      .from("bot_comments")
      .insert({ bot_no: no, author: authorName, text, is_code: isCodeMode[no] ?? false, lang: codeLang[no] ?? "python" })
      .select()
      .single();
    if (!error && data) {
      const newComment: Comment = {
        id: data.id,
        text: data.text,
        author: data.author,
        date: new Date(data.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        isCode: data.is_code,
        lang: data.lang,
      };
      setComments(prev => ({ ...prev, [no]: [...(prev[no] ?? []), newComment] }));
      setCommentInputs(prev => ({ ...prev, [no]: "" }));
    }
  }

  function copyCode(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function deleteComment(no: number, id: string) {
    await supabase.from("bot_comments").delete().eq("id", id);
    setComments(prev => ({ ...prev, [no]: (prev[no] ?? []).filter(c => c.id !== id) }));
  }

  const done = Object.values(statuses).filter(s => s === "tamamlandı").length;
  const inProgress = Object.values(statuses).filter(s => s === "devam ediyor").length;
  const filtered = catFilter === "Tümü" ? bots : bots.filter(b => b.category === catFilter);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "-apple-system,'Inter',sans-serif", color: "#0f172a" }}>
      <div className="max-w-3xl mx-auto px-5 py-16">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: "#94a3b8" }}>TerraLot · Otomasyon Planı</p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3" style={{ color: "#0f172a" }}>{bots.length} Bot & Otomasyon</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Sistem kurulunca veri toplama, analiz, satış ve pazarlama tamamen otomatik çalışır.
          </p>

          {/* Progress bar */}
          <div className="mt-6 p-4 rounded-2xl border" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "#475569" }}>Genel İlerleme</span>
              <span className="text-xs font-bold" style={{ color: "#0f172a" }}>{done}/{bots.length} tamamlandı</span>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: "#e2e8f0" }}>
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${(done / bots.length) * 100}%`, background: "#22c55e" }} />
            </div>
            <div className="flex gap-4 mt-3 justify-center">
              <span className="text-[11px] flex items-center gap-1" style={{ color: "#22c55e" }}>
                <CheckCircle2 className="w-3 h-3" /> {done} tamamlandı
              </span>
              <span className="text-[11px] flex items-center gap-1" style={{ color: "#f59e0b" }}>
                <Clock className="w-3 h-3" /> {inProgress} devam ediyor
              </span>
              <span className="text-[11px] flex items-center gap-1" style={{ color: "#94a3b8" }}>
                <Circle className="w-3 h-3" /> {bots.length - done - inProgress} bekliyor
              </span>
            </div>
          </div>

          {/* Bu Haftanın Odağı */}
          <div className="mt-4 p-4 rounded-2xl border text-left transition-all hover:shadow-xs" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", borderColor: "#e2e8f0" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 rounded-lg" style={{ background: "#eff6ff" }}>
                <Target className="w-4 h-4" style={{ color: "#3b82f6" }} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#3b82f6" }}>Bu Haftanın Odağı (Sprint 1)</span>
            </div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#1e293b" }}>
              Veri Toplama Altyapısı & İlk Scraper'ların Kurulması
            </p>
            <ul className="text-xs space-y-1 pl-1" style={{ color: "#64748b" }}>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" /> Zillow Scraper Botu için filtreleme ve veri çekme algoritmaları.
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" /> Supabase veritabanı şemasının hazırlanması ve bağlantılarının testi.
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" /> LandWatch portal tarama testlerinin başlatılması.
              </li>
            </ul>
          </div>

          {/* Hedef Performans Metrikleri */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="p-3 rounded-2xl border text-center transition-all hover:border-violet-200 hover:shadow-xs" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
              <div className="mx-auto w-7 h-7 rounded-full flex items-center justify-center mb-1.5" style={{ background: "#f5f3ff" }}>
                <BarChart3 className="w-3.5 h-3.5" style={{ color: "#8b5cf6" }} />
              </div>
              <p className="text-lg font-extrabold tracking-tight" style={{ color: "#8b5cf6" }}>5,000+</p>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Günlük Tarama</p>
            </div>
            <div className="p-3 rounded-2xl border text-center transition-all hover:border-emerald-200 hover:shadow-xs" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
              <div className="mx-auto w-7 h-7 rounded-full flex items-center justify-center mb-1.5" style={{ background: "#f0fdf4" }}>
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
              </div>
              <p className="text-lg font-extrabold tracking-tight" style={{ color: "#10b981" }}>&lt; 3 sn</p>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>AI Karar Hızı</p>
            </div>
            <div className="p-3 rounded-2xl border text-center transition-all hover:border-amber-200 hover:shadow-xs" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
              <div className="mx-auto w-7 h-7 rounded-full flex items-center justify-center mb-1.5" style={{ background: "#fffbeb" }}>
                <Clock className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
              </div>
              <p className="text-lg font-extrabold tracking-tight" style={{ color: "#f59e0b" }}>&lt; 5 dk</p>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>İlk İletişim</p>
            </div>
            <div className="p-3 rounded-2xl border text-center transition-all hover:border-rose-200 hover:shadow-xs" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
              <div className="mx-auto w-7 h-7 rounded-full flex items-center justify-center mb-1.5" style={{ background: "#fff1f2" }}>
                <Send className="w-3.5 h-3.5" style={{ color: "#f43f5e" }} />
              </div>
              <p className="text-lg font-extrabold tracking-tight" style={{ color: "#f43f5e" }}>~$0.65</p>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Mektup Maliyeti</p>
            </div>
          </div>

        </div>

        {/* Proje Yol Haritası */}
        <div className="mb-8 p-5 rounded-2xl border" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
          <div className="flex items-center gap-2 mb-4">
            <Milestone className="w-4 h-4" style={{ color: "#0f172a" }} />
            <h3 className="text-sm font-bold tracking-tight uppercase" style={{ color: "#0f172a" }}>Geliştirme Yol Haritası (Fazlar)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                phase: "Faz 1",
                title: "Veri Toplama & Altyapı",
                duration: "2 Hafta",
                status: "Aktif",
                statusColor: "#3b82f6",
                statusBg: "#eff6ff",
                progress: 35,
                desc: "Zillow, LandWatch, Craigslist scraperları ve veritabanı kurulumu."
              },
              {
                phase: "Faz 2",
                title: "GIS & Tapu Analizi",
                duration: "2 Hafta",
                status: "Planlandı",
                statusColor: "#10b981",
                statusBg: "#f0fdf4",
                progress: 0,
                desc: "GIS, FEMA, yol erişim kontrolleri ve tapu/haciz sorgu entegrasyonu."
              },
              {
                phase: "Faz 3",
                title: "AI Analiz & Karar Skorlama",
                duration: "1.5 Hafta",
                status: "Planlandı",
                statusColor: "#8b5cf6",
                statusBg: "#f5f3ff",
                progress: 0,
                desc: "Yapay zeka comps analizi, fiyatlama modeli ve arazi skorlama botları."
              },
              {
                phase: "Faz 4",
                title: "CRM, Satış & Otomatik Pazarlama",
                duration: "2.5 Hafta",
                status: "Planlandı",
                statusColor: "#f59e0b",
                statusBg: "#fffbeb",
                progress: 0,
                desc: "Lead takibi, fiziki mektup otomasyonu, otomatik pazarlama kanalları."
              }
            ].map((ph, idx) => (
              <div key={idx} className="p-4 rounded-xl border transition-all hover:shadow-xs flex flex-col justify-between" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{ph.phase}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ color: ph.statusColor, background: ph.statusBg }}>
                      {ph.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold mb-1" style={{ color: "#0f172a" }}>{ph.title}</h4>
                  <p className="text-[11px] leading-relaxed mb-2" style={{ color: "#64748b" }}>{ph.desc}</p>
                </div>
                <div className="mt-2 pt-2 border-t" style={{ borderColor: "#e2e8f0" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Süre: {ph.duration}</span>
                    {ph.progress > 0 && <span className="text-[10px] font-bold" style={{ color: ph.statusColor }}>%{ph.progress}</span>}
                  </div>
                  {ph.progress > 0 && (
                    <div className="w-full rounded-full h-1" style={{ background: "#e2e8f0" }}>
                      <div className="h-1 rounded-full animate-pulse" style={{ width: `${ph.progress}%`, background: ph.statusColor }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sistem Entegrasyonları ve Servis Durumları */}
        <div className="mb-8 p-5 rounded-2xl border" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4" style={{ color: "#0f172a" }} />
            <h3 className="text-sm font-bold tracking-tight uppercase" style={{ color: "#0f172a" }}>Sistem Entegrasyonları & API Durumları</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "Zillow Scraper", type: "Veri Çekici", status: "Hazırlanıyor", color: "#3b82f6", active: true },
              { name: "LandWatch Scraper", type: "Veri Çekici", status: "Hazırlanıyor", color: "#3b82f6", active: true },
              { name: "County GIS & Maps", type: "Coğrafi Servis", status: "Planlandı", color: "#94a3b8", active: false },
              { name: "FEMA Flood Zone", type: "Risk API", status: "Planlandı", color: "#94a3b8", active: false },
              { name: "OpenAI GPT-4", type: "AI Motoru", status: "Hazır (Bağlı)", color: "#10b981", active: true },
              { name: "Supabase DB & Realtime", type: "Veritabanı", status: "Aktif", color: "#10b981", active: true },
              { name: "Lob / Pebble Mail", type: "Posta API", status: "Planlandı", color: "#94a3b8", active: false },
              { name: "Twilio / WhatsApp", type: "SMS & Chat API", status: "Planlandı", color: "#94a3b8", active: false },
            ].map((int, idx) => (
              <div key={idx} className="p-3 rounded-xl border flex flex-col justify-between" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                <div>
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-400 border border-slate-100">{int.type}</span>
                  <h4 className="text-xs font-bold mt-2" style={{ color: "#0f172a" }}>{int.name}</h4>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className={`w-2 h-2 rounded-full ${int.active ? 'animate-pulse' : ''}`} style={{ background: int.active ? int.color : "#94a3b8" }} />
                  <span className="text-[10px] font-medium" style={{ color: "#64748b" }}>{int.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Yatırım & Eyalet Odak Bölgeleri (Hotspots) */}
        <div className="mb-8 p-5 rounded-2xl border bg-white" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4" style={{ color: "#0f172a" }} />
            <h3 className="text-sm font-bold tracking-tight uppercase" style={{ color: "#0f172a" }}>Yatırım & Eyalet Odak Bölgeleri (Hotspots)</h3>
          </div>
          
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Botların veri çekme, comps analizi ve mektup gönderiminde önceliklendireceği pilot eyaletler ve değer kazanacak hedef bölgeler.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                state: "Texas (TX) — Dallas Çevresi",
                desc: "Dallas-Fort Worth çeperleri (özellikle Sherman/Denison bölgesi). Yoğun nüfus artışı ve sanayi yatırımları arsa talebini tetikliyor. 5+ dönümlük parseller sıfır imar onayıyla tescil edilerek hızlıca nakde çevrilebilir.",
                tag: "Bölgesel Büyüme & Hızlı Satış",
                color: "#3b82f6",
                bg: "#eff6ff"
              },
              {
                state: "Arizona (AZ) — Mohave & Cochise",
                desc: "Kingman, Golden Valley ve Cochise çöl vadileri. Off-grid yaşam ve tiny house yerleşimcilerinden yoğun talep görüyor. 10+ dönümlük arazi bölünmeleri county imar onayından muaftır.",
                tag: "Off-Grid Cabin & Karavan",
                color: "#10b981",
                bg: "#f0fdf4"
              },
              {
                state: "New Mexico (NM) — Valencia & Socorro",
                desc: "Albuquerque dış çeperleri. 35+ dönüm üzeri bölünmeler resmi komisyon onayından muaftır. Yıllık vergi yükü yok denecek kadar azdır ($15-$30), uzun süreli elde tutma ve koruma için idealdir.",
                tag: "Minimum Vergi & Geniş Arazi",
                color: "#8b5cf6",
                bg: "#f5f3ff"
              },
              {
                state: "Colorado (CO) — Costilla & Alamosa",
                desc: "Blanca Peak etekleri ve Sanchez Reservoir göl çevresi. Alpin dağ manzaraları ve doğal yaşam arayan rekreasyonel alıcılar için cazip comps verilerine sahiptir.",
                tag: "Rekreasyon & Manzara",
                color: "#f59e0b",
                bg: "#fffbeb"
              }
            ].map((hot, idx) => (
              <div key={idx} className="p-4 rounded-xl border transition-all hover:shadow-xs" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-slate-900">{hot.state}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase" style={{ color: hot.color, background: hot.bg }}>
                    {hot.tag}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">{hot.desc}</p>
              </div>
            ))}
          </div>

          {/* Referans Kaynaklar */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Referans Analiz Kaynakları:</span>
            <div className="flex gap-4">
              <a 
                href="https://www.landwatch.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                1. LandWatch Eyalet Analizleri
              </a>
              <a 
                href="https://www.newsweek.com/megaprojects-construction-across-us-11182077" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                2. US Megaprojects (Newsweek)
              </a>
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["Tümü", ...categories].map(c => (
            <button key={c} onClick={() => { setCatFilter(c); setOpen(null); }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={{
                background: catFilter === c ? (CAT_COLOR[c] ?? "#0f172a") + "15" : "#f8fafc",
                borderColor: catFilter === c ? (CAT_COLOR[c] ?? "#0f172a") + "60" : "#e2e8f0",
                color: catFilter === c ? (CAT_COLOR[c] ?? "#0f172a") : "#64748b",
              }}>
              {c}
            </button>
          ))}
        </div>

        {/* Bot list */}
        <div className="space-y-2">
          {filtered.map((bot) => {
            const isOpen = open === bot.no;
            const status = statuses[bot.no] ?? "bekliyor";
            const sc = STATUS_CONFIG[status];
            const botComments = comments[bot.no] ?? [];
            const isCommentOpen = commentOpen === bot.no;

            return (
              <div key={bot.no} className="rounded-2xl border overflow-hidden transition-all"
                style={{ borderColor: isOpen ? `${bot.color}40` : "#e2e8f0", background: isOpen ? `${bot.color}08` : "#fafafa" }}>

                {/* Header row */}
                <button onClick={() => setOpen(isOpen ? null : bot.no)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left">
                  <span className="text-xl shrink-0">{bot.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: bot.color }}>{bot.category}</span>
                      <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>{bot.title}</span>
                    </div>
                    {!isOpen && <p className="text-xs mt-0.5 truncate" style={{ color: "#94a3b8" }}>{bot.summary}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status badge */}
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: sc.bg, color: sc.color }}>
                      {sc.icon}{sc.label}
                    </span>
                    {botComments.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "#94a3b8" }}>
                        <MessageSquare className="w-3 h-3" />{botComments.length}
                      </span>
                    )}
                    <span className="text-[11px]" style={{ color: "#94a3b8" }}>⏱ {bot.time}</span>
                    <ChevronDown className="w-4 h-4 transition-transform shrink-0"
                      style={{ color: "#94a3b8", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5">
                    <p className="text-sm mb-4 leading-relaxed" style={{ color: "#64748b" }}>{bot.summary}</p>

                    {/* Sub-tasks */}
                    <div className="space-y-2 mb-5">
                      {bot.subs.map((sub, i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: "#f1f5f9" }}>
                          <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: bot.color }}>→</span>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1e293b" }}>{sub.title}</p>
                            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#64748b" }}>{sub.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Status selector */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-semibold" style={{ color: "#64748b" }}>Durum:</span>
                      {(["bekliyor", "devam ediyor", "tamamlandı"] as Status[]).map(s => {
                        const cfg = STATUS_CONFIG[s];
                        const active = status === s;
                        return (
                          <button key={s} onClick={() => setStatus(bot.no, s)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
                            style={{
                              background: active ? cfg.bg : "transparent",
                              borderColor: active ? cfg.color + "60" : "#e2e8f0",
                              color: active ? cfg.color : "#94a3b8",
                            }}>
                            {cfg.icon}{cfg.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Comments */}
                    <div className="border-t pt-4" style={{ borderColor: "#e2e8f0" }}>
                      <button onClick={() => setCommentOpen(isCommentOpen ? null : bot.no)}
                        className="flex items-center gap-1.5 text-xs font-semibold mb-3"
                        style={{ color: "#64748b" }}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        Yorumlar {botComments.length > 0 && `(${botComments.length})`}
                        <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: isCommentOpen ? "rotate(180deg)" : "rotate(0)" }} />
                      </button>

                      {isCommentOpen && (
                        <div>
                          {botComments.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {botComments.map(c => (
                                <div key={c.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                                  <div className="flex items-center justify-between px-3 py-2" style={{ background: "#f8fafc", borderBottom: c.isCode ? "1px solid #e2e8f0" : "none" }}>
                                    <div className="flex items-center gap-2">
                                      {c.isCode
                                        ? <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#1e293b", color: "#7dd3fc" }}><Code2 className="w-2.5 h-2.5" />{c.lang}</span>
                                        : <AlignLeft className="w-3 h-3" style={{ color: "#94a3b8" }} />
                                      }
                                      <span className="text-[11px] font-bold" style={{ color: "#0f172a" }}>{c.author}</span>
                                      <span className="text-[10px]" style={{ color: "#94a3b8" }}>{c.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {c.isCode && (
                                        <button onClick={() => copyCode(c.id, c.text)} className="flex items-center gap-1 text-[10px]" style={{ color: copied === c.id ? "#22c55e" : "#94a3b8" }}>
                                          {copied === c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                          {copied === c.id ? "Kopyalandı" : "Kopyala"}
                                        </button>
                                      )}
                                      <button onClick={() => deleteComment(bot.no, c.id)} className="text-[10px]" style={{ color: "#cbd5e1" }}>✕</button>
                                    </div>
                                  </div>
                                  {c.isCode
                                    ? <pre className="text-xs p-3 overflow-x-auto" style={{ background: "#0f172a", color: "#e2e8f0", fontFamily: "'SF Mono', 'Fira Code', monospace", margin: 0 }}>{c.text}</pre>
                                    : <p className="text-sm px-3 py-2.5" style={{ color: "#475569", background: "#ffffff" }}>{c.text}</p>
                                  }
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Author name */}
                          <div className="flex gap-2 mb-2">
                            <input
                              className="flex-1 text-xs px-3 py-2 rounded-xl border outline-none"
                              style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#0f172a" }}
                              placeholder="İsminiz"
                              value={authorName}
                              onChange={e => { setAuthorName(e.target.value); localStorage.setItem("terralot_author", e.target.value); }}
                            />
                          </div>

                          {/* Mode toggle + lang selector */}
                          <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => setIsCodeMode(prev => ({ ...prev, [bot.no]: false }))}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                              style={{ background: !(isCodeMode[bot.no]) ? "#f1f5f9" : "transparent", borderColor: !(isCodeMode[bot.no]) ? "#cbd5e1" : "#e2e8f0", color: !(isCodeMode[bot.no]) ? "#475569" : "#94a3b8" }}>
                              <AlignLeft className="w-3 h-3" /> Yorum
                            </button>
                            <button onClick={() => setIsCodeMode(prev => ({ ...prev, [bot.no]: true }))}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                              style={{ background: isCodeMode[bot.no] ? "#0f172a" : "transparent", borderColor: isCodeMode[bot.no] ? "#334155" : "#e2e8f0", color: isCodeMode[bot.no] ? "#7dd3fc" : "#94a3b8" }}>
                              <Code2 className="w-3 h-3" /> Kod
                            </button>
                            {isCodeMode[bot.no] && (
                              <select
                                className="text-[11px] px-2 py-1 rounded-lg border outline-none"
                                style={{ borderColor: "#334155", background: "#1e293b", color: "#94a3b8" }}
                                value={codeLang[bot.no] ?? "python"}
                                onChange={e => setCodeLang(prev => ({ ...prev, [bot.no]: e.target.value }))}>
                                {["python", "javascript", "typescript", "bash", "sql", "json", "yaml"].map(l => (
                                  <option key={l} value={l}>{l}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Comment input */}
                          <div className="flex gap-2">
                            {isCodeMode[bot.no]
                              ? <textarea
                                  className="flex-1 text-xs px-3 py-2 rounded-xl border outline-none resize-none"
                                  style={{ borderColor: "#334155", background: "#0f172a", color: "#e2e8f0", fontFamily: "'SF Mono', 'Fira Code', monospace", minHeight: "80px" }}
                                  placeholder={`# kod yapıştır veya yaz...\n`}
                                  value={commentInputs[bot.no] ?? ""}
                                  onChange={e => setCommentInputs(prev => ({ ...prev, [bot.no]: e.target.value }))}
                                />
                              : <input
                                  ref={inputRef}
                                  className="flex-1 text-sm px-3 py-2 rounded-xl border outline-none"
                                  style={{ borderColor: "#e2e8f0", background: "#ffffff", color: "#0f172a" }}
                                  placeholder="Yorum yaz..."
                                  value={commentInputs[bot.no] ?? ""}
                                  onChange={e => setCommentInputs(prev => ({ ...prev, [bot.no]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") addComment(bot.no); }}
                                />
                            }
                            <button onClick={() => addComment(bot.no)}
                              className="px-3 py-2 rounded-xl flex items-center justify-center self-end"
                              style={{ background: bot.color, color: "#fff" }}>
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sıkça Sorulan Sorular */}
        <div className="mt-8 mb-6 border-t pt-8" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-4 h-4" style={{ color: "#0f172a" }} />
            <h3 className="text-sm font-bold tracking-tight uppercase" style={{ color: "#0f172a" }}>Sıkça Sorulan Sorular (SSS)</h3>
          </div>

          <div className="space-y-2">
            {[
              {
                q: "Botlar engellenmeden nasıl stabil çalışacak?",
                a: "Zillow, Land Watch ve Craigslist gibi platformların bot korumalarını (Cloudflare, IP engelleme) aşmak için rotasyonel konut (residential) proxy ağları ve headless tarayıcı (Playwright/Puppeteer) parmak izi taklit yöntemleri kullanılacaktır."
              },
              {
                q: "Yıllık API ve Sunucu maliyetleri ne kadar olur?",
                a: "Çoğu bot sunucusuz (Serverless Edge Functions) mimaride çalışacağı için temel sunucu maliyeti sıfıra yakındır. OpenAI ve Google Maps API kullanımları sorgu başına ücretlendirilir (aylık tahmini $20-$50 arası)."
              },
              {
                q: "AI comps analizlerinin güvenilirliğini nasıl test edeceğiz?",
                a: "AI fiyat belirleme motoru yayına girmeden önce, geçmişte satılmış 500+ arsa verisiyle (backtesting) test edilecek. Gerçek satış fiyatlarıyla AI'ın tahmin ettiği fiyatlar karşılaştırılacak ve sapma payı %5'in altına indirilene kadar ince ayar yapılacaktır."
              },
              {
                q: "Veri havuzu ne sıklıkla güncellenecek?",
                a: "Veri toplama botları 7/24 aktif çalışacak. Zillow ve Facebook Marketplace her saat başı taranırken, County vergi borçlu listeleri haftalık olarak güncellenecektir."
              }
            ].map((faq, idx) => {
              const isFaqOpen = faqOpen === idx;
              return (
                <div key={idx} className="rounded-xl border overflow-hidden transition-all bg-white" style={{ borderColor: isFaqOpen ? "#cbd5e1" : "#e2e8f0" }}>
                  <button onClick={() => setFaqOpen(isFaqOpen ? null : idx)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-all">
                    <span className="text-xs font-semibold text-slate-800">{faq.q}</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: "#94a3b8", transform: isFaqOpen ? "rotate(180deg)" : "rotate(0)" }} />
                  </button>
                  {isFaqOpen && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-50">
                      <p className="text-xs leading-relaxed text-slate-500">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs mt-12" style={{ color: "#cbd5e1" }}>
          TerraLot · {new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
