#!/usr/bin/env bash
# Terralot sourcing pipeline — runs every scraper in order, logs each step,
# and keeps going if one fails. Designed to be driven by launchd/cron.
#
#   ./run-all.sh                 # full run
#   SKIP_ZILLOW=1 ./run-all.sh   # skip the (paid) RapidAPI Zillow crawl
#   SKIP_TAX=1 ./run-all.sh      # skip the live county tax-roll crawls
#
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p logs
TS="$(date +%Y%m%d_%H%M%S)"
LOG="logs/run_${TS}.log"

# Başarısız adım sayacı. Boru hattı bir adım patlasa da DEVAM eder (bir kaynağın
# ölmesi diğerlerini engellememeli) ama script SONUNDA nonzero döner.
BASARISIZ=0
BASARISIZ_ADIMLAR=""
# hasat-runner.mjs bu dosyayı okuyup panele adım adım durum yazar (opsiyonel).
ADIM_SONUC_DOSYASI="${ADIM_SONUC_DOSYASI:-}"

step() {
  local t0 rc sn
  t0=$SECONDS
  echo "[$(date '+%H:%M:%S')] >>> $*" | tee -a "$LOG"
  # ÖNEMLİ: çıkış kodunu HEMEN yakala. Eski sürüm `echo "... exited $?"`
  # yazıyordu; aynı satırdaki $(date ...) komut ikamesi $? değerini ezdiği için
  # her hata "exited 0" görünüyordu — 3,5 hafta boyunca hatalar böyle yutuldu.
  if "$@" >>"$LOG" 2>&1; then
    rc=0
  else
    rc=$?
  fi
  sn=$((SECONDS - t0))
  if [ "$rc" -eq 0 ]; then
    echo "[$(date '+%H:%M:%S')] OK: $* (${sn}sn)" | tee -a "$LOG"
  else
    echo "[$(date '+%H:%M:%S')] HATA: '$*' çıkış kodu $rc (${sn}sn)" | tee -a "$LOG"
    BASARISIZ=$((BASARISIZ + 1))
    # $* (tam komut) — $1 kullanılırsa hepsi "node(çıkış 1)" diye görünür.
    BASARISIZ_ADIMLAR="${BASARISIZ_ADIMLAR:+$BASARISIZ_ADIMLAR, }$* (çıkış $rc)"
  fi
  [ -n "$ADIM_SONUC_DOSYASI" ] && printf '%s\t%s\t%s\n' "$*" "$rc" "$sn" >>"$ADIM_SONUC_DOSYASI"
  return 0
}

echo "==== Sourcing run ${TS} ====" | tee -a "$LOG"

# .env'i BAŞTA yükle: disk bekçisinin Telegram uyarısı gönderebilmesi için
# token'lar daha ilk adımda lazım (eskiden sadece koşu sonunda yükleniyordu).
set -a; [ -f ".env" ] && . "./.env"; set +a

# 0) DİSK BEKÇİSİ — her şeyden önce.
# 2026-07-27: disk dolunca Postgres salt-okunura düştü, sonra hiç açılamadı ve
# proje saatlerce yerde kaldı. Tek bir turun iptal olması, veritabanının komple
# kilitlenmesinden iyidir. Eşik %80 (DISK_WARN_PCT ile değiştirilebilir).
# Atlamak için: SKIP_DISK_GUARD=1 ./run-all.sh
if [ "${SKIP_DISK_GUARD:-0}" != "1" ]; then
  echo "[$(date '+%H:%M:%S')] >>> disk-guard" | tee -a "$LOG"
  GUARD_OUT="$(node disk-guard.mjs 2>&1)"; GUARD_RC=$?
  printf '%s\n' "$GUARD_OUT" | tee -a "$LOG"
  if [ "$GUARD_RC" -eq 0 ]; then
    :
  else
    echo "[$(date '+%H:%M:%S')] ABORT: disk bekçisi turu durdurdu — yukarıya bak." | tee -a "$LOG"
    echo "Log: $LOG"
    exit 1
  fi
fi

# 1) Zillow land crawl (RapidAPI) -> local SQLite
[ "${SKIP_ZILLOW:-0}" = "1" ] || step node scraper.js

# 2) Live county tax-delinquent rolls (Puppeteer) -> local SQLite
if [ "${SKIP_TAX:-0}" != "1" ]; then
  for s in scrape_mvba_live.js scrape_pbfcm_live.js scrape_delinquent_tax_rolls.js; do
    [ -f "$s" ] && step node "$s"
  done
fi

# 3) Push local SQLite -> Supabase (tax_delinquent_properties)
step node migrate_to_supabase.js

# 3b) Nationwide Socrata open-data tax sales -> Supabase (source SOCRATA:*)
step node socrata-harvest.js

# 3b2) GovEase ulusal yaklaşan satış takvimi
step node govease-harvest.js

# 3b3) Drift snapshot (tracked + top deals)
step node snapshot-deals.js

# 3c) Due-diligence enrichment on top deals (road/flood -> final_score)
step node dd-enrich.js

# 3d) FİLTRELİ HASAT — kayıt defterindeki hedef eyaletlerden SÜZGEÇTEN geçen
# boş arsaları offmarket_leads'e UPSERT eder (mektup atılabilir + absentee +
# acre/değer bandı). Eyalet listesi HASAT_EYALETLER ile daraltılabilir.
# Yazma yalnızca ON CONFLICT DO UPDATE; DB 2 GB tavanını aşarsa kendi durur.
step node filtreli-hasat.mjs ${HASAT_EYALETLER:-}

# 4) Competitor retail listings -> Supabase (competitor_listings)
step node competitor-scraper.js

# 4b) Rakip radar: ham snapshot'ları istihbarata çevir (DOM, fiyat değişimi,
# kaybolma=satış şüphesi, county emilim oranı) -> competitor_intel.
# Scraper'ın HEMEN ardından koşmalı: o günkü snapshot'ı da hesaba katsın.
step node rakip-radar.mjs

echo "==== done ${TS} ====" | tee -a "$LOG"
echo "Log: $LOG"

# 5) Heartbeat (dead-man's switch): koşu bittiğinde Telegram bildirimi gönder.
# Token'lar boşsa sessizce atlar. Bu, run-all BAŞLADIKTAN sonraki hataları yakalar;
# launchd'nin script'i hiç çalıştıramaması (TCC/Desktop) ayrı sorun — projeyi taşı.
set -a; [ -f ".env" ] && . "./.env"; set +a
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  WARNS=$(grep -c "WARN" "$LOG" 2>/dev/null || echo 0)
  curl -s -m 15 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=🐺 Cerberus koşusu bitti ${TS} · ${WARNS} uyarı · ${LOG}" >/dev/null 2>&1 || true
fi

# 6) Per-source freshness/staleness check (kaynak bazlı bayatlık + satır düşüşü).
# Supabase'den kaynak başına son tarih + satır sayısını çeker, önceki snapshot ile
# kıyaslar; sorun varsa (token varsa) Telegram'a "⚠ STALE/DROP" yollar. Token boşsa
# stdout'a yazar. Tablo/kolon eksikse o kaynağı atlar, koşuyu DÜŞÜRMEZ.
step node freshness-check.mjs

# ── ÇIKIŞ KODU ───────────────────────────────────────────────────────────────
# Adımlar "devam et" mantığıyla koşar ama sonuç GİZLENMEZ: bir tanesi bile
# patladıysa nonzero döneriz. hasat-runner.mjs bunu görüp durum dosyasına
# "BAŞARISIZ" yazar, launchd de görevi hatalı sayar.
if [ "$BASARISIZ" -gt 0 ]; then
  echo "[$(date '+%H:%M:%S')] SONUÇ: ${BASARISIZ} adım başarısız → ${BASARISIZ_ADIMLAR}" | tee -a "$LOG"
  exit 1
fi
echo "[$(date '+%H:%M:%S')] SONUÇ: tüm adımlar başarılı." | tee -a "$LOG"
exit 0
