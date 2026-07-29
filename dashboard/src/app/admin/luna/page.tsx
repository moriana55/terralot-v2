// ─────────────────────────────────────────────────────────────────────────────
// EMEKLİ EKRAN → TEK OFF-MARKET ENVANTERİ (ADIM 1)
//
// Bu sayfa `src/data/import-propstream-nm-luna.json` statik anlık görüntüsünü
// (157 satır) okuyordu. 157 satırın TAMAMI `offmarket_leads` tablosunda mevcut
// (scripts/kayip-veri-avi.mjs ile kanıtlandı) → veri kaybı YOK. Üstelik yeni
// ekranda Luna için de 0-100 skor hesaplanıyor (eski ekranda skor hiç yoktu).
//
// Rota SİLİNMEDİ; eski ekranın kodu `_arsiv-ekran.tsx` dosyasında duruyor.
// ─────────────────────────────────────────────────────────────────────────────
import { redirect } from "next/navigation";

export default function LunaYonlendir() {
  redirect("/admin/off-market-envanter?state=NM&county=Luna");
}
