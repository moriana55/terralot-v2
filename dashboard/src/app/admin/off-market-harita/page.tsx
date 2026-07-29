import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Off-Market Haritası" (/admin/off-market-harita) → /admin/harita?mod=offmarket&gorunum=panel
//
// GEREKÇE (bilgi mimarisi toparlama — dört harita tek ekrana indi):
//   Aynı API, aynı veri, `/admin/harita` ile ikiz sayfaydı; tek farkı panel içi
//   analitik görünüm olmasıydı. Artık o görünüm tek harita ekranının
//   `mod=offmarket & gorunum=panel` kombinasyonu.
//
// HİÇBİR ÖZELLİK KAYBOLMADI: çoklu eyalet seçimi (`activeStates`, `st=` sorgusu),
// `onMeta` ile "haritada çizilen nokta" canlı sayacı, 4'lü istatistik şeridi,
// LayersControl, GradeBadge'li popup, rakip ilan katmanı, fail-soft eyalet
// pinleri — hepsi `harita/mod-offmarket-panel.tsx` içine taşındı.
// Ağır harita bileşeni `./off-market-map.tsx` YERİNDE DURUYOR ve oradan
// import edilir. Route silinmedi → eski link/yer imi çalışmaya devam eder.
// ─────────────────────────────────────────────────────────────────────────────
export default function OffMarketHaritaYonlendirme() {
  redirect("/admin/harita?mod=offmarket&gorunum=panel");
}
