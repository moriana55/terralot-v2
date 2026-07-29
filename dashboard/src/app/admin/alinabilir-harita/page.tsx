import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Alınabilir Parseller · Harita" (/admin/alinabilir-harita) → /admin/harita?mod=alinabilir
//
// GEREKÇE (bilgi mimarisi toparlama — dört harita tek ekrana indi):
//   Sahibin dört ayrı harita sayfası arasında gezinmesi gerekiyordu. Hepsi tek
//   `/admin/harita` ekranında mod seçici altında toplandı.
//
// HİÇBİR ÖZELLİK KAYBOLMADI: 2D/3D anahtarı, grade çipleri, filtre paneli,
// lejant, Regrid tapu sınırları, OSM yollar, FEMA, County GIS, pazarlama görseli
// üreteci, kampanya sepeti, Mohave 💌/⭐ katmanları, 🏁 rakip satışları,
// 🐋 büyük oyuncular, 3D arazi / sunum turu / spread kuleleri —
// tümü `harita/mod-alinabilir.tsx` + değişmemiş ağır bileşenlerde.
// `./deals-map.tsx`, `./deals-map-3d.tsx`, `./CountyGisLayer.tsx` YERİNDE
// DURUYOR ve oradan import edilir. Route silinmedi → eski link/yer imi çalışır.
// ─────────────────────────────────────────────────────────────────────────────
export default function AlinabilirHaritaYonlendirme() {
  redirect("/admin/harita?mod=alinabilir");
}
