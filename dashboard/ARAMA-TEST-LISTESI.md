# SICAK ARAMA — Yapılacaklar & Test Listesi
_2026-07-21 · Mektup → telefon pivotu. Sırayla git, her adımda ✅ işaretle._

## A. Kurulum (bir kez, Yiğit)
- [ ] **SQL'i çalıştır:** Supabase → SQL Editor → `dashboard/sql/call_center.sql` içeriğini yapıştır → Run.
      Beklenen: "Success" — offmarket_leads'e phone/do_not_call kolonları + call_logs + pipeline_deals tabloları.
- [ ] **Doğrula:** `/admin/arama` sayfasını aç → üstteki turuncu "şema kurulu değil" uyarısı KAYBOLMALI.
- [ ] **Skip-trace hesabı aç:** BatchSkipTracing.com (kayıt başı ~$0.10-0.20) veya PropStream.
      İlk parti öneri: Mohave "En İyi 750" listesi (marjı en yüksek 750 lead) → CSV dışa aktar → skip-trace'e yükle.
- [ ] **Numaraları içe aktar:** dönen CSV'yi `lead_id_veya_APN,telefon` formatına getir → /admin/arama → "Numara importu" → yapıştır → İçe aktar.
      Beklenen: "✅ N numara eşleşti" + üstteki "X lead'de numara var" sayısı artmalı.

## B. Arama Kokpiti testi (/admin/arama)
- [ ] Kuyruk marj sırasına göre doluyor mu? (en yüksek marj en üstte)
- [ ] Eyalet filtresi (AZ/NM/CO/TX/FL) ve "Sadece numarası olanlar" çalışıyor mu?
- [ ] Üstteki eyalet saatleri makul mü? (AZ İzmir'den -10 saat; "aranabilir" rozeti 09-19 yerel)
- [ ] Bir lead seç → yeşil numara butonuna bas → telefon/FaceTime araması tetikleniyor mu?
- [ ] Skriptte sahibin adı, county, dönüm, teklif rakamı otomatik dolu mu? Kopyala butonu çalışıyor mu?
- [ ] **Test araması kaydı:** "Ulaşılamadı"ya bas → kuyrukta o lead'in altında "Ulaşılamadı" rozeti çıkmalı, sıradaki lead'e otomatik geçmeli.
- [ ] **Not testi:** nota "TEST — silinecek" yaz → "Mesaj bırakıldı"ya bas → Supabase call_logs'ta satır var mı bak.
- [ ] **Geri arama testi:** tarih seç (yarın) → "Geri aranacak" → sağ alttaki "Yaklaşan geri aramalar" panelinde görünmeli.
- [ ] **DNC testi:** kobay bir lead'de "Aranmasın (DNC)" → lead kuyruktan kalıcı düşmeli (sayfa yenilenince de gelmemeli).

## C. Anlaşma Hattı testi (/admin/anlasma-hatti)
- [ ] Kokpitte bir lead'i "İlgileniyor 🔥" işaretle → Anlaşma Hattı'nın 1. kolonuna otomatik düşmeli.
- [ ] "ilerlet ▶" ile Teklif → Pazarlık → Sözleşme → Tapu sürülebiliyor mu? "◀ geri" çalışıyor mu?
- [ ] Kartta $ butonuna bas → teklif tutarı gir → kartta görünmeli.
- [ ] Çöp kutusuyla hattan çıkarma çalışıyor mu?
- [ ] Üstteki "N anlaşma · potansiyel marj $X" sayacı doğru mu?

## D. Gerçek kullanım (ekip)
- [ ] Arama ekibi ABD saat pencerelerine uysun (rozet yeşilken ara).
- [ ] Her aramada sonuç MUTLAKA işaretlensin — raporlar buradan beslenecek.
- [ ] "Aranmasın" diyen sahibe DNC bas — yasal gereklilik (TCPA), şaka değil.
- [ ] İlgilenen çıkınca not alanına fiyat beklentisini yaz (pazarlık geçmişi olacak).

## Bilinen sınırlar / sıradaki işler
- Numarasız lead'ler kuyrukta "numara bekliyor" görünür — skip-trace importuna kadar aranamaz.
- Koordinat backfill sürüyor (harita için) — NM/CO/TX/FL noktaları dolduğunda 5 Eyalet Haritası AZ kalitesine gelecek.
- 10 eyalet genişleme + eyalet yasa kartları: planlandı, sıradaki tur.
