import { redirect } from "next/navigation";

// "Tax Leads" sayfası "Vergi-Borçlu Lead'ler" (/admin/off-market-leads) sayfasıyla
// birleştirildi — aynı `tax_delinquent_properties` verisini gösteriyordu.
// Ham tablo + DD kontrolü artık orada "DD Tablosu" sekmesinde.
// (2026-07-13 sidebar sadeleştirme)
export default function TaxLeadsRedirect() {
  redirect("/admin/off-market-leads?tab=dd");
}
