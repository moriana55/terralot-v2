import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// "APN Sorgula" (/admin/apn-sorgula) → /admin/apn-dogrula
//
// GEREKÇE (2026-07-29 bilgi mimarisi toparlama):
//   apn-dogrula bu ekranın süperkümesi — aynı Mohave ArcGIS sorgusunu aynı
//   parcel-map ile gösteriyor, üstüne "bizim kayıtlarımız vs county" uyum
//   kontrolü ve TRS bölge özeti ekliyor. Burada olup orada olmayan 3 parça
//   (etiketli alan projeksiyonu, ham GIS alan tablosu, Google uydu linki)
//   apn-dogrula'nın sağ sütununa taşındı.
//
// Eski ekranın kodu SİLİNMEDİ → `./_arsiv-ekran.tsx`.
// `./parcel-map.tsx` CANLI kalır (apn-dogrula onu import ediyor).
// Mevcut linkler/yer imleri bozulmasın diye query paramlar aynen aktarılır
// (özellikle ?apn=... — apn-dogrula onu okuyup otomatik sorguluyor).
// (Aynı desen: /admin/tax-leads, /admin/off-market)
// ─────────────────────────────────────────────────────────────────────────────
export default async function ApnSorgulaYonlendirme({
  searchParams,
}: {
  // Next.js 16: searchParams bir Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries(sp)) {
    if (deger == null) continue;
    if (Array.isArray(deger)) deger.forEach((d) => qs.append(anahtar, d));
    else qs.append(anahtar, deger);
  }
  const sorgu = qs.toString();
  redirect(sorgu ? `/admin/apn-dogrula?${sorgu}` : "/admin/apn-dogrula");
}
