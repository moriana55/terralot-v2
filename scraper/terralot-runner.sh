#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# TERRALOT RUNNER — launchd'nin Desktop TCC engelini aşan koşucu.
#
# NEDEN BURADA: macOS TCC, launchd'nin başlattığı bash'in ~/Desktop altındaki
# DOSYALARI OKUMASINI engelliyor (script Desktop dışında olsa bile — test
# edildi, 2026-07-04: ls çalışıyor, read "Operation not permitted"). Bu yüzden
# scraper'ın TAM KOPYASI bu klasörde yaşar; Supabase'e ağ üzerinden yazar,
# Desktop'a hiç dokunmadan çalışır.
#
# SENKRON: Bu script her koşumda Desktop'taki kaynak koddan rsync dener.
# launchd altında TCC yüzünden BAŞARISIZ olur (normal, atlanır); Yiğit/Claude
# terminalden `bash run.sh sync` çalıştırınca senkron olur. Scraper kodu
# değiştiyse bunu elle koşmayı unutma.
#
# Akış: [sync dene] → run-all.sh (SKIP_ZILLOW=1) → rakip-radar-refresh →
#       status.json güncelle → .freshness-state.json'ı Desktop'a geri kopyala
#       (best-effort).
#
# SMOKE=1: scraper'ları KOŞMADAN ortamı doğrular (launchd testi için).
# ─────────────────────────────────────────────────────────────────────────────
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
BASE="$(cd "$(dirname "$0")" && pwd)"
SRC_SCRAPER="/Users/yigiterturk/Desktop/Aktif Projeler/terralot-v2/scraper"
SRC_DASH="/Users/yigiterturk/Desktop/Aktif Projeler/terralot-v2/dashboard"
STATUS="$BASE/status.json"
mkdir -p "$BASE/logs"
TS="$(date +%Y%m%d_%H%M%S)"
LOG="$BASE/logs/run_${TS}.log"
exec >>"$LOG" 2>&1

echo "==== terralot-runner ${TS} (smoke=${SMOKE:-0}) ===="

# ── 0) Kaynaktan senkron (interaktif terminalde çalışır, launchd'de TCC'ye takılır)
sync_from_desktop() {
  if rsync -a --delete --exclude 'logs/' --exclude 'downloads/' --exclude 'node_modules/' \
      "$SRC_SCRAPER/" "$BASE/scraper/" 2>/dev/null; then
    # node_modules'ü ayrı, silmeden senkronla (mirror'da kurulu kalsın)
    rsync -a "$SRC_SCRAPER/node_modules/" "$BASE/scraper/node_modules/" 2>/dev/null || true
    cp "$SRC_DASH/scripts/rakip-radar-refresh.mjs" "$BASE/dashboard/scripts/" 2>/dev/null || true
    cp "$SRC_DASH/src/lib/rakip-radar-store.ts" "$SRC_DASH/src/lib/rakip-radar.ts" "$BASE/dashboard/src/lib/" 2>/dev/null || true
    cp "$SRC_DASH/.env.local" "$BASE/dashboard/.env.local" 2>/dev/null || true
    # run.sh'in kendisi (kanonik kopya repoda: scraper/terralot-runner.sh).
    # mv ile atomik değiştir — koşan script'in inode'u bozulmasın.
    if [ -f "$BASE/scraper/terralot-runner.sh" ]; then
      cp "$BASE/scraper/terralot-runner.sh" "$BASE/.run.sh.new" && mv "$BASE/.run.sh.new" "$BASE/run.sh" && chmod +x "$BASE/run.sh"
    fi
    echo "[sync] Desktop kaynağından senkronlandı."
  else
    echo "[sync] Desktop okunamadı (TCC — launchd altında normal), mevcut kopyayla devam."
  fi
}
sync_from_desktop

if [ "${1:-}" = "sync" ]; then
  echo "[sync] sadece senkron istendi, çıkılıyor."
  exit 0
fi

FAIL=0
ERRMSG=""

if [ "${SMOKE:-0}" = "1" ]; then
  # Ortam doğrulama: node var mı, env var mı, Supabase'e erişim var mı?
  # (cd şart: node -e require'ları cwd'nin node_modules'ünden çözer)
  (cd "$BASE/scraper" && node -e '
    require("dotenv").config();
    const { createClient } = require("@supabase/supabase-js");
    const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    s.from("competitor_listings").select("*", { count: "exact", head: true }).then(({ count, error }) => {
      if (error) { console.error("smoke FAIL:", error.message); process.exit(1); }
      console.log("smoke OK — competitor_listings count:", count);
    });
  ') || { FAIL=1; ERRMSG="smoke test başarısız"; }
else
  # ── 1) Ana sourcing pipeline (kendi klasörüne cd'ler, logları kendi içinde)
  if ! SKIP_ZILLOW=1 bash "$BASE/scraper/run-all.sh"; then
    FAIL=1; ERRMSG="run-all.sh başarısız"
  fi
  # ── 2) Rakip Radar günlük snapshot + diff
  if ! node --env-file="$BASE/dashboard/.env.local" "$BASE/dashboard/scripts/rakip-radar-refresh.mjs"; then
    FAIL=1; ERRMSG="${ERRMSG:+$ERRMSG; }rakip-radar-refresh başarısız"
  fi
fi

# ── 3) status.json güncelle (üst üste başarısızlık sayacı — dashboard okur)
node -e '
  const fs = require("fs");
  const f = process.argv[1];
  const fail = process.argv[2] === "1";
  const err = process.argv[3] || null;
  let s = {};
  try { s = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
  const now = new Date().toISOString();
  s.lastRunAt = now;
  if (fail) {
    s.consecutiveFailures = (s.consecutiveFailures || 0) + 1;
    s.lastError = err;
  } else {
    s.consecutiveFailures = 0;
    s.lastSuccessAt = now;
    s.lastError = null;
  }
  fs.writeFileSync(f, JSON.stringify(s, null, 2));
  console.log("[status]", JSON.stringify(s));
' "$STATUS" "$FAIL" "$ERRMSG"

# ── 4) freshness state'i Desktop projesine geri kopyala (launchd'de TCC'ye
#      takılır — sorun değil, dashboard tazeliği zaten Supabase'den okur)
cp "$BASE/scraper/.freshness-state.json" "$SRC_SCRAPER/.freshness-state.json" 2>/dev/null \
  && echo "[state] Desktop'a kopyalandı." \
  || echo "[state] Desktop'a kopyalanamadı (TCC — normal)."

echo "==== bitti ${TS} fail=${FAIL} ===="
exit "$FAIL"
