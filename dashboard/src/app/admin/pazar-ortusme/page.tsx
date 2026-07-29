import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "Pazar Örtüşme" (/admin/pazar-ortusme) → /admin/rakip-radar?sekme=bolgeler
//
// 2026-07-29 rakip ekranı birleştirmesi. Yerleşim bazlı örtüşme kartları
// (rakip ilanı · bizim envanter · $/acre spread · kanıt linkleri · "KANITLI PAZAR"
// rozeti) county bazlı rakip yoğunluğu tablosunun altına girintili satırlar olarak
// taşındı → `../rakip-radar/sekme-bolgeler.tsx`.
// Veri ucu DEĞİŞMEDİ: /api/admin/market-overlap.
// ─────────────────────────────────────────────────────────────────────────────
export default function PazarOrtusmeYonlendirme() {
  redirect("/admin/rakip-radar?sekme=bolgeler");
}
