import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Rakip Defteri" (/admin/rakip-defteri) → /admin/rakip-radar?sekme=defter
//
// 2026-07-29 rakip ekranı birleştirmesi. Gövde SİLİNMEDİ → kendi 2 alt sekmesiyle
// (Rakibin Defteri / Diğer Oyuncular) `../rakip-radar/sekme-defter.tsx` içine taşındı.
// Veri kaynağı aynı: src/data/rakip-defteri.json + src/lib/rakip-defteri.ts.
// ─────────────────────────────────────────────────────────────────────────────
export default function RakipDefteriYonlendirme() {
  redirect("/admin/rakip-radar?sekme=defter");
}
