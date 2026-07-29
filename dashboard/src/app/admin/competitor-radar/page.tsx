import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Rakip Satış Radarı" (/admin/competitor-radar) → /admin/rakip-radar?sekme=manzara
//
// 2026-07-29 rakip ekranı birleştirmesi: 5 ayrı rakip sayfası tek sekmeli ekranda
// toplandı. Bu ekranın gövdesi SİLİNMEDİ → `../rakip-radar/sekme-manzara.tsx`
// (PropStream deed CSV içe aktarma kutusu + /api/admin/competitor-radar/import-sales
// çağrısı dahil, birebir).
// API yolu (/api/admin/competitor-radar ve .../import-sales) DEĞİŞMEDİ.
// ─────────────────────────────────────────────────────────────────────────────
export default function CompetitorRadarYonlendirme() {
  redirect("/admin/rakip-radar?sekme=manzara");
}
