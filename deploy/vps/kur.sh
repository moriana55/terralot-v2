#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# kur.sh — VegaLand hasat + geo işlerini VPS'e TEK KOMUTLA kurar.
#
#   sudo bash /opt/vegaland/deploy/vps/kur.sh              # kur / yenile
#   sudo bash /opt/vegaland/deploy/vps/kur.sh dogrula      # kurmadan sadece test et
#   sudo bash /opt/vegaland/deploy/vps/kur.sh kaldir       # geri al (birimleri sök)
#   sudo bash /opt/vegaland/deploy/vps/kur.sh durum        # ne koşuyor
#
# TASARIM KARARLARI
#   • Depo KLONLAMAZ. Uzak git deposu yok; dosyalar `gonder.sh` ile rsync'lenir.
#     Bu betik BULUNDUĞU yeri kök kabul eder (…/deploy/vps/kur.sh → kök = …).
#   • IDEMPOTENT. İkinci, üçüncü kez koşturmak bozmaz: birimler üzerine yazılır,
#     var olan .env dosyalarına DOKUNULMAZ, npm ci yalnız gerektiğinde koşar.
#   • SIR GÖMMEZ. Hiçbir anahtar bu dosyada yok. Eksik .env varsa `.env.ornek`
#     bölünerek boş iskelet yazılır ve betik DURUR — sen doldurursun.
#   • KENDİNİ TEST EDER. Sonunda: node sürümü, DB okuma, kaç Overpass aynası
#     açık (asıl merak edilen bu), küçük bir geo partisi + yol bulma oranı.
#
# ÇIKIŞ KODLARI: 0 tamam · 1 doğrulama hatası · 2 kullanım · 3 eksik ön koşul
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BURADA="$(cd "$(dirname "$0")" && pwd)"
KOK="$(cd "$BURADA/../.." && pwd)"
KOMUT="${1:-kur}"
BIRIM_DIZIN=/etc/systemd/system
# Servisler bu kullanıcı olarak koşar. root DEĞİL: hasat/geo internete çıkan
# üçüncü parti kodu koşturuyor, root'a gerek yok.
KULLANICI="${VEGALAND_KULLANICI:-$(stat -c '%U' "$KOK" 2>/dev/null || echo root)}"
# Kurulum sonu geo dumanı testi (küçük gerçek parti). 0 = atla.
KUR_GEO_SMOKE="${KUR_GEO_SMOKE:-1}"
GEO_SMOKE_BOY="${GEO_SMOKE_BOY:-25}"

kirmizi() { printf '\033[31m%s\033[0m\n' "$*"; }
yesil()   { printf '\033[32m%s\033[0m\n' "$*"; }
sari()    { printf '\033[33m%s\033[0m\n' "$*"; }
baslik()  { printf '\n\033[1m── %s\033[0m\n' "$*"; }
hata()    { kirmizi "HATA: $*" >&2; }

# Komutu SERVİS KULLANICISI olarak, scraper klasöründe koştur.
# Neden: root'un yazdığı log/önbellek dosyaları servis kullanıcısına kapalı kalır
# ve servis sonradan "permission denied" ile patlar. Testler de aynı kullanıcı
# olarak koşmalı, yoksa "kurulumda geçti, servis olarak patladı" durumu doğar.
# Zaten o kullanıcıysak (dogrula modu, sudo'suz) su'ya hiç gerek yok.
kullanici_kos() {
  if [ "$(id -un)" = "$KULLANICI" ]; then
    ( cd "$KOK/scraper" && eval "$1" )
  else
    su -s /bin/bash "$KULLANICI" -c "cd '$KOK/scraper' && $1"
  fi
}

# ═════════════════════════════════════════════════════════════════════════════
# 0) ÖN KOŞULLAR
# ═════════════════════════════════════════════════════════════════════════════
on_kosullar() {
  baslik "Ön koşullar"

  # ── İşletim sistemi: Ubuntu/Debian doğrulaması (varsayım DEĞİL, kontrol) ──
  if [ ! -r /etc/os-release ]; then
    hata "/etc/os-release okunamıyor. Bu betik Ubuntu/Debian için yazıldı."
    exit 3
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  local aile="${ID:-} ${ID_LIKE:-}"
  case "$aile" in
    *debian*|*ubuntu*) yesil "  ✔ işletim sistemi: ${PRETTY_NAME:-$ID}" ;;
    *)
      hata "desteklenmeyen dağıtım: ${PRETTY_NAME:-$ID}"
      echo "  Bu betik apt + systemd varsayar (Ubuntu 22.04/24.04 veya Debian 12)." >&2
      echo "  Başka dağıtımda: paket kurulumlarını elle yap, sonra 'dogrula' ile test et." >&2
      exit 3
      ;;
  esac

  if ! command -v systemctl >/dev/null 2>&1; then
    hata "systemd (systemctl) yok. Bu paket systemd timer/service kullanır."
    exit 3
  fi
  yesil "  ✔ systemd var"

  if [ "$KOMUT" != "dogrula" ] && [ "$(id -u)" -ne 0 ]; then
    hata "kurulum için root gerekiyor (systemd birimleri /etc altına yazılır)."
    echo "  Şöyle koştur:  sudo bash $BURADA/kur.sh" >&2
    exit 3
  fi

  # ── Proje dosyaları geldi mi? ──
  local eksik=0
  for d in "$KOK/scraper/geo-enrich-offmarket.mjs" \
           "$KOK/scraper/hasat-runner.mjs" \
           "$KOK/scraper/grade-offmarket.mjs" \
           "$KOK/scraper/package.json" \
           "$KOK/dashboard/src/lib/county-registry.ts" \
           "$KOK/dashboard/src/lib/eleme-hunisi.ts"
  do
    if [ ! -f "$d" ]; then kirmizi "  ✘ eksik: ${d#$KOK/}"; eksik=1; fi
  done
  if [ "$eksik" -eq 1 ]; then
    hata "proje dosyaları tam gelmemiş. Mac'ten önce şunu koştur:"
    echo "  ./deploy/vps/gonder.sh <kullanici>@<ip> /opt/vegaland" >&2
    exit 3
  fi
  yesil "  ✔ proje dosyaları yerinde ($KOK)"
  yesil "  ✔ servis kullanıcısı: $KULLANICI"
}

# ═════════════════════════════════════════════════════════════════════════════
# 1) NODE
# ═════════════════════════════════════════════════════════════════════════════
# Neden 22+: scraper/filtreli-hasat.mjs, dashboard/src/lib/*.ts dosyalarını
# DOĞRUDAN `import()` ediyor. Node'un tip-soyma (type stripping) yeteneği
# gerekiyor; bu 22.18+ / 23+ sürümlerinde varsayılan açık. 24 LTS öneriliyor.
NODE_MIN=22
node_kur() {
  baslik "Node.js"
  local surum=0
  if command -v node >/dev/null 2>&1; then
    surum="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
    echo "  kurulu: $(node -v)"
  else
    echo "  node kurulu değil"
  fi

  if [ "$surum" -ge "$NODE_MIN" ] 2>/dev/null; then
    yesil "  ✔ Node $surum ≥ $NODE_MIN — kuruluma gerek yok"
  else
    if [ "$KOMUT" = "dogrula" ]; then
      hata "Node $NODE_MIN+ gerekiyor (kurulu: ${surum:-yok}). 'kur' ile kurulur."
      exit 1
    fi
    sari "  Node 24 LTS kuruluyor (NodeSource)…"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates gnupg >/dev/null
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
    command -v node >/dev/null 2>&1 || { hata "Node kurulumu başarısız."; exit 3; }
    yesil "  ✔ kuruldu: $(node -v)"
  fi

  # TS import'u gerçekten çalışıyor mu? Sürüm numarasına GÜVENMEK yetmez —
  # tip-soyma bazı sürümlerde bayrak arkasında. Burada CANLI test edilir.
  if node -e '
      import("'"$KOK"'/dashboard/src/lib/county-registry.ts")
        .then((m) => { if (!m.COUNTY_REGISTRY) throw new Error("COUNTY_REGISTRY yok"); })
        .catch((e) => { console.error(e.message); process.exit(1); })' >/dev/null 2>&1
  then
    yesil "  ✔ TypeScript import (tip soyma) çalışıyor — filtreli-hasat koşabilir"
  else
    sari "  ⚠ Node, .ts dosyasını import EDEMİYOR."
    sari "    Sonuç: geo turu ÇALIŞIR, ama filtreli-hasat.mjs (yeni parsel hasadı) patlar."
    sari "    Çözüm: Node 24'e yükselt → curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash - && sudo apt install -y nodejs"
  fi

  # Diğer araçlar
  local gerek=()
  command -v flock  >/dev/null 2>&1 || gerek+=(util-linux)
  command -v rsync  >/dev/null 2>&1 || gerek+=(rsync)
  command -v logrotate >/dev/null 2>&1 || gerek+=(logrotate)
  if [ "${#gerek[@]}" -gt 0 ] && [ "$KOMUT" != "dogrula" ]; then
    sari "  eksik araçlar kuruluyor: ${gerek[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${gerek[@]}" >/dev/null || true
  fi
  command -v flock >/dev/null 2>&1 && yesil "  ✔ flock var (kilit mekanizması)" || sari "  ⚠ flock yok — betik PID'li yedek kilide düşer"
}

# ═════════════════════════════════════════════════════════════════════════════
# 2) ORTAM DEĞİŞKENLERİ (SIR GÖMMEZ — boş iskelet yazar, sen doldurursun)
# ═════════════════════════════════════════════════════════════════════════════
# Ayrıştırma: .env.ornek içindeki "### ===== <hedef> =====" bölümleri.
env_bolum_yaz() {
  local bolum="$1" hedef="$2"
  awk -v b="$bolum" '
    /^### ===== / { icinde = ($0 ~ b) ? 1 : 0; next }
    icinde { print }
  ' "$BURADA/.env.ornek" > "$hedef"
}

env_hazirla() {
  baslik "Ortam değişkenleri (.env)"
  local dur=0

  # dashboard/.env.local — DATABASE_URL burada olmak ZORUNDA.
  # (scraper/grade-offmarket.mjs → dbUrl() bu dosyayı okur.)
  local d="$KOK/dashboard/.env.local"
  if [ -f "$d" ]; then
    if grep -qE '^DATABASE_URL=.+' "$d"; then
      yesil "  ✔ dashboard/.env.local var ve DATABASE_URL dolu"
    else
      kirmizi "  ✘ dashboard/.env.local var ama DATABASE_URL BOŞ"
      dur=1
    fi
  else
    mkdir -p "$KOK/dashboard"
    env_bolum_yaz "dashboard/.env.local" "$d"
    sari "  → boş iskelet YAZILDI: dashboard/.env.local"
    dur=1
  fi

  # scraper/.env — opsiyonel anahtarlar (Telegram vs.), yokluğu turu durdurmaz.
  local s="$KOK/scraper/.env"
  if [ -f "$s" ]; then
    yesil "  ✔ scraper/.env var"
    if ! grep -qE '^TELEGRAM_BOT_TOKEN=.+' "$s"; then
      sari "  ⚠ TELEGRAM_BOT_TOKEN boş → 7/24 koşan turun hataları kimseye BİLDİRİLMEZ."
      sari "    Doldurmak için: @BotFather → /newbot (bkz. RUNBOOK 'Sırlar')"
    fi
  else
    env_bolum_yaz "scraper/.env" "$s"
    sari "  → boş iskelet YAZILDI: scraper/.env (Telegram/Census — opsiyonel)"
  fi

  chmod 600 "$d" "$s" 2>/dev/null || true
  chown "$KULLANICI":"$KULLANICI" "$d" "$s" 2>/dev/null || true

  if [ "$dur" -eq 1 ]; then
    echo ""
    kirmizi "════════════════════════════════════════════════════════════════"
    kirmizi " DUR: DATABASE_URL yok. Kurulum devam ETMEDİ."
    kirmizi "════════════════════════════════════════════════════════════════"
    echo " 1) Şunu düzenle:   nano $d"
    echo " 2) Mac'teki aynı dosyadan DATABASE_URL / DIRECT_URL / SUPABASE_* satırlarını kopyala:"
    echo "      ~/Desktop/Aktif Projeler/terralot-v2/dashboard/.env.local"
    echo " 3) Sonra bu betiği TEKRAR koştur (idempotenttir, bozmaz):"
    echo "      sudo bash $BURADA/kur.sh"
    exit 1
  fi
}

# ═════════════════════════════════════════════════════════════════════════════
# 3) BAĞIMLILIKLAR
# ═════════════════════════════════════════════════════════════════════════════
bagimlilik_kur() {
  baslik "scraper bağımlılıkları"
  cd "$KOK/scraper" || exit 3

  # Puppeteer'in Chromium indirmesini engelle: VPS'te canlı vergi taramaları
  # SKIP_TAX=1 ile atlanıyor, 400 MB Chromium indirmek diski boşuna yer
  # (2026-07-27 disk krizi). Gerekirse: PUPPETEER_SKIP_DOWNLOAD=0 ile yeniden kur.
  export PUPPETEER_SKIP_DOWNLOAD="${PUPPETEER_SKIP_DOWNLOAD:-true}"
  export npm_config_fund=false npm_config_audit=false

  # Idempotent: node_modules varsa ve package.json ondan yeni DEĞİLSE atla.
  if [ -d node_modules ] && [ ! node_modules -ot package.json ]; then
    yesil "  ✔ node_modules güncel — npm atlandı"
  else
    sari "  npm ci koşuyor (Chromium indirmesi kapalı)…"
    NPM_BAYRAK="--omit=dev --no-audit --no-fund"
    if [ -f package-lock.json ]; then
      # npm ci tercih edilir (kilitli sürümler). Kilit dosyası package.json ile
      # uyuşmazsa ci reddeder → install'a düşülür.
      kullanici_kos "PUPPETEER_SKIP_DOWNLOAD=true npm ci $NPM_BAYRAK" \
        || kullanici_kos "PUPPETEER_SKIP_DOWNLOAD=true npm install $NPM_BAYRAK" \
        || { hata "npm kurulumu başarısız."; exit 3; }
    else
      kullanici_kos "PUPPETEER_SKIP_DOWNLOAD=true npm install $NPM_BAYRAK" \
        || { hata "npm kurulumu başarısız."; exit 3; }
    fi
    touch node_modules
    yesil "  ✔ bağımlılıklar kuruldu"
  fi

  # Kritik modüller gerçekten yüklendi mi?
  for m in pg @supabase/supabase-js dotenv; do
    if node -e "require.resolve('$m')" >/dev/null 2>&1; then
      yesil "  ✔ $m"
    else
      kirmizi "  ✘ $m YÜKLENMEDİ — geo/hasat koşamaz"; exit 3
    fi
  done

  # Betiklerin yazacağı klasörler (rsync ile gelmiyorlar: dashboard/src/data
  # bilerek GÖNDERİLMEZ, 190 MB ölü statik JSON).
  install -d -o "$KULLANICI" -g "$KULLANICI" \
    "$KOK/scraper/data" "$KOK/scraper/logs" "$KOK/scraper/logs/hasat" \
    "$KOK/scraper/logs/geo-vps" "$KOK/scraper/downloads" \
    "$KOK/dashboard/src/data" "$KOK/dashboard/public"
  yesil "  ✔ çalışma klasörleri hazır"
}

# ═════════════════════════════════════════════════════════════════════════════
# 4) SYSTEMD BİRİMLERİ + LOG DÖNGÜSÜ
# ═════════════════════════════════════════════════════════════════════════════
birim_yaz() {
  local kaynak="$1" hedef="$2"
  sed -e "s|@KOK@|$KOK|g" \
      -e "s|@KULLANICI@|$KULLANICI|g" \
      -e "s|@NODE@|$(command -v node)|g" \
      -e "s|@NODE_DIZIN@|$(dirname "$(command -v node)")|g" \
      "$kaynak" > "$hedef"
  chmod 644 "$hedef"
}

birimler_kur() {
  baslik "systemd birimleri"
  chmod +x "$BURADA"/*.sh 2>/dev/null || true

  birim_yaz "$BURADA/systemd/vegaland-hasat.service" "$BIRIM_DIZIN/vegaland-hasat.service"
  birim_yaz "$BURADA/systemd/vegaland-hasat.timer"   "$BIRIM_DIZIN/vegaland-hasat.timer"
  birim_yaz "$BURADA/systemd/vegaland-geo.service"   "$BIRIM_DIZIN/vegaland-geo.service"
  yesil "  ✔ birim dosyaları yazıldı → $BIRIM_DIZIN/vegaland-*"

  systemctl daemon-reload
  # enable --now idempotenttir; ikinci koşuda "already enabled" der, bozmaz.
  systemctl enable --now vegaland-hasat.timer >/dev/null 2>&1 && yesil "  ✔ vegaland-hasat.timer etkin (günlük 03:30 UTC)"
  systemctl enable vegaland-geo.service >/dev/null 2>&1
  systemctl restart vegaland-geo.service && yesil "  ✔ vegaland-geo.service koşuyor (sürekli)"

  # ── Log döngüsü ──
  birim_yaz "$BURADA/systemd/vegaland-logrotate.conf" /etc/logrotate.d/vegaland
  if logrotate -d /etc/logrotate.d/vegaland >/dev/null 2>&1; then
    yesil "  ✔ logrotate kuruldu (günlük, 7 kopya, 50 MB tavan)"
  else
    sari "  ⚠ logrotate yapılandırması doğrulanamadı — journald sınırı yine devrede"
  fi

  # journald sınırı: 2026-07-27 disk krizi tekrarlamasın. Toplam 500 MB tavan.
  install -d /etc/systemd/journald.conf.d
  cat > /etc/systemd/journald.conf.d/vegaland.conf <<'EOF'
# VegaLand — journald disk tavanı (disk krizi önlemi, 2026-07-27).
[Journal]
SystemMaxUse=500M
SystemMaxFileSize=50M
MaxRetentionSec=3week
EOF
  systemctl restart systemd-journald >/dev/null 2>&1 || true
  yesil "  ✔ journald tavanı 500 MB"
}

# ═════════════════════════════════════════════════════════════════════════════
# 5) KENDİNİ TEST ET
# ═════════════════════════════════════════════════════════════════════════════
kendini_test() {
  baslik "DOĞRULAMA 1/4 — Veritabanı (SALT OKUMA)"
  DB_OK=1
  # db-test.mjs: tek SELECT + şema kontrolü. Bağlantı dizesini gerçek turların
  # kullandığı yoldan (grade-offmarket.mjs → dbUrl()) okur, ayrı bir yol YAZMAZ.
  if kullanici_kos "node '$BURADA/db-test.mjs'"; then
    yesil "  ✔ DB okunabiliyor"
  else
    kirmizi "  ✘ DB'ye BAĞLANILAMADI."
    echo "    Bak: DATABASE_URL doğru mu, Supabase projesi duruyor mu, VPS IP'si engelli mi." >&2
    DB_OK=0
  fi

  baslik "DOĞRULAMA 2/4 — Overpass aynaları (ASIL MERAK EDİLEN)"
  echo "  Mac'teki referans ölçüm (2026-07-30): 1/7 ayna açık → 3 işçi."
  echo ""
  local ayna_cikis=0
  kullanici_kos "AYNA_TIMEOUT=${AYNA_TIMEOUT:-25000} bash '$BURADA/overpass-test.sh'" || ayna_cikis=$?
  if [ "$ayna_cikis" -eq 0 ]; then
    yesil "  ✔ en az bir ayna açık"
  else
    kirmizi "  ✘ hiçbir ayna açık DEĞİL — bu VPS'ten geo turu koşmaz."
    sari "    Bu durumda VPS'e taşımanın GEO faydası YOK. Sadece 7/24 hasat faydası kalır."
  fi

  baslik "DOĞRULAMA 3/4 — Hasat ortamı (duman testi, veri YAZMAZ)"
  if kullanici_kos "node hasat-runner.mjs --smoke" >/tmp/vegaland-smoke.log 2>&1; then
    yesil "  ✔ hasat-runner --smoke geçti (kilit, log, durum dosyası, Supabase sayımı çalışıyor)"
  else
    kirmizi "  ✘ hasat-runner --smoke BAŞARISIZ. Son satırlar:"
    tail -15 /tmp/vegaland-smoke.log | sed 's/^/      /'
  fi

  baslik "DOĞRULAMA 4/4 — Küçük geo partisi + yol bulma oranı"
  if [ "$KUR_GEO_SMOKE" != "1" ]; then
    sari "  atlandı (KUR_GEO_SMOKE=0)"
  elif [ "${DB_OK:-1}" = "0" ] || [ "$ayna_cikis" -ne 0 ]; then
    sari "  atlandı — DB veya ayna testi geçmedi, anlamlı sonuç vermez."
  else
    echo "  $GEO_SMOKE_BOY kayıtlık gerçek bir parti koşuyor (normal zenginleştirme yazımı)…"
    kullanici_kos "GEO_GIZLI_A=1 GEO_TOP=$GEO_SMOKE_BOY node geo-enrich-offmarket.mjs" \
      >/tmp/vegaland-geo-smoke.log 2>&1 || true
    grep -E '^(canlı ayna|bitti:)' /tmp/vegaland-geo-smoke.log | sed 's/^/      /' || true
    # Yol bulma oranı: sağlıklı turlarda ~%88. %0'a yakınsa kod bozuk demektir
    # (2026-07-29 `out center bb` hatası 99.309 parseli yanlışlıkla F yapmıştı).
    kullanici_kos "GEO_DURUM_PENCERE_DK=15 node geo-durum.mjs" 2>/dev/null | sed 's/^/      /' || true
    yesil "  ✔ parti koştu — yukarıdaki 'yol bulma oranı' %80'in üstündeyse sağlıklı"
    sari "    %20'nin altındaysa: geo servisini DURDUR (systemctl stop vegaland-geo) ve NOT-MOTORU-KALIBRASYON.md'ye bak."
  fi

  baslik "Disk"
  df -h "$KOK" | tail -1 | sed 's/^/  /'
  local dolu; dolu="$(df --output=pcent "$KOK" 2>/dev/null | tail -1 | tr -dc '0-9')"
  if [ -n "$dolu" ] && [ "$dolu" -gt 80 ]; then
    kirmizi "  ⚠ disk %$dolu dolu. 2026-07-27'de disk dolunca Postgres salt-okunura düşmüştü."
  else
    yesil "  ✔ disk kullanımı %${dolu:-?}"
  fi
}

durum_goster() {
  baslik "systemd durumu"
  systemctl list-timers vegaland-hasat.timer --no-pager 2>/dev/null | sed 's/^/  /'
  echo ""
  systemctl status vegaland-geo.service --no-pager -n 8 2>/dev/null | sed 's/^/  /' || echo "  vegaland-geo YÜKLÜ DEĞİL"
  echo ""
  systemctl status vegaland-hasat.service --no-pager -n 5 2>/dev/null | sed 's/^/  /' || true
  baslik "Son hasat durumu"
  cat "$KOK/scraper/.hasat-durum.json" 2>/dev/null | head -20 | sed 's/^/  /' || echo "  henüz koşmadı"
  baslik "Geo turu defteri (son 15 satır)"
  tail -15 "$KOK/scraper/logs/geo-vps/durum.txt" 2>/dev/null | sed 's/^/  /' || echo "  henüz koşmadı"
}

kaldir() {
  baslik "GERİ ALMA — systemd birimleri sökülüyor"
  [ "$(id -u)" -eq 0 ] || { hata "root gerekiyor: sudo bash $BURADA/kur.sh kaldir"; exit 3; }
  systemctl disable --now vegaland-geo.service   2>/dev/null || true
  systemctl disable --now vegaland-hasat.timer   2>/dev/null || true
  systemctl disable --now vegaland-hasat.service 2>/dev/null || true
  rm -f "$BIRIM_DIZIN"/vegaland-hasat.service \
        "$BIRIM_DIZIN"/vegaland-hasat.timer \
        "$BIRIM_DIZIN"/vegaland-geo.service \
        /etc/logrotate.d/vegaland \
        /etc/systemd/journald.conf.d/vegaland.conf
  systemctl daemon-reload
  systemctl reset-failed 2>/dev/null || true
  rm -f "$KOK/scraper/.geo-vps.lock" "$KOK/scraper/.hasat.flock"
  yesil "  ✔ birimler kaldırıldı. Proje dosyaları ve .env DOKUNULMADI ($KOK)."
  echo "  Dosyaları da silmek istersen (VERİTABANINA DOKUNMAZ):  rm -rf $KOK"
}

# ═════════════════════════════════════════════════════════════════════════════
case "$KOMUT" in
  kur)
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  VegaLand VPS kurulumu — hasat (günlük) + geo (sürekli)      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo "kök: $KOK"
    on_kosullar
    node_kur
    env_hazirla
    bagimlilik_kur
    birimler_kur
    kendini_test
    baslik "BİTTİ"
    yesil "Kurulum tamam. Şimdi ne izlenir:"
    echo "  journalctl -u vegaland-geo -f                 # geo turu canlı"
    echo "  journalctl -u vegaland-hasat -n 100           # son hasat turu"
    echo "  tail -f $KOK/scraper/logs/geo-vps/durum.txt   # parti parti defter"
    echo "  sudo bash $BURADA/kur.sh durum                # tek bakışta durum"
    echo ""
    sari "⚠ ÇAKIŞMA: Mac'teki launchd hasat işini (com.terralot.sourcing) KAPAT."
    sari "  Detay: $BURADA/RUNBOOK.md → 'Mac ile çakışma'"
    ;;
  dogrula) on_kosullar; node_kur; kendini_test ;;
  durum)   durum_goster ;;
  kaldir)  kaldir ;;
  *)
    echo "Kullanım: sudo bash kur.sh [kur|dogrula|durum|kaldir]" >&2
    exit 2
    ;;
esac
