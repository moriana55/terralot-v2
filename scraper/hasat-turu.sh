#!/usr/bin/env bash
# Eyalet eyalet filtreli hasat + her eyalet bitince ARA COMMIT.
# Tur yarıda kalırsa ilerleme kaybolmasın diye bölünmüştür.
#   ./hasat-turu.sh MS WV MT ...
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p logs
for EY in "$@"; do
  echo "=== $EY ==="
  node filtreli-hasat.mjs --kapsam "$EY" 2>&1 | tee "logs/tur-$EY.log"
  node birikim-guncelle.mjs >/dev/null 2>&1
  cd ..
  git add -A scraper/logs dashboard/public/hasat-birikim.json >/dev/null 2>&1
  git commit -q -m "hasat: $EY turu (gevşetilmiş süzgeç) tamamlandı" >/dev/null 2>&1 || true
  cd scraper
done
echo "=== TUR BİTTİ ==="
