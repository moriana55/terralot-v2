// ─────────────────────────────────────────────────────────────────────────────
// EMEKLİ EKRAN → TEK OFF-MARKET ENVANTERİ (ADIM 1)
//
// Bu sayfa `src/data/mohave-offmarket.json` statik anlık görüntüsünü (20.000 satır)
// okuyordu. O 20.000 satırın TAMAMI `offmarket_leads` tablosunda mevcut
// (scripts/kayip-veri-avi.mjs ile kanıtlandı) → veri kaybı YOK.
//
// Rota SİLİNMEDİ: eski link/yer imleri çalışmaya devam eder, county filtresi
// önceden seçili olarak yeni ekrana gider. Eski ekranın kodu `_arsiv-ekran.tsx`
// dosyasında duruyor (derlemeye girmez).
//
// Skor da kaybolmadı: Mohave'ye özel `offmarket_score` motoru county'den bağımsız
// hale getirildi (lib/offmarket-score.ts) ve Mohave'nin bölge-talep katsayıları
// `COUNTY_BOLGE_TALEBI["AZ|MOHAVE"]` tablosunda korunuyor.
// ─────────────────────────────────────────────────────────────────────────────
import { redirect } from "next/navigation";

export default function MohaveYonlendir() {
  redirect("/admin/off-market-envanter?state=AZ&county=Mohave");
}
