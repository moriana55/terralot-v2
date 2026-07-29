import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Sistem & Yöntem" (/admin/sistem) → /admin/yontem
//
// GEREKÇE (2026-07-29 bilgi mimarisi toparlama):
//   İki ekran aynı soruyu ("neye göre alıyoruz?") iki ayrı dille anlatıyordu ve
//   teklif matematiğinde ÇELİŞİYORDU: burada "piyasa değeri × %15–25", yontem'de
//   güncel formül "(piyasa değeri ÷ hedef çarpan) − $2.000". Tek doğru anlatım
//   yontem olduğu için host o seçildi; buradaki veri/kural tabloları (veri
//   kaynakları, comp kapsaması, scrub kriterleri, eyalet stratejisi, rakip
//   kıyaslaması) yontem'e taşındı.
//
// Eski ekranın kodu SİLİNMEDİ → `./_arsiv-ekran.tsx`.
// (Aynı desen: /admin/tax-leads, /admin/off-market, /admin/apn-sorgula)
// ─────────────────────────────────────────────────────────────────────────────
export default function SistemYonlendirme() {
  redirect("/admin/yontem");
}
