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

step() {
  echo "[$(date '+%H:%M:%S')] >>> $*" | tee -a "$LOG"
  if "$@" >>"$LOG" 2>&1; then
    echo "[$(date '+%H:%M:%S')] OK: $*" | tee -a "$LOG"
  else
    echo "[$(date '+%H:%M:%S')] WARN: '$*' exited $?" | tee -a "$LOG"
  fi
}

echo "==== Sourcing run ${TS} ====" | tee -a "$LOG"

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

# 4) Competitor retail listings -> Supabase (competitor_listings)
step node competitor-scraper.js

echo "==== done ${TS} ====" | tee -a "$LOG"
echo "Log: $LOG"
