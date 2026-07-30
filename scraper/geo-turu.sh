#!/usr/bin/env bash
# GEO DOĞRULAMA TURU — parça parça, RESUME edilebilir, her partide ara commit.
#
# Neden döngü: Overpass ücretsiz aynası saatler süren tek bir koşuda 429/504'e
# giriyor ve tur boşa gidiyordu. Burada her parti KENDİ süreci; kesilse bile
# `geo_enriched_at is null` + kalıcı hücre önbelleği sayesinde sonraki parti
# kaldığı yerden devam eder. Aynalar YAKILMAZ: soğutma geo-enrich içinde.
#
#   ./geo-turu.sh              # süresiz (elle durdurulana kadar)
#   PARTI=8 ./geo-turu.sh      # 8 parti sonra dur
#
# Her partide: geo-enrich (3e) → grade-offmarket (3f) → commit.
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p logs
PARTI="${PARTI:-999}"
GEO_TOP="${GEO_TOP:-60000}"
DURUM="logs/geo-turu-durum.txt"

for ((i=1; i<=PARTI; i++)); do
  TS="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$TS] parti $i başlıyor (GEO_TOP=$GEO_TOP)" | tee -a "$DURUM"

  GEO_TOP="$GEO_TOP" node geo-enrich-offmarket.mjs >>"logs/geo-turu-$i.log" 2>&1
  RC=$?
  SON="$(grep -E '^bitti:' "logs/geo-turu-$i.log" | tail -1)"
  echo "[$(date '+%H:%M:%S')] parti $i geo çıkış=$RC · $SON" | tee -a "$DURUM"

  # Doğrulanan kayıtlar A+/A havuzuna GİREBİLSİN diye notları tazele (3f).
  node grade-offmarket.mjs >>"logs/geo-turu-$i.log" 2>&1
  echo "[$(date '+%H:%M:%S')] parti $i notlandırma bitti" | tee -a "$DURUM"

  # Doğrulanan / deal sayısını deftere yaz — kesilirse nerede kaldığı görünsün.
  node geo-durum.mjs >>"$DURUM" 2>&1

  cd ..
  git add -A scraper/logs scraper/data >/dev/null 2>&1
  git commit -q -m "geo: doğrulama partisi $i tamamlandı (resume edilebilir)" >/dev/null 2>&1 || true
  cd scraper

  # Ayna nefes alsın.
  sleep 20
done
echo "[$(date '+%H:%M:%S')] geo turu bitti ($PARTI parti)" | tee -a "$DURUM"
