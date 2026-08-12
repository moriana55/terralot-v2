import { redirect } from "next/navigation";

// ESKİ MOHAVE SUNUMU — EMEKLİYE AYRILDI (2026-08-12)
//
// Bu sayfa Haziran'daki tek county'lik dönemi anlatıyordu: "Mohave Off-Market
// Operasyonu · 63.192 parselden 449 mektuba · pilot $622". Bugünkü operasyon
// 43 eyalet / 1.272.766 parsel ve kanal artık mektup değil ARAMA. Yani sayfa
// yanlış değil, ESKİ — ve adı "/admin/sunum" olduğu için müşteri sunumunda
// yanlışlıkla açılma riski taşıyordu.
//
// Proje kuralı gereği route SİLİNMEZ (eski link/yer imi kırılmasın), halefine
// yönlendirilir. Eski sayfanın kodu `_eski-mohave-sunumu.tsx.bak` olarak
// yanında duruyor; geri gerekirse oradan alınır.
export default function SunumRedirect() {
  redirect("/admin/sunum-ulusal");
}
