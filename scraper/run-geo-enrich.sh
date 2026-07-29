#!/bin/bash
# geo-enrich'i bitene kadar diri tutar. Script resume-güvenli (geo_enriched_at IS NULL),
# o yüzden çökerse kaldığı yerden devam eder. caffeinate = tarama sırasında Mac uyumasın.
cd "$(dirname "$0")" || exit 1

for i in $(seq 1 40); do
  echo "=== deneme $i · $(date '+%H:%M:%S') ==="
  caffeinate -i node geo-enrich-offmarket.mjs && { echo "=== BITTI (deneme $i) ==="; exit 0; }
  echo "=== çöktü, 30sn sonra devam ==="
  sleep 30
done

echo "=== 40 deneme doldu, durdum ==="
exit 1
