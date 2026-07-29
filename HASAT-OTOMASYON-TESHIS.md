# Hasat Otomasyonu — Teşhis ve Onarım Raporu

**Tarih:** 2026-07-29 · **Dal:** `agent-improve-2026-06-29` · **Proje:** VegaLand (terralot-v2)

---

## 1. Özet: ne oluyordu?

Günlük veri hasadı **16 Haziran'dan beri fiilen ölüydü** ama panel ve durum dosyası
her gün **"başarılı"** yazıyordu. İki bağımsız arıza üst üste binmişti:

| # | Arıza | Etkisi |
|---|---|---|
| A | launchd görevi **senkronsuz bir ayna klasöre** koşuyordu (29 Haziran'da donmuş) | Temmuz'da yazılan hiçbir hasat betiği çalışmadı |
| B | `run-all.sh` her adımın hatasını yutup **her zaman exit 0** dönüyordu | Hatalar görünmedi, durum dosyası hep "başarılı" yazdı |

A tek başına fark edilebilirdi. B, A'yı **görünmez** yaptı. Asıl tehlike buydu.

---

## 2. Teşhis — ölçümler

### 2.1 launchd görevi

```
$ launchctl list | grep terralot
-	0	com.terralot.sourcing        ← "son çıkış kodu 0" = her gün başarılı görünüyor
```

`~/Library/LaunchAgents/com.terralot.sourcing.plist` (yedeği:
`yedek/com.terralot.sourcing.plist.yedek-20260729`) şunu işaret ediyordu:

```
/bin/bash  /Users/yigiterturk/Library/Application Support/terralot-runner/run.sh
WorkingDirectory: /Users/yigiterturk/Library/Application Support/terralot-runner
Log:              .../terralot-runner/logs/launchd.{out,err}.log   ← ikisi de 0 byte
```

Yani **gerçek projeye değil, `~/Library/Application Support/terralot-runner/`
altındaki bir AYNA klasöre** bağlıydı.

### 2.2 Ayna ne kadar eski?

| | Gerçek proje `scraper/` | Ayna `terralot-runner/scraper/` |
|---|---|---|
| Dosya sayısı | **236** | **148** |
| `run-all.sh` tarihi | 2026-07-27 | **2026-06-29** |
| `disk-guard.mjs` | var | **YOK** |

Aynada bulunmayan (= otomasyonda hiç koşmamış) Temmuz betiklerinden bazıları:

```
disk-guard.mjs            grade-offmarket.mjs       harvest-owners.mjs
harvest-land-comps.mjs    geo-enrich-offmarket.mjs  backfill-coords.mjs
backfill-values.mjs       build-county-valuation.mjs competitor-scraper-v2.mjs
offmarket-tx-{brewster,hudspeth,presidio,terrell,batch,batch2}.mjs
offmarket-co{,-costilla,-lasanimas}.mjs   offmarket-fl{,-lee}.mjs
offmarket-nm-valencia.mjs  arkansas/georgia/michigan/missouri/nc/
nevada/oklahoma/oregon/southcarolina/tennessee-offmarket.mjs
```

**Not:** `disk-guard.mjs` aynada yoktu — yani 27 Temmuz disk krizinden sonra yazılan
disk bekçisi otomasyonda **hiç devrede değildi**.

### 2.3 Neden ayna senkronlanmıyordu? (kök neden)

`run.sh` her koşumda kaynaktan `rsync` denemesi yapıyordu ama loglarda her gün:

```
IO error encountered -- skipping file deletion
[sync] Desktop okunamadı (TCC — launchd altında normal), mevcut kopyayla devam.
```

Bunu doğrudan ölçtüm — geçici bir launchd görevi kurup çalıştırdım:

```
whoami=yigiterturk
-- ls  "…/terralot-v2/scraper"        →  FAIL
-- head "…/scraper/run-all.sh"        →  FAIL
-- head "…/scraper/.env"              →  FAIL
-- rsync …                            →  "unreadable directory: Operation not permitted"
```

macOS **TCC**, launchd'nin başlattığı **Apple platform ikililerinin**
(`/bin/bash`, `ls`, `cat`, `head`, `rsync`) `~/Desktop` altını okumasını engelliyor.
Ayna klasör mimarisi bu engeli aşmak için kurulmuştu ama **senkron mekanizması da
aynı engele takılıyordu** — yani ayna tasarımı gereği bir daha asla güncellenemezdi.

### 2.4 KRİTİK BULGU — TCC engeli ikiliye özgü

Aynı test node ile tekrarlandığında:

```
--- node kendisi:            readdir OK 241        ← Desktop OKUNUYOR
--- node -> bash -> ls:      236                   ← çocuk süreç izni DEVRALIYOR
--- node -> bash -> cat:     bytes 3984
--- node -> node (child):    child readdir 241
--- node -> bash -> rsync:   rsync sessiz (OK)
```

**Homebrew node (`/opt/homebrew/bin/node`) launchd altında Desktop'ı okuyabiliyor
ve başlattığı tüm çocuk süreçler (bash, rsync, node) bu izni devralıyor.**
Çözüm bu bulgunun üstüne kuruldu: ayna klasöre artık gerek yok.

### 2.5 Sessiz başarısızlık — `run-all.sh` `step()` hatası

```bash
if "$@" >>"$LOG" 2>&1; then
  echo "[$(date '+%H:%M:%S')] OK: $*" | tee -a "$LOG"
else
  echo "[$(date '+%H:%M:%S')] WARN: '$*' exited $?" | tee -a "$LOG"   # ← BUG
fi
```

`$(date …)` komut ikamesi, aynı satırdaki `$?` genişlemesinden **önce** çalışıp
`$?` değerini **0'a eziyor**. Sonuç: her hata logda `exited 0` görünüyordu.

Log kanıtı (28 Temmuz — üç scraper patlamış, hepsi "exited 0"):

```
[06:00:05] WARN: 'node scrape_mvba_live.js' exited 0
[06:00:05] WARN: 'node scrape_pbfcm_live.js' exited 0
[06:00:05] WARN: 'node scrape_delinquent_tax_rolls.js' exited 0
[06:57:04] WARN: 'node competitor-scraper.js' exited 0
```

Üstelik `step()` hiçbir sayaç tutmuyordu ve `run-all.sh` **her hâlükârda 0 dönüyordu**
→ `run.sh` `FAIL=0` → `status.json` `consecutiveFailures: 0, lastError: null` →
panel yeşil. **3,5 hafta boyunca her gün.**

### 2.6 Tazelik izleri gerçeği yansıtmıyordu

`scraper/.freshness-state.json` — dosya tarihi **4 Temmuz**, içerik:

| Kaynak | Son veri (`maxTs`) | Yaş (29 Tem.) |
|---|---|---|
| TAX | 2026-06-20 | 39 gün |
| SOCRATA | 2026-06-16 | 43 gün |
| ZILLOW | 2026-06-14 | 45 gün |
| govease | 2026-06-16 | 43 gün |
| offmarket | 2026-06-26 | 33 gün |
| competitor | 2026-07-04 | 25 gün |

Dosya **25 gündür güncellenmiyordu**: `run.sh` sonunda `cp … "$SRC_SCRAPER/"` ile
Desktop'a geri kopyalanıyor, o da TCC'ye takılıp sessizce atlanıyordu
(`[state] Desktop'a kopyalanamadı (TCC — normal).`). Yani **evet, izler gerçeği
yansıtmıyordu** — hem bayattılar hem de bayat oldukları hiçbir yerde görünmüyordu.

---

## 3. Onarım

### 3.1 launchd görevi gerçek projeye bağlandı

**Yedek:** `yedek/com.terralot.sourcing.plist.yedek-20260729` (ve `launchd-kur.sh`
her kurulumda otomatik yedek alır).

| | Önce | Sonra |
|---|---|---|
| Program | `/bin/bash …/terralot-runner/run.sh` | `/opt/homebrew/bin/node …/terralot-v2/scraper/hasat-runner.mjs` |
| WorkingDirectory | `…/terralot-runner` | `…/terralot-v2/scraper` |
| Log | `…/terralot-runner/logs/` | `…/terralot-v2/scraper/logs/hasat/` |
| Öncelik | (yok) | `ProcessType=Background`, `Nice=10`, `LowPriorityIO` |
| Ayna kalıntısı | vardı | **plist'ten tamamen çıkarıldı** |

Kanonik plist repoda: `scraper/com.terralot.sourcing.plist`.
Kurulum/durum/tetikleme: `bash scraper/launchd-kur.sh [kur|durum|tetikle]`.

> **Bu projeyle ilgisiz launchd görevlerine dokunulmadı.** Teşhis sırasında geçici
> olarak kurulan `com.terralot.tcctest` görevi kaldırıldı.

### 3.2 Yeni koşucu: `scraper/hasat-runner.mjs`

- **Kilit** — `.hasat.lock` (PID kontrollü; ölü PID'li bayat kilit temizlenir) → turlar üst üste binmez.
- **Zaman damgalı log** — `logs/hasat/hasat_<damga>.log` + **ayrı** `hasat_<damga>.err.log`; her satır ISO zaman damgalı.
- **Ölçüm** — koşu öncesi/sonrası satır sayıları (3 tablo), dokunulan county listesi.
- **Durum dosyası** — `.hasat-durum.json` (aşağıda).
- **Çıkış kodu** — bir adım patlarsa runner **1** döner; runner'ın kendisi çökse bile durum dosyasına "çöktü" yazar.
- **Düşük öncelik** — çocuk süreçler `nice -n 10` ile başlar.
- **Log döngüsü** — hem `logs/hasat/hasat_*` hem `logs/run_*`: son 30 koşu · 21 gün · toplam 200 MB (env ile ayarlanır).

### 3.3 `run-all.sh` artık yalan söylemiyor

- `$?` **hemen** yakalanıyor (`$(date)` ezmesi giderildi) → gerçek çıkış kodu loga yazılıyor.
- `BASARISIZ` sayacı + patlayan adım isimleri tutuluyor.
- Adımlar yine "patlasa da devam" mantığıyla koşuyor (bir kaynağın ölmesi diğerlerini engellememeli) ama script **sonunda nonzero dönüyor**.
- Opsiyonel `ADIM_SONUC_DOSYASI` TSV'si ile her adımın adı/kodu/süresi runner'a aktarılıyor.

### 3.4 PATH hatası (onarım sırasında yakalandı)

İlk gerçek koşuda yeni hata raporlama **anında** yeni bir arıza gösterdi:

```
run-all.sh: line 59: node: command not found
[05:35:13] ABORT: disk bekçisi turu durdurdu
```

launchd süreçlere kırpılmış bir `PATH` verir (içinde `node` yoktur). Eski `run.sh`
bunu elle set ediyordu, yeni runner etmiyordu. `hasat-runner.mjs` artık çocuk
süreçlere `PATH`'i açıkça geçiriyor. *(Eski sistemde bu hata da sessizce yutulurdu.)*

### 3.5 Panelde görünür sağlık

- `src/lib/hasat-durum.ts` — saf sağlık mantığı (**10 yeni test**).
- `src/app/api/admin/hasat-durum/route.ts` — durum dosyasını okur (gate + rate limit).
- `src/app/admin/yontem/HasatSagligi.tsx` — kart; **`/admin/yontem`** (yani `/admin/sistem` yönlendirmesinin vardığı yer) ve **`/admin/scraper`** sayfalarının en üstünde.

Renk kuralları — **hiçbiri uydurma değil, hepsi dosyadan**:

| Durum | Renk |
|---|---|
| Başarılı, taze (≤36sa), veri gelmiş | 🟢 yeşil |
| Hatasız ama **0 yeni satır** | 🟡 sarı |
| Sadece smoke koşusu | 🟡 sarı |
| Son koşu başarısız · son başarılı >36sa · runner >30sa sessiz | 🔴 kırmızı |
| **Durum dosyası yok** | ⬜ "bilinmiyor" (**yeşil varsayılmaz**) |

Başlık tam olarak istenen cümledir: **"Son başarılı hasat: X saat önce"**.

---

## 4. Doğrulama

### 4.1 Görev gerçekten koşuyor mu?

`launchctl kickstart gui/$(id -u)/com.terralot.sourcing` → `logs/hasat/hasat_*.log`:

```
[05:37:21] >>> disk-guard
  TOPLAM : 2.36 GB / 8 GB → %29.5 · salt-okunur: off
  ✓ disk-guard: yer var (eşik %80), tur başlayabilir.
[05:37:22] HATA: 'node scrape_mvba_live.js' çıkış kodu 1 (0sn)
[05:37:23] HATA: 'node scrape_pbfcm_live.js' çıkış kodu 1 (1sn)
[05:37:24] HATA: 'node scrape_delinquent_tax_rolls.js' çıkış kodu 1 (1sn)
[05:37:43] OK: node migrate_to_supabase.js (19sn)
[05:38:44] OK: node socrata-harvest.js (61sn)
[05:38:45] OK: node govease-harvest.js (1sn)
[05:38:47] OK: node snapshot-deals.js (2sn)
```

Aynı üç scraper **28 Temmuz'da "exited 0"** diyordu; artık **"çıkış kodu 1"** diyor.
Ayrıca `disk-guard` otomasyonda **ilk kez** koştu (aynada yoktu).

**Turun sonucu (45 dk):** `BAŞARISIZ · yeni satır 331 · county 10`, runner çıkış 1.
Dokunulan county'ler: FL/Lee 316 · OR/Klamath 4 · TX/Kerr 3 · MO/Camden 2 · TX/Uvalde 1 …
Yani boru hattı **gerçekten veri getirdi** ve aynı anda **hâlâ bozuk olan 3 adımı
sakladı değil, bildirdi**. `dd-enrich.js` tek başına 2585 sn (43 dk) sürdü.

### 4.1b Chrome onarımı sonrası — TAM YEŞİL TUR

Puppeteer Chrome kurulduktan sonra tam boru hattı tekrar koşturuldu (`DD_LIMIT=1`):

```
[06:24:30] OK: node scrape_mvba_live.js (4sn)          ← önce çıkış 1
[06:24:47] OK: node scrape_pbfcm_live.js (17sn)        ← önce çıkış 1
[06:24:50] OK: node scrape_delinquent_tax_rolls.js (3sn) ← önce çıkış 1
[06:24:56] OK: node migrate_to_supabase.js (6sn)
[06:26:05] OK: node socrata-harvest.js (69sn)
[06:26:06] OK: node govease-harvest.js (1sn)
[06:26:07] OK: node snapshot-deals.js (1sn)
[06:26:19] OK: node dd-enrich.js (12sn)
[06:27:25] OK: node competitor-scraper.js (66sn)       ← önce çıkış 1
[06:27:26] OK: node rakip-radar.mjs (1sn)
[06:27:32] OK: node freshness-check.mjs (6sn)
[06:27:32] SONUÇ: tüm adımlar başarılı.
==== HASAT BİTTİ — BAŞARILI · yeni satır 95 ====        runner çıkış 0
```

`tax_delinquent_properties` **+95 satır** — TAX kaynağı 20 Haziran'dan beri ilk kez
gerçekten beslendi.

Aynı tur **launchd üzerinden** de tekrarlandı (zincirin tamamı doğrulansın diye):

```
$ launchctl list | grep terralot
-	0	com.terralot.sourcing          ← ARTIK 0 (başarılı), tatbikatta 1 oluyordu
	last exit code = 0
durum: basarili=true · süre 259sn · hata yok
```

Bu turda `toplamYeniSatir = 0` çıktı (4 dakika önceki tur her şeyi çekmişti) ve panel
bunu **sarı** gösterdi — "hatasız ama veri gelmedi" durumunun doğru çalıştığının kanıtı.

### 4.2b Panel doğrulaması (canlı)

`GET /api/admin/hasat-durum` (gate'li, HTTP 200):

```
RENK    : yesil
BAŞLIK  : Son başarılı hasat: az önce
AÇIKLAMA: 95 yeni satır · tur 3 dk sürdü
başarısız adım: 0
```

Aynı uç, başarısız turda **kırmızı** ve gerçek sebebi yazıyordu. Gate'siz istek **401**.
`/admin/sistem` → 307 → `/admin/yontem` (kart orada), `/admin/scraper` → 200 (kart orada).

### 4.2 Kasıtlı hata artık yutulmuyor mu?

`HASAT_ZORLA_HATA=1` (var olmayan county betiği) ile launchd üzerinden tatbikat:

```
$ launchctl list | grep terralot
-	1	com.terralot.sourcing          ← ÖNCE HEP 0'DI
$ launchctl print … | grep "last exit"
	last exit code = 1
```

`.hasat-durum.json`:
```json
{ "sonKosuBasarili": false, "ustUsteHata": 3,
  "sonHata": "tatbikat: olmayan county (çıkış 1) — Error: Cannot find module '…/offmarket-xx-olmayan-county.mjs'",
  "sonBasariliKosu": "2026-07-29T02:32:33.299Z" }
```

`hasat_<damga>.err.log` (zaman damgalı, ayrı dosya):
```
[2026-07-29T02:33:19.715Z] TATBİKAT: HASAT_ZORLA_HATA=1 — var olmayan county betiği çağrılıyor.
Error: Cannot find module '…/scraper/offmarket-xx-olmayan-county.mjs'
[2026-07-29T02:33:24.381Z] ==== HASAT BİTTİ — BAŞARISIZ · yeni satır 0 · county 0 ====
```

Dikkat: **`sonBasariliKosu` geri alınmadı** — başarısız tur "son başarılı hasat"
saatini tazelemez. Panel bu yüzden kırmızıya döner ve doğru yaşı gösterir.

### 4.3 Veri güvenliği

| Tablo | Başta | Sonda | Fark |
|---|---|---|---|
| `offmarket_leads` | **565.930** | **566.265** | **+335** ✅ (sınır 565.930 — altına düşmedi) |
| `tax_delinquent_properties` | 34.664 | 34.759 | +95 ✅ |
| `competitor_listings` | 342 | 287 | −55 ⚠ |

`competitor_listings` düşüşü **beklenen davranıştır**: `competitor-scraper.js` tabloyu
her koşuda taze taramayla değiştirir; 342 rakamı haftalardır güncellenmemiş bayat
satırları içeriyordu, 287 ise bugünkü gerçek ilan sayısı. `freshness-check.mjs` bu
tip düşüşleri ayrıca `DROP` olarak raporlar.

`DELETE` / `DROP` / `TRUNCATE` **elle çalıştırılmadı**. Ücretli API (Regrid / ATTOM /
RapidAPI-Zillow) **çağrılmadı**.

> Şeffaflık notu: betik taraması sırasında `competitor-fetch.mjs` çalıştırıldı; bu
> betik kendi içinde tek rakip için `delete from competitor_listings where competitor=$1`
> yapıp tazeliyor (197 ilan sorunsuz geri yazıldı). `grade-offmarket.mjs` ve
> `geo-enrich-offmarket.mjs` benzer `delete` içerdiği için **hiç çalıştırılmadı**.
> `offmarket_leads` tablosuna hiçbir silme işlemi dokunmadı.

### 4.4 Regresyon

- `npm run build` → **yeşil** ("Compiled successfully")
- `npm test` → **358/358** (348 mevcut + 10 yeni hasat sağlığı testi · azalma yok)
- `npm run kapsam` → FL atlama davranışı **korundu** (`⏭ fl-lee … atlandı — FL hasadı tamam`)

---

## 5. Hasat betikleri — hangileri çalışıyor?

Boru hattındaki ve Temmuz'da yazılmış betikler bugün elle, küçük limitlerle denendi.
Ücretli API (Regrid / ATTOM / RapidAPI-Zillow) **çağrılmadı**.

### 5.1 ONARILDI — Puppeteer Chrome eksikti

`~/.cache/puppeteer` klasörü **hiç yoktu**. Chrome binary'si olmadığı için
run-all.sh'in 2. ve 4. adımları (**4 betik**) tamamen ölüydü:

```
FATAL: Error: Could not find Chrome (ver. 149.0.7827.22)
```

Düzeltme uygulandı → `npx puppeteer browsers install chrome`. Kurulum sonrası ölçüm:

| Betik | Önce | Sonra |
|---|---|---|
| `competitor-scraper.js` | çıkış 1 (Chrome yok) | ✅ **287 ilan Supabase'e yazıldı** |
| `scrape_mvba_live.js` | çıkış 1 | ✅ çıkış 0 — "MVBA Tarama ve İthalat Tamamlandı" |
| `scrape_delinquent_tax_rolls.js` | çıkış 1 | ✅ çıkış 0 — "PBFCM Tarama ve İthalat Tamamlandı" |
| `scrape_pbfcm_live.js` | çıkış 1 | ✅ çalışıyor (uzun sürüyor, 45sn'de bitmedi) |

**TAX ve competitor kaynaklarının haftalardır "STALE" görünmesinin sebebi buydu.**

### 5.2 Çalışan boru hattı adımları

`disk-guard.mjs` · `migrate_to_supabase.js` (Zillow 5829, TaxSales 4038) ·
`socrata-harvest.js` (804 lead / 35 dataset) · `govease-harvest.js` ·
`snapshot-deals.js` · `rakip-radar.mjs` · `freshness-check.mjs` ·
`dd-enrich.js` (sağlam ama çok yavaş — varsayılan `DD_LIMIT=150` saatler sürer).

### 5.3 Çalışan off-market hasatçıları (otomasyonda hiç koşmamışlardı)

47/47 betiğin sözdizimi temiz. Gerçekten koşup veri yazanlar:

`offmarket-tx-brewster` (7.957) · `offmarket-co-costilla` (31.234) ·
`offmarket-co-lasanimas` (1.610) · `offmarket-fl-lee` (1.698) ·
`georgia-offmarket` (10.245) · `michigan-offmarket` (6.431) ·
`missouri-offmarket` (10.343) · `nevada-offmarket` (30.481) ·
`oregon-offmarket` (23.265) · `southcarolina-offmarket` (11.861) ·
`backfill-values` (OR/Lake 6.252 yazıldı) · `build-county-valuation` (208.442 comp) ·
`competitor-fetch` (197 ilan, Chrome'suz) · `competitor-scraper-v2` (Discount Lots + Landio + Rina)

Yavaş ama sağlam (limitle kesildi): `offmarket-tx-batch` · `offmarket-co` ·
`offmarket-nm-valencia` · `arkansas-offmarket` · `nc-offmarket` ·
`harvest-owners` · `harvest-land-comps`

### 5.4 HÂLÂ BOZUK kalanlar

| Betik | Neden bozuk |
|---|---|
| `colorado-offmarket.mjs` (v1) | ArcGIS `{"code":400}` — where cümlesi eyalet katmanında reddediliyor. **Halefi `offmarket-co.mjs` çalışıyor**, eski dosya emekli edilmeli. `colorado-offmarket.csv` diskte 120 bayt = sadece başlık. |
| `mohave-offmarket.mjs` | `mcgis.mohave.gov` ulaşılamıyor (curl HTTP 000). Kaynak sunucu tarafı. |
| `florida-offmarket.mjs` / `offmarket-fl.mjs` | Katalog ayakta (200) ama sorgu hiç satır döndürmüyor; 75–100 sn boyunca tek çıktı yok. |
| `oklahoma-offmarket.mjs` | Çalışıyor **ama canlı hasat değil** — 23 Tem tarihli statik `ok_resale_sample.json` dosyasını okuyor. |
| 9 TX CAD servisi | `"Token Required"` dönüyor (Milam, Winkler, LiveOak, Baylor, RedRiver, Roberts, Cooke, Carson, Goliad) — TX batch'lerin ~%6'sı sessizce boş dönüyor. |
| `tennessee-offmarket.mjs` | tndtax.com artık yalnız 2 entity listeliyor (kaynak portal daralmış). |
| `govease-harvest.js` | Çalışıyor ama kaynak 8 satıra düşmüş (freshness `DROP -85%` diyor). |

### 5.5 Diğer sessiz-yutma kalıpları (henüz açık)

Bunlar bu turda düzeltilmedi ama **kayıt altına alındı** — aynı hastalığın başka biçimleri:

- **`mohave-offmarket.mjs` ve `colorado-offmarket.mjs`**: `catch { continue; }` kalıbı
  yüzünden tüm sayfalar patlasa bile **boş** JSON/CSV yazıp **exit 0** dönüyorlar.
  Panel bunu "0 fırsat" diye gösterir, hiçbir alarm çalmaz. `colorado-offmarket.csv`
  zaten bu yüzden 120 bayt.
- **`florida-offmarket.mjs` / `offmarket-fl.mjs`**: `catch { break; }` ile county atlıyor.
- **`socrata-harvest.js`**: unique constraint'e takılınca `insert` batch'ini komple
  kaybediyor (`duplicate key … tax_delinquent_properties_source_county_apn_key`).
  `upsert` / `onConflict` kullanmalı — şu an sessiz veri kaybı var.
- **Telegram uyarıları fiilen KAPALI**: `scraper/.env` içinde `TELEGRAM_BOT_TOKEN` ve
  `TELEGRAM_CHAT_ID` **boş**. `run-all.sh`'in "dead-man's switch" heartbeat'i ve
  `disk-guard`'ın kritik uyarıları **kimseye ulaşmıyor**. Panel artık gerçeği
  gösteriyor ama *push* uyarı yok — token girilmeli.

---

## 6. Sahibin bilmesi gerekenler

1. **Ayna klasör artık kullanılmıyor.** `~/Library/Application Support/terralot-runner/`
   silinmedi (referans olarak duruyor) ama hiçbir şey onu çağırmıyor. Güvenle silinebilir.
2. **Kod değiştirince artık senkron gerekmiyor** — launchd doğrudan gerçek projeyi koşuyor.
   Eski "`bash run.sh sync` çalıştırmayı unutma" kuralı **ortadan kalktı**.
3. **`/admin/sistem` (→ `/admin/yontem`) ve `/admin/scraper`** ekranlarının en üstünde
   artık gerçek hasat sağlığı var. Kırmızıysa gerçekten kırmızıdır.
4. Faydalı komutlar:
   ```
   bash scraper/launchd-kur.sh durum      # görev yüklü mü, son durum ne
   bash scraper/launchd-kur.sh tetikle    # şimdi koştur
   bash scraper/launchd-kur.sh kur        # plist'i yenile (otomatik yedekli)
   ```
5. **Projeyi Desktop'tan taşımak artık ZORUNLU DEĞİL** (eski bekleyen madde).
   TCC engeli node üzerinden aşıldı. Yine de taşınırsa plist'teki iki mutlak yol
   güncellenmeli.
6. **Telegram token'larını gir** (`scraper/.env`) — panel artık dürüst ama telefonuna
   uyarı gitmiyor. Boş token = disk krizi uyarısı da sessiz.
7. Sırada bekleyen düzeltmeler (bu turda yapılmadı): `socrata-harvest.js` upsert'e
   geçirilmeli · `mohave`/`colorado` betiklerinin `catch { continue; }` kalıbı
   0 satırda hata döndürmeli · `colorado-offmarket.mjs` emekli edilip
   `offmarket-co.mjs` ile değiştirilmeli.

---

## 7. Yapılan değişikliklerin listesi

**Yeni**
- `scraper/hasat-runner.mjs` — launchd giriş noktası (kilit, log, ölçüm, durum, çıkış kodu)
- `scraper/launchd-kur.sh` — `kur` / `durum` / `tetikle`
- `dashboard/src/lib/hasat-durum.ts` + `hasat-durum.test.ts` (10 test)
- `dashboard/src/app/api/admin/hasat-durum/route.ts`
- `dashboard/src/app/admin/yontem/HasatSagligi.tsx`
- `HASAT-OTOMASYON-TESHIS.md` (bu dosya)

**Değişen**
- `scraper/com.terralot.sourcing.plist` — gerçek projeye bağlandı, ayna çıkarıldı, düşük öncelik
- `scraper/run-all.sh` — gerçek çıkış kodu, başarısız adım sayacı, nonzero exit, adım TSV'si
- `scraper/terralot-runner.sh` — EMEKLİ başlığı eklendi (silinmedi)
- `scraper/.gitignore` — kanonik plist artık izleniyor; `.hasat.lock` / `.hasat-durum.json` yok sayılıyor
- `dashboard/src/app/admin/yontem/page.tsx`, `admin/scraper/page.tsx` — sağlık kartı
- `dashboard/src/app/api/admin/rakip-radar/route.ts` — ölü ayna `status.json` yerine yeni durum dosyası

**Sistem**
- `~/Library/LaunchAgents/com.terralot.sourcing.plist` değiştirildi (yedek: `yedek/`)
- `npx puppeteer browsers install chrome` — 4 bozuk betik onarıldı
- Teşhis için kurulan geçici `com.terralot.tcctest` görevi **kaldırıldı**
- Bu projeyle ilgisiz launchd görevlerine **dokunulmadı**
