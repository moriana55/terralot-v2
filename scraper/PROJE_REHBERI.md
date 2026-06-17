# 🗺️ Zillow Land Tracker - Proje ve Kullanım Rehberi

Bu rehber, **Zillow Arsa Takip ve Yatırım Platformu** kapsamında yaptığımız tüm geliştirmeleri, sistemin çalışma mantığını ve nasıl kullanacağını unutmaman için özetler.

---

## 🚀 Sistemi Nasıl Çalıştırırsın?

Proje klasörü: `/Users/yigiterturk/.gemini/antigravity/scratch/zillow-scraper`

### 1. Sunucuyu Başlatmak
Arayüzü ve API'leri ayağa kaldırmak için terminalde şu komutu çalıştır:
```bash
npm start
```
* Sunucu **Port 3005** üzerinde çalışmaya başlar.
* Web Dashboard adresi: 👉 **[http://localhost:3005](http://localhost:3005)**

### 2. Tarayıcıyı (Scraper) Çalıştırmak
İlanları çekmek ve veritabanını güncellemek için iki seçeneğin var:
* **Web Arayüzünden:** Dashboard'un sağ üstündeki **"Tarayıcıyı Çalıştır"** butonuna basarak arka planda başlatabilirsin.
* **Terminalden:** Doğrudan şu komutla çalıştırıp logları anlık görebilirsin:
  ```bash
  node scraper.js
  ```

---

## 🛠️ Yaptığımız 6 Büyük Geliştirme (Tüm Özellikler)

### 1. 🤖 AI Otopilot & Canlı Analiz Konsolu
* **Nasıl Çalışır?** Dashboard'dan "AI Hedef Önerici"ye girip **"Otopilotu Başlat"** dediğinde devreye girer.
* **AI Ne Yapar?** Florida, Texas, Georgia, Tennessee ve North Carolina'daki en aktif **30+ ilçeyi** (nüfus artışı, likidite puanı ve arazi fiyatları) analiz eder. En karlı ve hedefinde olmayan **5 yeni ilçeyi** otomatik olarak seçer, `targets.txt` dosyana yazar ve taramayı başlatır.
* Canlı terminal simülasyonuyla AI'ın hangi verileri analiz ettiğini arayüzden anlık görebilirsin.

### 2. 🔥 Kelepir (Hot Deal) İlan Dedektörü
* **Nasıl Çalışır?** Sistem, her şehir/eyalet için dönüm başına ortalama fiyatı (`price / acres`) hesaplar.
* **Fırsat Yakalama:** Ortalama fiyatın **%30 veya daha altında** olan ilanları parlayan alevli kartlar halinde en üste taşır.
* **Kontrol Sende:** Arayüzdeki filtreyle cheapness (ucuzluk) oranını %30, %40, %50, %60 veya %70 olarak ayarlayabilirsin.

### 3. 🛰️ Google Maps Uydu (Satellite) Entegrasyonu
* Her ilan kartına **"🛰️ Uydudan Bak"** butonu eklendi.
* Tıkladığında doğrudan Google Maps'in Uydu katmanını arsanın koordinatlarında açar. Yol durumunu, ağaçlık durumu veya eğimi 1 saniyede inceleyebilirsin.

### 4. 📝 Tek Tıkla Sözleşme Üretici (Wholesaling)
* İlan kartlarındaki **"Sözleşme Yap"** butonuyla açılır.
* Alıcı adı (varsayılan: *Yigit Erturk LLC*), teklif fiyatı, kapora (EMD) ve kapanış süresini girip **"Yazdır / PDF Yap"** dediğinde, Amerika standartlarında yasal geçerliliği olan **"Land Purchase and Sale Agreement"** belgesini saniyeler içinde hazır eder.

### 5. ✉️ Direct Mail (Mektup Kampanyası) Listesi
* Sağ üstteki **"Direct Mail Listesi (CSV)"** butonuyla indirilir.
* Mektup gönderim şirketlerinin (Pebble, REIPrintMail vb.) kabul ettiği formatta; sadece **APN (parsel numarası) ve adresi tam olan** ilanları süzerek temiz bir kampanya CSV'si üretir.

### 6. 📱 Telegram Anlık Alarm Sistemi
* Veritabanına yeni bir kelepir ilan düştüğünde veya takipteki bir ilanda büyük bir fiyat düşüşü olduğunda, bot otomatik olarak Telegram grubuna/kanalına Google Maps Uydu linkiyle beraber bildirim gönderir.
* `.env` dosyasındaki `TELEGRAM_BOT_TOKEN` ve `TELEGRAM_CHAT_ID` alanlarından yönetilir.

---

## 📁 Proje Klasör Yapısı (Ne Nerede?)

* 📄 `server.js` ➜ Express backend sunucusu. AI veri bankası, otopilot algoritmaları ve tüm API endpointleri buradadır.
* 📄 `scraper.js` ➜ Zillow API'sini tarayan ana bot. Kredi koruma limiti (`MAX_DETAIL_REQUESTS`) ile çalışır.
* 📄 `db.js` ➜ SQLite veritabanı bağlantısı. Kelepir hesabı, fiyat geçmişi takibi ve veri kayıt mantığı buradadır.
* 📄 `targets.txt` ➜ Botun tarayacağı ilçelerin listesi. AI otopilot buraya otomatik ekleme yapar, sen de manuel satır ekleyip silebilirsin.
* 📂 `public/`
  * 📄 `index.html` ➜ Premium light-mode glassmorphic web arayüzümüz.
* 📄 `zillow_listings.db` ➜ Tüm ilanların, fiyat düşüş geçmişlerinin kaydedildiği SQLite veritabanı.
