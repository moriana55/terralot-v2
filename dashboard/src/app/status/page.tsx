import { CheckCircle2, Circle, Clock, AlertCircle, ArrowUpRight } from "lucide-react";

export const metadata = { title: "Proje Durum Raporu" };

/* ---------- data ---------- */

type Status = "done" | "progress" | "planned" | "blocked";

const STATUS_META: Record<Status, { label: string; bg: string; color: string }> = {
  done: { label: "Tamamlandı", bg: "#dcfce7", color: "#15803d" },
  progress: { label: "Devam Ediyor", bg: "#fef9c3", color: "#a16207" },
  planned: { label: "Planlandı", bg: "#e0e7ff", color: "#4338ca" },
  blocked: { label: "Karar Bekliyor", bg: "#fee2e2", color: "#b91c1c" },
};

interface Item { name: string; desc?: string; status: Status }

const modules: { emoji: string; title: string; pct: number; items: Item[] }[] = [
  {
    emoji: "🌐",
    title: "Halka Açık Web Platformu",
    pct: 95,
    items: [
      { name: "Landing page", desc: "Hero, özellikler, fiyatlandırma, waitlist formu", status: "done" },
      { name: "İlan listeleme + detay sayfaları", desc: "Filtreleme, harita görünümü (Leaflet), favoriler", status: "done" },
      { name: "Eyalet bazlı SEO sayfaları", desc: "18 eyalet için /land-for-sale/[state] — Google organik trafik", status: "done" },
      { name: "Blog altyapısı", desc: "3 makale yayında (owner financing, ucuz eyaletler, pasif gelir)", status: "done" },
      { name: "Karşılaştırma sayfası", desc: "Rakip platformlarla yan yana kıyas", status: "done" },
      { name: "Off-market vitrin sayfası", desc: "Üyelere özel fırsat listesi görünümü", status: "done" },
      { name: "Rezervasyon + iletişim formları", desc: "ReserveModal, InquiryModal komponentleri", status: "done" },
    ],
  },
  {
    emoji: "🛠️",
    title: "Admin Paneli (Operasyon)",
    pct: 90,
    items: [
      { name: "Genel dashboard", desc: "Portföy istatistikleri, son ilanlar", status: "done" },
      { name: "İlan yönetimi (Listings)", status: "done" },
      { name: "Lead / talep takibi", status: "done" },
      { name: "Ödeme takibi (Payments)", status: "done" },
      { name: "Finansal analitik", desc: "Gelir, maliyet, kâr marjı raporları", status: "done" },
      { name: "Subdivision (parselleme) modülü", desc: "Büyük arsayı bölüp satma takibi", status: "done" },
      { name: "Owner finance takibi", desc: "Taksitli satış sözleşmeleri", status: "done" },
      { name: "Acquisitions (satın alma) modülü", status: "done" },
      { name: "Parcel Explorer", desc: "Parsel keşif ekranı", status: "done" },
      { name: "Pitch & Plan sunum sayfası", status: "done" },
    ],
  },
  {
    emoji: "🤝",
    title: "Network & Deal Flow (Referral Altyapısı)",
    pct: 85,
    items: [
      { name: "Contact yönetimi", desc: "Wholesaler / Scout / Realtor / Investor / Buyer rolleri", status: "done" },
      { name: "Deal pipeline", desc: "NEW → EVALUATING → PRESENTED → ACCEPTED → CLOSED akışı", status: "done" },
      { name: "Referral komisyon takibi", desc: "PENDING → INVOICED → PAID durumları, DB şeması hazır", status: "done" },
      { name: "Deal Map", desc: "Harita üzerinde deal görselleştirme", status: "done" },
      { name: "Direct Mail modülü", desc: "Arsa sahiplerine mektup kampanyası", status: "done" },
      { name: "Aktivite akışı", status: "done" },
      { name: "Alıcı referral programı", desc: "\"Arkadaşını getir $50 kazan\" — müşteri tarafı otomasyon", status: "planned" },
    ],
  },
  {
    emoji: "📊",
    title: "Yatırımcı Portalı (Ahmet'in Paneli)",
    pct: 80,
    items: [
      { name: "Overview dashboard", desc: "Parsel sayısı, portföy değeri, MRR, %60/%40 gelir paylaşımı, P&L özeti", status: "done" },
      { name: "Portföy sayfası", desc: "Tüm parseller, maliyet/satış/taksit, ödeme progress", status: "done" },
      { name: "Finansal rapor", desc: "Aylık gelir trendi, parsel bazlı P&L tablosu", status: "done" },
      { name: "Ödeme takip ekranı", desc: "Tahsil edilen / bekleyen / geciken", status: "done" },
      { name: "Deal pipeline görünümü", desc: "Kanban — yeni fırsatlar şeffaf şekilde izlenir", status: "done" },
      { name: "Referral network ekranı", status: "done" },
      { name: "Doküman arşivi", desc: "Tüm yatırımcı dokümanlarına erişim", status: "done" },
      { name: "Canlı veri bağlantısı", desc: "Şu an örnek veri — production DB bağlanınca gerçek rakamlar", status: "progress" },
      { name: "Giriş sistemi (Clerk)", desc: "Kod hazır, production key + Ahmet'in davet edilmesi kaldı", status: "progress" },
    ],
  },
  {
    emoji: "🤖",
    title: "TerraLot OS — AI Analiz Aracı (Ayrı Uygulama)",
    pct: 75,
    items: [
      { name: "AI Arsa Keşif Motoru", desc: "Vergi borçlu parselleri tarama, kâr marjı + satılabilirlik skoru", status: "done" },
      { name: "GIS & Due Diligence Hub", desc: "Harita katmanları, taşkın bölgesi, yol erişimi, comps analizi", status: "done" },
      { name: "Finansman & Amortisman Simülatörü", desc: "Taksit planı senaryoları, ROI hesaplama", status: "done" },
      { name: "Yatırımcı sunum modülü", desc: "MRR hedefi, unit economics, ortaklık modeli", status: "done" },
      { name: "Gerçek county verisi entegrasyonu", desc: "Şu an örnek veri — id.land / county GIS API bağlanacak", status: "planned" },
    ],
  },
  {
    emoji: "📁",
    title: "Dokümantasyon & Araştırma",
    pct: 100,
    items: [
      { name: "Pazar araştırması", desc: "PDF + MD, yatırımcıya sunuma hazır", status: "done" },
      { name: "Rakip analizi", status: "done" },
      { name: "İş planı & finansal model", desc: "5 yıllık projeksiyon, unit economics", status: "done" },
      { name: "Teknoloji & platform dokümanı", status: "done" },
      { name: "Ortaklık teklifi", desc: "%60/%40 model, IP koruması, çıkış stratejisi", status: "done" },
      { name: "Yatırımcı sunumu (pitch deck)", status: "done" },
      { name: "50 eyalet arazi araştırması + subdivision araştırması", status: "done" },
    ],
  },
];

const remaining: { emoji: string; title: string; desc: string; owner: "yigit" | "ahmet" | "ikisi"; eta: string; status: Status }[] = [
  { emoji: "🗄️", title: "Production veritabanı (Neon Postgres)", desc: "Prisma şema hazır — migrate + gerçek verilerin girilmesi. Sonrasında tüm paneller canlı veriyle çalışır.", owner: "yigit", eta: "1-2 gün", status: "progress" },
  { emoji: "🔐", title: "Giriş sistemi production'a alma", desc: "Clerk production key, Ahmet'e investor (salt-okunur) rolüyle davet.", owner: "yigit", eta: "1 gün", status: "progress" },
  { emoji: "💳", title: "Stripe ödeme entegrasyonu", desc: "Peşinat + aylık taksit otomatik tahsilat. Ahmet'in US LLC + banka hesabı (Mercury) gerekiyor — Stripe hesabı buna bağlanır.", owner: "ikisi", eta: "LLC sonrası 3-4 gün", status: "blocked" },
  { emoji: "🏢", title: "Wyoming LLC + Mercury banka hesabı", desc: "Yasal yapı. LLC ~$100, 1 hafta. Stripe ve tapu işlemleri için ön koşul.", owner: "ahmet", eta: "1 hafta", status: "blocked" },
  { emoji: "🎁", title: "Alıcı referral programı", desc: "Her alıcıya özel referral linki, $50 kredi otomasyonu, admin onay ekranı. DB şeması hazır, müşteri tarafı yazılacak.", owner: "yigit", eta: "3-4 gün", status: "planned" },
  { emoji: "🕵️", title: "Off-market modülü genişletme", desc: "Üyelik duvarı arkasında özel fırsatlar, e-posta bildirimleri, \"erken erişim\" listesi.", owner: "yigit", eta: "3-4 gün", status: "planned" },
  { emoji: "🎬", title: "AI video üretimi", desc: "Her ilan için otomatik tanıtım videosu: parsel fotoğrafları + harita uçuşu + AI seslendirme → TikTok/Instagram formatı. Pazarlama maliyetini ciddi düşürür.", owner: "yigit", eta: "1 hafta", status: "planned" },
  { emoji: "📧", title: "E-posta otomasyonu (Resend)", desc: "Hoş geldin, ödeme hatırlatma, makbuz, gecikme uyarısı serileri.", owner: "yigit", eta: "2 gün", status: "planned" },
  { emoji: "👤", title: "Alıcı müşteri portalı", desc: "Alıcılar ödeme geçmişini görür, sözleşme indirir, kalan borcu takip eder.", owner: "yigit", eta: "4-5 gün", status: "planned" },
  { emoji: "🚀", title: "Deploy + domain", desc: "Vercel production + domain bağlama (terralot.com vb. — Ahmet ile karar verilecek).", owner: "ikisi", eta: "1 gün", status: "planned" },
];

const OWNER_META = {
  yigit: { label: "Yiğit", bg: "#dbeafe", color: "#1d4ed8" },
  ahmet: { label: "Ahmet", bg: "#fce7f3", color: "#be185d" },
  ikisi: { label: "Ortak", bg: "#f3e8ff", color: "#7e22ce" },
};

const phases = [
  { name: "Faz 1 — Teknik Tamamlama", desc: "DB + auth + deploy. Platform canlıya çıkar, Ahmet panelden takip etmeye başlar.", time: "Hafta 1", items: ["Neon DB", "Clerk production", "Vercel deploy + domain"] },
  { name: "Faz 2 — Yasal & Ödeme", desc: "Ahmet LLC açar, Stripe bağlanır. İlk parsel alımına hazır hale gelinir.", time: "Hafta 2-3", items: ["Wyoming LLC", "Mercury hesabı", "Stripe entegrasyonu", "E-posta otomasyonu"] },
  { name: "Faz 3 — Büyüme Özellikleri", desc: "Referral + off-market + AI video. Pazarlama makinesi tamamlanır.", time: "Hafta 3-5", items: ["Referral programı", "Off-market genişletme", "AI video üretimi", "Müşteri portalı"] },
  { name: "Faz 4 — İlk Satışlar", desc: "3-5 test parseli alınır, ilanlar açılır, reklamlar başlar.", time: "Hafta 5+", items: ["İlk parsel alımları", "FB/IG + TikTok kampanyaları", "İlk taksitli satışlar"] },
];

/* ---------- helpers ---------- */

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span style={{ background: m.bg, color: m.color }} className="px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap">
      {m.label}
    </span>
  );
}

function ItemIcon({ status }: { status: Status }) {
  if (status === "done") return <CheckCircle2 className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: "#16a34a" }} />;
  if (status === "progress") return <Clock className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: "#ca8a04" }} />;
  if (status === "blocked") return <AlertCircle className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: "#dc2626" }} />;
  return <Circle className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: "#94a3b8" }} />;
}

/* ---------- page ---------- */

export default function StatusPage() {
  const allItems = modules.flatMap(m => m.items);
  const doneCount = allItems.filter(i => i.status === "done").length;
  const overallPct = Math.round((doneCount / (allItems.length + remaining.length)) * 100);

  return (
    <div style={{ background: "#ffffff", color: "#1e293b", minHeight: "100vh", fontFamily: "var(--font-inter), -apple-system, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-6xl mb-6">🏜️</div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-3" style={{ color: "#0f172a" }}>
          TerraLot — Proje Durum Raporu
        </h1>
        <p className="text-lg mb-2" style={{ color: "#64748b" }}>
          ABD arazi alım-satım platformu · Taksitli satış modeli · AI destekli operasyon
        </p>
        <div className="flex items-center gap-3 text-sm mb-10" style={{ color: "#94a3b8" }}>
          <span>Hazırlayan: <strong style={{ color: "#475569" }}>Yiğit Ertürk</strong></span>
          <span>·</span>
          <span>Yatırımcı: <strong style={{ color: "#475569" }}>Ahmet</strong></span>
          <span>·</span>
          <span>{new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
        </div>

        {/* Overall progress */}
        <div className="rounded-xl border p-6 mb-12" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold" style={{ color: "#0f172a" }}>Genel İlerleme</span>
            <span className="text-2xl font-extrabold" style={{ color: "#16a34a" }}>%{overallPct}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
            <div className="h-full rounded-full" style={{ width: `${overallPct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" }} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5">
            <div>
              <p className="text-2xl font-bold" style={{ color: "#16a34a" }}>{doneCount}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>Tamamlanan özellik</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#ca8a04" }}>{allItems.filter(i => i.status === "progress").length + remaining.filter(r => r.status === "progress").length}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>Devam eden</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#4338ca" }}>{remaining.filter(r => r.status === "planned" || r.status === "blocked").length}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>Teslimat için kalan</p>
            </div>
          </div>
        </div>

        {/* Section: completed modules */}
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ color: "#0f172a" }}>✅ Bugüne Kadar Yapılanlar</h2>
        <p className="text-sm mb-8" style={{ color: "#64748b" }}>
          İki ayrı uygulama geliştirildi: <strong>TerraLot Platform</strong> (satış sitesi + admin + yatırımcı paneli) ve <strong>TerraLot OS</strong> (AI arsa analiz aracı).
        </p>

        <div className="space-y-8 mb-16">
          {modules.map(mod => (
            <div key={mod.title} className="rounded-xl border overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <h3 className="font-bold flex items-center gap-2" style={{ color: "#0f172a" }}>
                  <span className="text-xl">{mod.emoji}</span> {mod.title}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
                    <div className="h-full rounded-full" style={{ width: `${mod.pct}%`, background: mod.pct === 100 ? "#16a34a" : "#3b82f6" }} />
                  </div>
                  <span className="text-sm font-bold w-10 text-right" style={{ color: mod.pct === 100 ? "#16a34a" : "#3b82f6" }}>%{mod.pct}</span>
                </div>
              </div>
              <div className="px-5 py-2 divide-y" style={{ borderColor: "#f1f5f9" }}>
                {mod.items.map(item => (
                  <div key={item.name} className="flex items-start gap-3 py-3">
                    <ItemIcon status={item.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#1e293b", textDecoration: item.status === "done" ? "none" : "none" }}>{item.name}</p>
                      {item.desc && <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{item.desc}</p>}
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Section: remaining for delivery */}
        <h2 className="text-2xl font-bold mb-2" style={{ color: "#0f172a" }}>🎯 Tam Teslim İçin Kalanlar</h2>
        <p className="text-sm mb-8" style={{ color: "#64748b" }}>
          Aşağıdaki kalemler tamamlandığında platform <strong>gelir üretmeye hazır</strong> şekilde teslim edilir.
          Kırmızı işaretli kalemler Ahmet tarafında karar/aksiyon bekliyor.
        </p>

        <div className="space-y-3 mb-16">
          {remaining.map(item => {
            const owner = OWNER_META[item.owner];
            return (
              <div key={item.title} className="rounded-xl border p-4 flex items-start gap-4" style={{ borderColor: item.status === "blocked" ? "#fecaca" : "#e2e8f0", background: item.status === "blocked" ? "#fef2f2" : "#fff" }}>
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-sm" style={{ color: "#0f172a" }}>{item.title}</h3>
                    <StatusPill status={item.status} />
                    <span style={{ background: owner.bg, color: owner.color }} className="px-2 py-0.5 rounded text-[11px] font-semibold">
                      {owner.label}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{item.desc}</p>
                </div>
                <span className="text-xs font-semibold whitespace-nowrap px-2 py-1 rounded" style={{ background: "#f1f5f9", color: "#475569" }}>⏱ {item.eta}</span>
              </div>
            );
          })}
        </div>

        {/* Section: timeline */}
        <h2 className="text-2xl font-bold mb-8" style={{ color: "#0f172a" }}>🗓️ Teslim Yol Haritası</h2>
        <div className="relative mb-16">
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5" style={{ background: "#e2e8f0" }} />
          <div className="space-y-6">
            {phases.map((phase, i) => (
              <div key={phase.name} className="relative pl-12">
                <div className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2" style={{ background: "#fff", borderColor: i === 0 ? "#16a34a" : "#cbd5e1", color: i === 0 ? "#16a34a" : "#64748b" }}>
                  {i + 1}
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "#e2e8f0" }}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-sm" style={{ color: "#0f172a" }}>{phase.name}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "#eff6ff", color: "#1d4ed8" }}>{phase.time}</span>
                  </div>
                  <p className="text-xs mb-3" style={{ color: "#64748b" }}>{phase.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {phase.items.map(it => (
                      <span key={it} className="text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: "#e2e8f0", color: "#475569" }}>{it}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: tech stack */}
        <h2 className="text-2xl font-bold mb-6" style={{ color: "#0f172a" }}>⚙️ Teknoloji Altyapısı</h2>
        <div className="rounded-xl border overflow-hidden mb-16" style={{ borderColor: "#e2e8f0" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Bileşen", "Teknoloji", "Durum"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Web platformu", "Next.js 16 + TailwindCSS", "done"],
                ["Admin + Yatırımcı paneli", "Next.js + Prisma ORM", "done"],
                ["AI analiz aracı (TerraLot OS)", "React + Vite + Leaflet GIS", "done"],
                ["Veritabanı", "PostgreSQL (Neon)", "progress"],
                ["Kimlik doğrulama", "Clerk (rol bazlı erişim)", "progress"],
                ["Ödeme", "Stripe (abonelik + taksit)", "blocked"],
                ["E-posta", "Resend", "planned"],
                ["AI video", "Remotion + AI seslendirme", "planned"],
                ["Hosting", "Vercel", "planned"],
              ].map(([comp, tech, status]) => (
                <tr key={comp as string} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "#1e293b" }}>{comp}</td>
                  <td className="px-4 py-3" style={{ color: "#64748b" }}>{tech}</td>
                  <td className="px-4 py-3"><StatusPill status={status as Status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section: what Ahmet sees */}
        <h2 className="text-2xl font-bold mb-6" style={{ color: "#0f172a" }}>👀 Ahmet'in Takip Edeceği Panel</h2>
        <div className="rounded-xl border p-6 mb-16" style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "#1e40af" }}>
            Yatırımcı portalı hazır: kendi giriş bilgilerinle <strong>salt-okunur</strong> erişim alacaksın.
            Portföydeki her parseli, her ödemeyi, gelir paylaşımını (%60 yatırımcı / %40 operasyon) ve
            yeni fırsat pipeline&apos;ını gerçek zamanlı göreceksin. Hiçbir şeyi sormana gerek kalmadan
            paranın nerede olduğunu her an bileceksin.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {["Genel Bakış", "Portföy", "Finansal Rapor", "Ödemeler", "Deal Pipeline", "Referral Ağı", "Dokümanlar"].map(p => (
              <span key={p} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: "#fff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                <ArrowUpRight className="w-3 h-3" /> {p}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 text-center" style={{ borderTop: "1px solid #e2e8f0" }}>
          <p className="text-sm font-bold mb-1" style={{ color: "#0f172a" }}>TerraLot</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>Democratizing US Land Ownership · Bu rapor canlı veriden otomatik güncellenir</p>
        </div>

      </div>
    </div>
  );
}
