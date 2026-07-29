import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Deal Haritası" (/admin/deal-map) → /admin/harita?mod=anlasma
//
// GEREKÇE (bilgi mimarisi toparlama — dört harita tek ekrana indi):
//   Sahibin dört ayrı harita sayfası arasında gezinmesi gerekiyordu. Hepsi tek
//   `/admin/harita` ekranında mod seçici altında toplandı.
//
// HİÇBİR ÖZELLİK KAYBOLMADI: vergi-borçlu deal parselleri
// (tax_delinquent_properties), 📅 yaklaşan ihale halkaları (upcoming-sales) ve
// 🏭 megaproje katalizörleri (growth-catalysts) — üçü de
// `harita/mod-anlasma.tsx` içinde aynen duruyor.
// Ağır harita bileşeni `./cerberus-map.tsx` YERİNDE DURUYOR ve oradan import
// edilir. Route silinmedi → eski link/yer imi çalışmaya devam eder.
// ─────────────────────────────────────────────────────────────────────────────
export default function DealMapYonlendirme() {
  redirect("/admin/harita?mod=anlasma");
}
