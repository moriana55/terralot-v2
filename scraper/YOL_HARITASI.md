# 🚀 Yapay Zeka Destekli Gayrimenkul Toptancılığı (Wholesaling) Platformu - Yol Haritası

Bu doküman, **Zillow Arsa & Konut Tracker** projemizin mevcut durumunu ve projenin değerini katlayacak gelecek aşamalarını (vizyon yol haritasını) sunumda paylaşabileceğin şekilde özetler.

---

## 🟢 Aşama 1: Mevcut Altyapı (Tamamlandı - Canavar Modu)
*   **Dual-Module Platform:** Tek arayüzde hem **Arsa (Land Flipping)** hem de **Konut (House Wholesaling)** modülleri.
*   **Otomatik Tarama & Fiyat Düşüşü Takibi:** Belirlenen hedef bölgelerde (veya AI otopilotun seçtiği ilçelerde) fiyat düşüşlerini yakalama ve Telegram'a bildirme.
*   **Canlı Grafik Paneli (Chart.js):** Eyalet bazlı veri yoğunluğu ve birim fiyat (dönüm ve metrekare) analiz grafikleri.
*   **Sözleşme Üretici & Dijital İmza (E-Signature):** Amerika standartlarında yasal sözleşmeyi tarayıcı üzerinden imzalayarak yazdırma/PDF yapma.
*   **Direct Mail Mockup:** Sahibine gönderilecek nakit teklif mektubunu ve zarfını otomatik hazırlama ve yazdırma.

---

## 🟡 Aşama 2: Akıllı Analiz ve Veri Derinliği (Gelecek Adım)
*   **AI Comps Analizi & MAO (Maksimum Teklif Bedeli) Hesaplayıcı:**
    *   Yapay zeka, bölgedeki geçmiş benzer satışları (comps) analiz eder.
    *   `MAO = (Emsal Satış Değeri * 0.70) - Tamirat/Geliştirme Masrafı` formülünü işleterek zarar etmeyeceğimiz en yüksek teklif sınırını otomatik hesaplar.
*   **Skip Tracing API Entegrasyonu:**
    *   Belediye tapu kayıtlarına API ile bağlanarak parsel (APN) sahibinin adı, telefon numarası ve e-posta adresini tek tıkla çekme.
*   **Toplu Posta Gönderim Entegrasyonu:**
    *   Oluşturulan teklif mektuplarını Pebble veya REIPrintMail API'siyle otomatik olarak fiziki posta zarfına koyup sahibine kargolatma.

---

## 🔵 Aşama 3: Otomatik Pazarlama & Off-Market Arama (Orta Vade)
*   **Alıcı Eşleştirme Portalı (Buyer List CRM):**
    *   Nakit alıcı listesi (Cash Buyer List) oluşturma.
    *   Sözleşmesini bağladığımız kelepir gayrimenkulleri, alıcıların kriterleriyle (bölge, bütçe, boyut) eşleştirerek otomatik SMS/E-posta ile pazarlama.
*   **County Recorder Scraper (Off-Market Avcılığı):**
    *   Zillow'a düşmeyen; vergi borcu olan (Tax Delinquents) veya miras kalan (Probates) gayrimenkulleri yerel belediye/mahkeme sistemlerinden kazıyıp rekabet sıfırken yakalama.

---

## 🟣 Aşama 4: Otonom İletişim (Gelecek Vizyonu)
*   **AI Sesli Arama Acentesi (AI Voice Agent):**
    *   Bland.ai veya Vapi.ai entegrasyonuyla, skip tracing ile bulunan mal sahiplerini otomatik arayarak nakit teklif ilgisini otonom sorgulama ve sadece olumlu dönüş yapanları sisteme aktarma.
