#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# launchd-kur.sh — günlük hasat görevini kurar/yeniler.
#
#   bash scraper/launchd-kur.sh          # kur / yenile
#   bash scraper/launchd-kur.sh durum    # görev yüklü mü, son durum ne
#   bash scraper/launchd-kur.sh tetikle  # şimdi elle çalıştır (launchd üzerinden)
#
# NOT: TERMİNALDEN çalıştırılmalı (launchd altından değil) — plist'i kopyalamak
# için Desktop okuma izni gerekir.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
KOK="$(cd "$(dirname "$0")" && pwd)"
ETIKET="com.terralot.sourcing"
HEDEF="$HOME/Library/LaunchAgents/${ETIKET}.plist"
UID_="$(id -u)"

case "${1:-kur}" in
  durum)
    echo "— launchctl —"
    launchctl list | grep "$ETIKET" || echo "  görev YÜKLÜ DEĞİL"
    echo "— plist yolu —"
    /usr/libexec/PlistBuddy -c "Print :ProgramArguments" "$HEDEF" 2>/dev/null || echo "  plist yok"
    echo "— son durum —"
    cat "$KOK/.hasat-durum.json" 2>/dev/null || echo "  henüz koşmadı"
    ;;
  tetikle)
    launchctl kickstart -k "gui/${UID_}/${ETIKET}"
    echo "Tetiklendi. Canlı log:  tail -f \"$KOK/logs/hasat/\"\$(ls -t \"$KOK/logs/hasat\" | head -1)"
    ;;
  kur)
    mkdir -p "$HOME/Library/LaunchAgents" "$KOK/logs/hasat"
    # Yedek: kurulu sürüm varsa proje yedek klasörüne al.
    if [ -f "$HEDEF" ]; then
      mkdir -p "$KOK/../yedek"
      cp "$HEDEF" "$KOK/../yedek/${ETIKET}.plist.yedek-$(date +%Y%m%d_%H%M%S)"
    fi
    cp "$KOK/${ETIKET}.plist" "$HEDEF"
    launchctl bootout "gui/${UID_}/${ETIKET}" 2>/dev/null || true
    launchctl bootstrap "gui/${UID_}" "$HEDEF"
    echo "✓ ${ETIKET} kuruldu → $(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:1' "$HEDEF")"
    launchctl list | grep "$ETIKET" || true
    ;;
  *)
    echo "Kullanım: bash launchd-kur.sh [kur|durum|tetikle]" >&2
    exit 2
    ;;
esac
