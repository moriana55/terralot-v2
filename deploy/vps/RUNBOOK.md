# VegaLand — VPS'e Taşıma Runbook

**Ne için:** hasat ve geo doğrulama işleri şu an Mac'te koşuyor; makine kapanınca duruyor.
Bu paket ikisini Hostinger VPS'e (`2.24.161.97`, Litvanya) taşır: **7/24 döner** ve —
ayna testi olumlu çıkarsa — **geo hızı katlanır**.

**Toplam süre:** ~15 dakika (ayna testi 2 dk + gönderim 2 dk + kurulum 5-10 dk).

> Bu paketi hazırlayan ajanın **SSH erişimi yoktu**; sunucuya hiç bağlanılmadı.
> Aşağıdaki her komutu **sen** koşturacaksın.

---

## 0. KARAR NOKTASI — önce ayna testi (2 dakika)

Bunu **kurulumdan önce** yap. Cevaba göre taşımanın anlamı değişir.

Tek dosya, bağımlılığı yok (sadece `node` gerekir). Sunucuya kopyala ve koştur:

```bash
scp deploy/vps/overpass-test.sh scraper/geo-enrich-offmarket.mjs root@2.24.161.97:/tmp/
ssh root@2.24.161.97 'cd /tmp && GEO_KAYNAK=/tmp/geo-enrich-offmarket.mjs bash overpass-test.sh'
```

*(Node kurulu değilse önce: `ssh root@2.24.161.97 'curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt install -y nodejs'`)*

### Mac referansı (ölçüldü: 2026-07-30, `AYNA_TIMEOUT=25000`)

| Ayna | Mac'te durum | Gecikme |
|---|---|---|
| `maps.mail.ru/osm/tools/overpass` | **AÇIK** (6 eleman) | 7372 ms |
| `z.overpass-api.de` | KAPALI — `ECONNREFUSED` | 82 ms |
| `lz4.overpass-api.de` | KAPALI — `ECONNREFUSED` | 105 ms |
| `overpass-api.de` | KAPALI — `ECONNREFUSED` | 179 ms |
| `overpass.private.coffee` | KAPALI — `TimeoutError` | 25002 ms |
| `overpass.monicz.dev` | KAPALI — `TimeoutError` | 25003 ms |
| `overpass.kumi.systems` | KAPALI — `TimeoutError` | 25003 ms |

**Mac sonucu: 1/7 ayna → 3 işçi → ölçülen 19 lead/dk.** 8.750 kayıtlık kuyruk ≈ 7-8 saat.
(`scraper/logs/gizli-a-durum.txt`: `bitti: 1387 hücre / 1500 lead … 80.5 dk · 19 lead/dk`)

VPS sütununu **sen dolduracaksın**. Şimdi ne yapacağını sayı söyler:

| VPS'te açık ayna | Ne demek | Yapılacak |
|---|---|---|
| **4-7** | Geo hızı **katlanır** (işçi 3 → 12-21). Kuyruk saatlerden dakikalara iner. | Taşı, geo turunu VPS'te koştur, Mac'i kapat. |
| **2-3** | Kısmi kazanç (işçi 3 → 6-9), ~2-3x. | Taşımaya değer. |
| **1** | **Geo faydası YOK.** Kazanç sadece 7/24 çalışmak. | Taşı — ama beklentiyi düşür: hız aynı kalır, avantaj Mac'in kapanmaması. |
| **0** | VPS'ten geo turu **hiç koşmaz** (`geo-enrich` "hiçbir ayna canlı değil" diye çıkar). | Geo'yu Mac'te bırak, VPS'e sadece **hasat** turunu al. `systemctl disable --now vegaland-geo` |

> **Dürüst not:** Mac'teki 6 kapalı aynanın 3'ü `ECONNREFUSED` (Alman kümesi — muhtemelen
> IP/ASN bloğu ya da ISP seviyesinde engel), 3'ü `TimeoutError`. Bunlar **bu IP'ye özgü**
> olma ihtimali yüksek, bu yüzden farklı ülkedeki (LT) bir sunucudan açılmaları makul bir
> beklenti — ama **garanti değil**. Testi koşturmadan kuruluma geçme.

---

## 1. SIRLAR — neyi nereden alacaksın

Hiçbir sır bu pakette **yok** ve rsync ile **gitmez** (`gonder.sh` `.env*` dosyalarını dışlar).
VPS'e **elle** koyacaksın. Şablon: `deploy/vps/.env.ornek` (gerçek değer içermez).

### `dashboard/.env.local` — ZORUNLU

| Anahtar | Neden gerekli | Nereden |
|---|---|---|
| `DATABASE_URL` | **Kritik.** `scraper/grade-offmarket.mjs → dbUrl()` bu dosyayı okur. Yoksa geo ve notlandırma ilk saniyede patlar. | Mac: `dashboard/.env.local` · veya Supabase → Project Settings → Database → Connection string |
| `DIRECT_URL` | Pooler'ı atlayan doğrudan bağlantı | aynı yer (port 5432 URI) |
| `NEXT_PUBLIC_SUPABASE_URL` | `hasat-runner.mjs` satır sayımı | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | aynı | aynı |
| `SUPABASE_SERVICE_ROLE_KEY` | `migrate_to_supabase.js` yazımı | Supabase → API → `service_role` (**GİZLİ**) |

Clerk / ADMIN_PASSWORD / REGRID / ATTOM / LOB anahtarları **VPS'te gerekmez** — panel Vercel'de koşuyor.

### `scraper/.env` — opsiyonel ama önemli

| Anahtar | Durum | Not |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ⚠ **şu an BOŞ** | **Doldur.** 7/24 koşan bir turun hatasını yoksa kimse görmez — gece patlayan tur sabaha kadar sessiz kalır. Token: Telegram'da `@BotFather` → `/newbot`. |
| `TELEGRAM_CHAT_ID` | ⚠ **şu an BOŞ** | Bota bir mesaj at, sonra `https://api.telegram.org/bot<TOKEN>/getUpdates` → `chat.id`. |
| `CENSUS_API_KEY` | boşsa demografi tazelemesi atlanır | ücretsiz: `api.census.gov/data/key_signup.html` |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | gerekli | yukarıdakiyle aynı değer |
| `RAPIDAPI_KEY` | **BOŞ BIRAK** | Ücretli Zillow taraması. VPS turu `SKIP_ZILLOW=1` ile koşar; boş kalması kazadan korur. |

Bu iki dosya yoksa `kur.sh` şablondan **boş iskelet** yazar ve `DATABASE_URL` doluncaya kadar
**durur**. Yani yanlışlıkla yarım kurulum olmaz.

---

## 2. GÖNDERİM (Mac'te)

```bash
cd ~/Desktop/Aktif\ Projeler/terralot-v2

# Önce kuru koşu — ne gideceğini gör, hiçbir şey kopyalanmaz
./deploy/vps/gonder.sh root@2.24.161.97 /opt/vegaland --deneme

# Gerçek gönderim
./deploy/vps/gonder.sh root@2.24.161.97 /opt/vegaland
```

**Giden:** `scraper/` · `dashboard/src/lib/` (scraper'ın import ettiği `county-registry.ts`,
`eleme-hunisi.ts`, `county-providers/`) · `dashboard/scripts/` · `dashboard/package.json` ·
`deploy/vps/` · `NOT-MOTORU-KALIBRASYON.md`

**Gitmeyen ve nedeni:**

| Dışlanan | Boyut | Neden |
|---|---|---|
| `node_modules/` | — | VPS'te `npm ci` ile kurulur (arm64 → x86_64 mimari farkı) |
| `.next/` | — | panel Vercel'de, VPS'te build yok |
| `.git/` | — | uzak depo yok, sunucuda geçmişin işi yok |
| `dashboard/src/data/` | **190 MB** | ölü statik JSON, hiçbir hasat/geo betiği okumuyor |
| `yedek/` | **41 MB** | döküm |
| `.env`, `.env.local` | — | **SIRLAR** — elle konur (bkz. bölüm 1) |
| `logs/`, `downloads/`, `*.log`, `*.csv`, `*.sqlite` | ~400 MB | Mac'in çöpü, sunucu kendi loglarını üretir |
| `scraper/owners.txt` | **85 MB** | HCAD tapu dökümü — hiçbir hasat/geo betiği okumuyor (grep'le doğrulandı) |
| `lgbs_*.json`, `found_api_*.json` | ~6 MB | `lgbs-scraper.js` ara çıktıları, yeniden üretilebilir |
| `*.plist`, `launchd-kur.sh` | — | macOS'a özgü; VPS'te systemd var |

**Emniyet ağı:** `--max-size=2m`. Hasat/geo için gereken hiçbir dosya 2 MB'ı geçmiyor
(en büyüğü `county-registry.ts` ~60 KB). Bu tavan, klasöre sonradan düşen ham dökümlerin
sessizce ağa çıkmasını engeller. Gerekirse: `GONDER_MAX=50m ./deploy/vps/gonder.sh …`

`scraper/data/` (geo hücre önbelleği, ~5 MB) da varsayılan olarak gitmez. Geo turunun
ısınmış başlamasını istersen: `GONDER_ONBELLEK=1 GONDER_MAX=50m ./deploy/vps/gonder.sh …`

**Ölçülen gönderim boyutu: 331 dosya, ~3,0 MB** (kuru koşuyla doğrulandı — dışlamalar
olmadan 97 MB olurdu).

---

## 3. KURULUM (VPS'te)

```bash
ssh root@2.24.161.97

# 1) Sırları koy (DATABASE_URL olmadan kurulum ilerlemez)
nano /opt/vegaland/dashboard/.env.local
nano /opt/vegaland/scraper/.env

# 2) Tek komut
sudo bash /opt/vegaland/deploy/vps/kur.sh
```

`kur.sh` sırayla şunu yapar:

1. **Ubuntu/Debian doğrular** (varsaymaz — başka dağıtımda anlaşılır hata verir), systemd ve root kontrolü
2. **Node** — `>= 22` yoksa NodeSource'tan **24 LTS** kurar.
   Sonra sürüm numarasına güvenmeyip **canlı test eder**: `dashboard/src/lib/county-registry.ts`
   gerçekten `import` edilebiliyor mu? (`filtreli-hasat.mjs` `.ts` dosyalarını doğrudan import ediyor,
   Node'un tip-soyma yeteneği şart.) Edemiyorsa uyarır — geo çalışır, hasat çalışmaz.
3. **`.env`** — eksikse `.env.ornek`'ten boş iskelet yazar, `chmod 600`, `DATABASE_URL` boşsa **DURUR**
4. **`npm ci`** — `PUPPETEER_SKIP_DOWNLOAD=true` ile (400 MB Chromium indirmez; canlı vergi
   taramaları `SKIP_TAX=1` ile atlanıyor). `node_modules` günceldeyse hiç koşmaz.
5. **systemd birimleri** (`launchd` yerine):
   - `vegaland-hasat.timer` → her gün **03:30 UTC** (= 06:30 TR), `Persistent=true`
     (sunucu o saatte kapalıysa açılışta telafi eder)
   - `vegaland-hasat.service` → `flock` + `node hasat-runner.mjs`, `SKIP_ZILLOW=1 SKIP_TAX=1`, 6 saat tavan
   - `vegaland-geo.service` → `geo-turu-vps.sh`, sürekli, `Restart=always`, `Nice=10`
   - Servisler **root olarak değil**, proje klasörünün sahibi kullanıcı olarak koşar;
     yazma izni yalnız `/opt/vegaland` (`ProtectSystem=full`, `ReadWritePaths`)
6. **Log döngüsü** — üç kat: `hasat-runner`'ın kendi budaması + `geo-turu-vps.sh` parti budaması +
   `logrotate` (günlük, 7 kopya, 50 MB tavan) + `journald` toplam **500 MB** tavan.
   *(2026-07-27'de disk dolunca Postgres salt-okunura düşmüştü — bir daha olmasın.)*
7. **KENDİNİ TEST EDER:**
   - **1/4 DB (salt okuma):** satır / geo ✓ / geo kuyruğu / A+A / DB boyutu
   - **2/4 Overpass aynaları:** kaç ayna açık, Mac'in 1/7'siyle yan yana ← *asıl merak edilen*
   - **3/4 Hasat ortamı:** `hasat-runner.mjs --smoke` (veri yazmaz)
   - **4/4 Küçük geo partisi:** 25 kayıt + **yol bulma oranı**. Sağlıklı turlarda ~%88.
     %20'nin altındaysa geo servisini hemen durdur, `NOT-MOTORU-KALIBRASYON.md`'ye bak.
     Atlamak için: `KUR_GEO_SMOKE=0 sudo bash kur.sh`

**Betik idempotenttir** — ikinci, üçüncü kez koşturmak bozmaz. `.env` dosyalarına asla dokunmaz.

Kurmadan sadece test etmek istersen: `sudo bash /opt/vegaland/deploy/vps/kur.sh dogrula`

---

## 4. İZLEME

```bash
# Tek bakışta her şey
sudo bash /opt/vegaland/deploy/vps/kur.sh durum

# Geo turu — canlı akış
journalctl -u vegaland-geo -f

# Geo turu — parti parti defter (kalıcı, en okunası)
tail -f /opt/vegaland/scraper/logs/geo-vps/durum.txt

# Tek partinin tam çıktısı (ayna tablosu, hücre/dk, hata sayısı)
ls -t /opt/vegaland/scraper/logs/geo-vps/parti-*.log | head -1 | xargs tail -50

# Hasat turu
journalctl -u vegaland-hasat -n 100
systemctl list-timers vegaland-hasat.timer     # sıradaki koşu ne zaman
cat /opt/vegaland/scraper/.hasat-durum.json    # makine-okunur durum (panel /admin/sistem de bunu okur)

# Anlık ilerleme
cd /opt/vegaland/scraper && node geo-durum.mjs
```

**Durum dosyaları nerede:**

| Dosya | Ne yazar |
|---|---|
| `scraper/logs/geo-vps/durum.txt` | parti parti: mod, kalan havuz, hücre/dk, yol bulma oranı |
| `scraper/logs/geo-vps/parti-*.log` | tek partinin tam çıktısı (son 60 parti tutulur) |
| `scraper/.hasat-durum.json` | son hasat turu: adımlar, çıkış kodları, satır deltaları |
| `scraper/.geo-vps.lock` | geo turu kilidi (flock) |
| `scraper/.hasat.lock` + `.hasat.flock` | hasat kilidi |
| `scraper/data/geo-cell-cache.ndjson` | kalıcı hücre önbelleği — resume'un kalbi |

---

## 5. DURDURMA / ELLE ÇALIŞTIRMA

```bash
# Geo turunu durdur (aktif parti biter, veri kaybı YOK — resume edilebilir)
sudo systemctl stop vegaland-geo

# Geri başlat
sudo systemctl start vegaland-geo

# Hasat turunu ŞİMDİ elle tetikle
sudo systemctl start vegaland-hasat

# Günlük hasadı geçici durdur (timer'ı kapat)
sudo systemctl stop vegaland-hasat.timer

# Ayarı değiştir (parti boyu, mod, saat) — birim dosyasını EZMEDEN
sudo systemctl edit vegaland-geo          # örn. Environment=PARTI_BOY=3000
sudo systemctl edit vegaland-hasat.timer  # örn. OnCalendar=*-*-* 01:00:00
sudo systemctl daemon-reload && sudo systemctl restart vegaland-geo
```

**⛔ Geo servisi "durdu ve kalkmıyor" ise:** muhtemelen **sağlık kapısı** devreye girdi.
`geo-turu-vps.sh`, yol bulma oranı %20'nin altına düşerse **çıkış 2** ile durur ve
`RestartPreventExitStatus=2` yüzünden systemd onu **yeniden başlatmaz**.
Bu bilinçli: 2026-07-29'da `out center bb` hatası yüzünden 99.309 parsel yanlışlıkla F damgası
yedi. Bozuk veriyle yüz bin kayıt damgalamak, durmaktan kötüdür.
Kontrol: `journalctl -u vegaland-geo -n 40` → `NOT-MOTORU-KALIBRASYON.md` → düzeltince
`sudo systemctl restart vegaland-geo`.

---

## 6. GERİ ALMA

```bash
# systemd birimlerini, logrotate ve journald ayarını söker.
# Proje dosyalarına, .env'e ve VERİTABANINA dokunmaz.
sudo bash /opt/vegaland/deploy/vps/kur.sh kaldir

# Dosyaları da silmek istersen (DB'ye yine dokunmaz):
sudo rm -rf /opt/vegaland
```

Ne kaldırılır: `/etc/systemd/system/vegaland-{hasat.service,hasat.timer,geo.service}`,
`/etc/logrotate.d/vegaland`, `/etc/systemd/journald.conf.d/vegaland.conf`, kilit dosyaları.
Node ve npm paketleri sistemde kalır (başka bir şey onları kullanıyor olabilir).

Geri alma **veri kaybı yaratmaz**: geo turu her an kesilebilir, `geo_enriched_at IS NULL`
filtresi + hücre önbelleği sayesinde iş kaldığı yerden devam eder.

---

## 7. ⚠ MAC İLE ÇAKIŞMA — bunu okumadan ikisini birden açma

Şu an Mac'te **iki iş** var:

| İş | Nasıl koşuyor | Ne yapmalı |
|---|---|---|
| Günlük hasat | `launchd` → `com.terralot.sourcing`, her gün **06:00** (yerel), şu an **YÜKLÜ** | **KAPAT** (aşağıda) |
| Geo turu | `scraper/geo-turu-gizli-a.sh`, **elle** koşuyor (PID 96107), parti 2, havuzda 8.750 | Aktif partisi bitene kadar bırak, sonra kapat |

### Mükerrer iş olur mu? — Net cevap

**Veri BOZULMAZ, ama iş İSRAF olur ve DB'ye gereksiz yük biner.**

- **Kilitler makine-yereldir.** `hasat-runner.mjs`'in `.hasat.lock`'u ve `geo-turu-vps.sh`'in
  `flock`'u **kendi diskindeki** dosyalara bakar. Mac'in kilidi VPS'i, VPS'in kilidi Mac'i
  **görmez**. DB tarafında dağıtık kilit (advisory lock) **yok**.
- **Mükerrer SATIR oluşmaz.** `filtreli-hasat.mjs` yalnızca `ON CONFLICT DO UPDATE` (upsert)
  yazar; aynı parsel iki kez inse tek satır kalır.
- **Geo işi mükerrer olabilir.** İki makine `geo_enriched_at IS NULL` kuyruğunu **aynı anda**
  seçebilir → aynı lead iki kez taranır. Yazım idempotent (aynı değerler), yani **veri
  doğru kalır** — sadece yarısı boşa gider. Kritik kaynak zaten Overpass; iki makine iki ayrı
  IP'den bastığı için ayna kotası da iki kat yenir.
- **Gerçek risk: eşzamanlı `grade-offmarket.mjs`.** Bu betik **tüm tabloyu** okuyup yeniden
  notlandırıyor. İki makinede aynı anda koşarsa 787K satırlık iki tam tur üst üste biner —
  Supabase'in 2 GB'lık örneğinde ağır yük, kilit beklemesi ve zaman aşımı demek.

### Yapılacak (sırayla)

```bash
# Mac'te — 1) günlük hasat işini KAPAT
launchctl bootout "gui/$(id -u)/com.terralot.sourcing"
launchctl list | grep terralot || echo "kapatıldı ✔"

# 2) Elle koşan geo turunu durdur (aktif partisi biterken beklemek istersen
#    önce durum defterine bak; kesmek de güvenli — resume edilebilir)
tail -5 ~/Desktop/Aktif\ Projeler/terralot-v2/scraper/logs/gizli-a-durum.txt
pkill -f geo-turu-gizli-a.sh          # tur döngüsü durur
# İstersen aktif node partisi de: pkill -f geo-enrich-offmarket.mjs
```

Sonra VPS'te `sudo systemctl start vegaland-geo`.

**Geri dönmek istersen** (VPS'i kapat, Mac'e dön):
```bash
# VPS'te
sudo systemctl stop vegaland-geo vegaland-hasat.timer
# Mac'te
bash ~/Desktop/Aktif\ Projeler/terralot-v2/scraper/launchd-kur.sh kur
```

> **Kısa kural: aynı anda yalnız BİR makine.** Geçiş anında ikisi birkaç dakika üst üste
> binerse dünya yıkılmaz (veri doğru kalır) — ama günlerce böyle bırakılmamalı.

---

## 8. Sorun giderme

| Belirti | Sebep / Çözüm |
|---|---|
| `DATABASE_URL bulunamadı (dashboard/.env.local)` | Dosya yok ya da satır boş. `nano /opt/vegaland/dashboard/.env.local` |
| `Hiçbir Overpass aynası ABD verisi döndürmedi` | Ayna kapalı. Betik 10 dk bekleyip yeniden dener, **veri kaybı yok**. Sürerse: `bash deploy/vps/overpass-test.sh` |
| geo servisi durdu, kalkmıyor | Sağlık kapısı (çıkış 2). Bölüm 5'in sonuna bak. |
| `filtreli-hasat.mjs` patlıyor, `.ts` import hatası | Node < 22.18. `curl -fsSL https://deb.nodesource.com/setup_24.x \| sudo bash - && sudo apt install -y nodejs` |
| Hasat turu `disk-guard` ile iptal oluyor | Disk %80 üstü. `df -h`, `journalctl --vacuum-size=200M`, `rm -rf /opt/vegaland/scraper/downloads/*` |
| Hız hâlâ ~19 lead/dk | VPS'te de tek ayna açık demektir. Bölüm 0'daki tabloya dön — bu senaryoda kazanç yalnız 7/24. |
| `npm ci` Chromium indirmeye kalkıyor | `PUPPETEER_SKIP_DOWNLOAD=true` unutulmuş. `kur.sh` bunu zaten ayarlıyor; elle koşuyorsan ekle. |

---

## Paket içeriği

| Dosya | İş |
|---|---|
| `overpass-test.sh` | Tek başına çalışan ayna testi (bağımlılık yok). Karar noktası. Ayna listesini `geo-enrich-offmarket.mjs`'den okur — liste kopyalanmaz. |
| `gonder.sh` | Mac → VPS rsync. Sadece gerekeni gönderir; `node_modules`, `.next`, `.git`, `dashboard/src/data`, `yedek/`, `.env*` dışlanır. `--deneme` ile kuru koşu. |
| `kur.sh` | Tek komutla kurulum: OS/Node kontrolü, `.env` iskeleti, `npm ci`, systemd birimleri, log döngüsü, 4 adımlı kendini test. `kur \| dogrula \| durum \| kaldir`. |
| `geo-turu-vps.sh` | Sürekli geo turu (systemd için). Mac'teki `geo-turu-*.sh`'e **dokunmaz**. Farklar: git commit yok, `flock` kilidi, otomatik mod (gizli-A → tam kuyruk), sağlık kapısı, log budama. |
| `db-test.mjs` | Salt-okuma DB doğrulaması: satır/geo/kuyruk sayıları + geo sütunlarının şemada varlığı. Bağlantıyı gerçek turların yolundan (`dbUrl()`) okur. |
| `.env.ornek` | İki hedef dosyanın şablonu. **Gerçek değer içermez.** |
| `systemd/vegaland-hasat.service` + `.timer` | Günlük hasat (03:30 UTC), `Persistent=true`, flock, 6 saat tavan |
| `systemd/vegaland-geo.service` | Sürekli geo, `Restart=always`, `RestartPreventExitStatus=2 3`, `Nice=10` |
| `systemd/vegaland-logrotate.conf` | Log döngüsü şablonu (`@KOK@` yer tutucuları `kur.sh` doldurur) |
