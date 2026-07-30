#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# gonder.sh — Mac'ten VPS'e SADECE gereken dosyaları rsync'ler.
#
#   ./deploy/vps/gonder.sh root@2.24.161.97
#   ./deploy/vps/gonder.sh vegaland@2.24.161.97 /opt/vegaland
#   ./deploy/vps/gonder.sh root@2.24.161.97 /opt/vegaland --deneme   # kuru koşu
#
#   Parametreler:  <kullanıcı>@<ip>  [hedef-yol]  [--deneme] [--sil]
#   Varsayılan hedef yol: /opt/vegaland
#   --deneme : hiçbir şey kopyalamaz, ne gideceğini listeler (rsync -n)
#   --sil    : hedefte olup kaynakta olmayan dosyaları siler (rsync --delete).
#              DİKKAT: sunucuda üretilen loglar/önbellek de silinir. Varsayılan KAPALI.
#   SSH_PORT=2222 ./gonder.sh …   # özel port
#
# ── NE GİDER ────────────────────────────────────────────────────────────────
#   scraper/                        hasat + geo betikleri (npm ile ilgisiz dosyalar hariç)
#   dashboard/src/lib/              scraper'ın import ettiği TS modülleri
#     county-registry.ts, eleme-hunisi.ts, county-providers/  ← filtreli-hasat bunları import eder
#   dashboard/scripts/              rakip-radar-refresh.mjs vb. (hasat-runner çağırır)
#   dashboard/package.json          (+ package-lock) sürüm referansı
#   deploy/vps/                     kurulum paketi (kendisi)
#   NOT-MOTORU-KALIBRASYON.md       geo bozulursa bakılacak belge
#
# ── NE GİTMEZ (ve neden) ────────────────────────────────────────────────────
#   node_modules/         → VPS'te npm ci ile kurulur (mimari farkı: arm64 → x86_64)
#   .next/                → panel Vercel'de koşuyor, VPS'te build yok
#   .git/                 → uzak depo yok; sunucuda git geçmişi işe yaramaz
#   dashboard/src/data/   → 190 MB ölü statik JSON; hiçbir hasat/geo betiği OKUMAZ
#   yedek/                → 41 MB döküm
#   .env, .env.local      → SIRLAR. VPS'te ELLE konur (bkz. RUNBOOK 'Sırlar')
#   scraper/logs/, downloads/, *.log, *.csv, *.sqlite  → Mac'in çöpü, 400 MB+
#   scraper/data/         → geo hücre önbelleği; sunucu kendi önbelleğini kurar
#                           (istersen GONDER_ONBELLEK=1 ile gönderilir — geo turu
#                            hızlı başlar, ~5 MB)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HEDEF_SSH="${1:-}"
HEDEF_YOL="${2:-/opt/vegaland}"
shift $(( $# > 2 ? 2 : $# )) || true

if [ -z "$HEDEF_SSH" ] || [ "$HEDEF_SSH" = "-h" ] || [ "$HEDEF_SSH" = "--help" ]; then
  sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
fi
case "$HEDEF_YOL" in
  --*) echo "HATA: hedef yol '--' ile başlayamaz. Kullanım: gonder.sh kullanici@ip [yol] [--deneme]" >&2; exit 2 ;;
esac

KOK="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_PORT="${SSH_PORT:-22}"
BAYRAK=(-az --human-readable --info=stats2 --no-perms --no-owner --no-group --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r)
# EMNİYET AĞI: hasat/geo için gereken hiçbir dosya 2 MB'ı geçmiyor (en büyüğü
# county-registry.ts ~60 KB, package-lock ~90 KB). Bu tavan, klasöre sonradan
# düşen ham dökümlerin (owners.txt 85 MB gibi) sessizce ağa çıkmasını engeller.
# Gerçekten büyük bir dosya göndermek gerekirse: GONDER_MAX=50m ./gonder.sh …
BAYRAK+=(--max-size="${GONDER_MAX:-2m}")
[ -n "${SSH_PORT}" ] && BAYRAK+=(-e "ssh -p $SSH_PORT")

DENEME=0
for a in "$@"; do
  case "$a" in
    --deneme|-n) DENEME=1; BAYRAK+=(-n -v) ;;
    --sil)       BAYRAK+=(--delete) ;;
    *)           echo "bilinmeyen seçenek: $a" >&2; exit 2 ;;
  esac
done

command -v rsync >/dev/null 2>&1 || { echo "HATA: rsync yok." >&2; exit 3; }

# ── Dışlama listesi (tek doğru kaynak) ─────────────────────────────────────
DISLA=(
  # Bağımlılık / build çıktısı — sunucuda üretilir
  --exclude='node_modules/'
  --exclude='.next/'
  --exclude='.turbo/'
  --exclude='dist/'
  --exclude='.cache/'
  # Sürüm kontrolü
  --exclude='.git/'
  --exclude='.gitignore'
  --exclude='.github/'
  --exclude='.claude/'
  # SIRLAR — asla ağdan geçmesin.
  # ⚠ SIRA ÖNEMLİ: rsync'te İLK eşleşen kural kazanır. Şablon (.env.ornek)
  # gitsin diye include, .env* dışlamalarından ÖNCE gelmek ZORUNDA.
  --include='.env.ornek'
  --exclude='.env'
  --exclude='.env.*'
  --exclude='.envrc'
  # Ölü ağırlık
  --exclude='dashboard/src/data/'
  --exclude='yedek/'
  --exclude='screenshots/'
  --exclude='investor-docs/'
  --exclude='stitch_new/'
  --exclude='stitch_usa_land_installment_portal/'
  --exclude='landforever/'
  --exclude='MEKTUP-KAMPANYALARI/'
  # Mac / editör çöpü
  --exclude='.DS_Store'
  --exclude='*.swp'
  # Log ve ara çıktı — sunucu kendi loglarını üretir
  --exclude='logs/'
  --exclude='downloads/'
  --exclude='*.log'
  --exclude='*.csv'
  --exclude='*.xlsx'
  --exclude='*.sqlite'
  --exclude='*.db'
  --exclude='*.pdf'
  --exclude='*.png'
  --exclude='*.jpg'
  --exclude='*.gz'
  --exclude='*.zip'
  --exclude='.hasat.lock'
  --exclude='.geo-vps.lock'
  # Ham veri dökümleri — hasat/geo bunları OKUMAZ, sadece ağı tıkarlar.
  --exclude='owners.txt'          # 85 MB HCAD tapu dökümü (hiçbir betik okumuyor)
  --exclude='lgbs_*.json'         # lgbs-scraper.js çıktısı, yeniden üretilebilir
  --exclude='found_api_*.json'
  --exclude='api_found_*.json'
  --exclude='property_data_*.json'
  # macOS'a özgü otomasyon — VPS'te systemd kullanılıyor
  --exclude='*.plist'
  --exclude='launchd-kur.sh'
)
# Geo hücre önbelleği: varsayılan GİTMEZ (sunucu kendi önbelleğini kurar).
# GONDER_ONBELLEK=1 → gönderilir, geo turu ısınmış başlar (~5 MB).
if [ "${GONDER_ONBELLEK:-0}" != "1" ]; then
  DISLA+=(--exclude='scraper/data/')
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  VegaLand → VPS gönderimi                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "kaynak : $KOK"
echo "hedef  : $HEDEF_SSH:$HEDEF_YOL  (ssh port $SSH_PORT)"
[ "$DENEME" -eq 1 ] && echo "MOD    : KURU KOŞU — hiçbir şey kopyalanmayacak"
echo ""

# Hedef klasörü hazırla (kuru koşuda dokunma).
if [ "$DENEME" -eq 0 ]; then
  ssh -p "$SSH_PORT" "$HEDEF_SSH" "mkdir -p '$HEDEF_YOL'" \
    || { echo "HATA: SSH bağlantısı kurulamadı ($HEDEF_SSH:$SSH_PORT)." >&2; exit 3; }
fi

gonder() {
  local yol="$1"
  if [ ! -e "$KOK/$yol" ]; then echo "  ⊘ atlandı (yok): $yol"; return 0; fi
  echo "── $yol"
  rsync "${BAYRAK[@]}" "${DISLA[@]}" \
    --relative "$KOK/./$yol" "$HEDEF_SSH:$HEDEF_YOL/" | sed 's/^/   /'
}

# ── Gönderilecekler ────────────────────────────────────────────────────────
gonder "scraper"
gonder "dashboard/src/lib"
gonder "dashboard/scripts"
gonder "dashboard/package.json"
gonder "dashboard/package-lock.json"
gonder "deploy/vps"
gonder "NOT-MOTORU-KALIBRASYON.md"
gonder "HASAT-OTOMASYON-TESHIS.md"

if [ "$DENEME" -eq 1 ]; then
  echo ""
  echo "Kuru koşu bitti. Gerçekten göndermek için --deneme'yi kaldır."
  exit 0
fi

# Betikleri çalıştırılabilir yap (rsync --no-perms izinleri taşımıyor).
ssh -p "$SSH_PORT" "$HEDEF_SSH" "chmod +x '$HEDEF_YOL'/deploy/vps/*.sh '$HEDEF_YOL'/scraper/*.sh 2>/dev/null || true"

echo ""
echo "✔ Gönderim tamam."
echo ""
echo "SIRADAKİ ADIMLAR (VPS'te):"
echo "  1) Ayna testi — kurulmadan önce karar noktası:"
echo "     ssh -p $SSH_PORT $HEDEF_SSH 'bash $HEDEF_YOL/deploy/vps/overpass-test.sh'"
echo "  2) Sırları elle koy:"
echo "     ssh -p $SSH_PORT $HEDEF_SSH 'nano $HEDEF_YOL/dashboard/.env.local'   # DATABASE_URL şart"
echo "  3) Kurulum:"
echo "     ssh -p $SSH_PORT $HEDEF_SSH 'sudo bash $HEDEF_YOL/deploy/vps/kur.sh'"
echo ""
echo "Detay: deploy/vps/RUNBOOK.md"
