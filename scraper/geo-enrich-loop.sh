#!/bin/bash
# Geo-enrich'i çökerse otomatik yeniden başlatır (resume güvenli: geo_enriched_at IS NULL).
cd "$(dirname "$0")"
for i in $(seq 1 50); do
  echo "=== deneme $i $(date) ===" >> geo-enrich.log
  node geo-enrich-offmarket.mjs >> geo-enrich.log 2>&1
  code=$?
  [ $code -eq 0 ] && { echo "=== bitti (exit 0) ===" >> geo-enrich.log; break; }
  echo "=== çöktü (exit $code), 30sn sonra tekrar ===" >> geo-enrich.log
  sleep 30
done
