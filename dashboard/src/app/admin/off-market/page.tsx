import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Off-Market Deals" (/admin/off-market) → /admin/arsa-notlari
//
// GEREKÇE (2026-07-29 bilgi mimarisi toparlama):
//   • Kaynağı `lib/data.ts` içindeki `offMarketProperties` ve o dizi BİLEREK boş
//     (`= []`) — mock veriyi vitrine dökmemek için. Sayfa boş tablo + "örnek veri"
//     banner'ı gösteriyor, `avgDiscount` ise 0/0 → `NaN%` basıyordu.
//   • Add / Eye / Edit / Trash butonlarının hiçbirinde `onClick` yoktu.
//   • Adı /admin/off-market-leads ve /admin/off-market-harita ile karışıyordu.
//   Kısaca: kaybolacak ÇALIŞAN bir işlev yok.
//
// Gerçek off-market vitrini artık /admin/arsa-notlari (A+..F not motoru).
// Eski ekranın kodu SİLİNMEDİ → `./_arsiv-ekran.tsx`.
// (Aynı desen: /admin/tax-leads → /admin/off-market-leads?tab=dd)
// ─────────────────────────────────────────────────────────────────────────────
export default function OffMarketYonlendirme() {
  redirect("/admin/arsa-notlari");
}
