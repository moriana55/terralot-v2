import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Rakip Analizi & Kaynak Arbitrajı" (/admin/competitor-analysis)
//   → /admin/rakip-radar?sekme=ekonomi
//
// 2026-07-29 rakip ekranı birleştirmesi. Gövde SİLİNMEDİ → taksit ekonomisi
// kartları, arbitraj hesaplayıcı ve eyalet $/acre şeridiyle birlikte
// `../rakip-radar/sekme-ekonomi.tsx` içine taşındı.
// Veri uçları DEĞİŞMEDİ: /api/market-rates, /api/competitor-listings,
// /api/competitor-scraper.
// ─────────────────────────────────────────────────────────────────────────────
export default function CompetitorAnalysisYonlendirme() {
  redirect("/admin/rakip-radar?sekme=ekonomi");
}
