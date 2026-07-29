import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Rakip İstihbaratı" (/admin/rakip-istihbarat) → /admin/rakip-radar?sekme=bolgeler
//
// 2026-07-29 rakip ekranı birleştirmesi. Bu ekran /admin/pazar-ortusme ile aynı
// soruyu iki farklı çözünürlükte cevaplıyordu (county vs yerleşim); ikisi tek
// bölge tablosunda birleşti → `../rakip-radar/sekme-bolgeler.tsx`.
// Veri uçları DEĞİŞMEDİ: /api/admin/rakip-istihbarat + /api/admin/market-overlap.
// ─────────────────────────────────────────────────────────────────────────────
export default function RakipIstihbaratYonlendirme() {
  redirect("/admin/rakip-radar?sekme=bolgeler");
}
