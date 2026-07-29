#!/bin/bash
# geo-enrich bitene kadar bekler, BİTTİĞİNİ doğrular, sonra not motorunu çalıştırır.
# "bitti:" satırı script'in kendi başarı çıktısı — sadece kuyruk tükenince yazılır.
# Sadece süreç yokluğuna bakmak yetmez: sarmalayıcı restart aralarında da süreç yok.
cd "$(dirname "$0")" || exit 1

for i in $(seq 1 288); do            # 288 × 5dk = 24 saat tavan
  if grep -q "^bitti:" geo-enrich.log && ! pgrep -f geo-enrich-offmarket >/dev/null; then
    echo "=== GEO BITTI $(date '+%H:%M:%S') — not motoru basliyor ==="
    caffeinate -i node grade-offmarket.mjs 2>&1 | tee grade-final.log
    echo "=== NOT MOTORU BITTI $(date '+%H:%M:%S') ==="
    exit 0
  fi
  sleep 300
done

echo "=== 24 saat doldu, geo hala bitmedi — nobetci cikiyor ==="
exit 1
