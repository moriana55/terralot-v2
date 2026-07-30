#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HEDEFLİ GEO TURU — "GİZLİ A HAVUZU"
#
# Skoru kendi eyaletindeki en düşük A skorunu ZATEN aşan, ama yalnız OSM geo
# taraması yapılmadığı için B tavanına takılan kayıtları tarar (2026-07-30
# kalibrasyonunda 12.083 adet; tam kuyruğun %1,5'i). Getirisi en yüksek küme:
# tek eksiği doğrulama olan lead'ler. Tüm 787K kuyruğu KOŞTURMAZ.
#
#   ./geo-turu-gizli-a.sh                 # havuz boşalana kadar
#   PARTI=3 PARTI_BOY=1000 ./geo-turu-gizli-a.sh
#
# SAĞLIK KAPISI: her partiden sonra "yol bulma oranı" ölçülür. 2026-07-29'daki
# `out center bb` hatasında bu oran %0'dı (99.309 parsel yanlışlıkla F oldu).
# Sağlıklı turlarda ~%88+. Oran YOL_ESIK altına düşerse tur DURUR — bozuk
# veriyle 12 bin kaydı damgalamaktan iyidir.
#
# RESUME: her parti kendi süreci; `geo_enriched_at is null` + kalıcı hücre
# önbelleği sayesinde kesilse bile aynı komut kaldığı yerden devam eder.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p logs
PARTI="${PARTI:-40}"
PARTI_BOY="${PARTI_BOY:-1500}"
YOL_ESIK="${YOL_ESIK:-20}"
DURUM="logs/gizli-a-durum.txt"

kalan() {
  node -e '
    import("pg").then(async ({default: pg}) => {
      const { dbUrl } = await import("./grade-offmarket.mjs");
      const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
      await c.connect();
      const { rows: [r] } = await c.query(`
        with a as (select state, min(grade_score) a_min from offmarket_leads
                    where grade in (\x27A\x27,\x27A+\x27) group by 1)
        select count(*)::int n from offmarket_leads o join a on a.state = o.state
         where o.grade = \x27B\x27 and o.geo_enriched_at is null and o.lat is not null
           and o.grade_score >= a.a_min`);
      console.log(r.n); await c.end();
    }).catch(() => { console.log("-1"); });'
}

# Son partide taranan kayıtların yol bulma oranı (tam sayı, %).
yol_orani() {
  node -e '
    import("pg").then(async ({default: pg}) => {
      const { dbUrl } = await import("./grade-offmarket.mjs");
      const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
      await c.connect();
      const { rows: [r] } = await c.query(`
        select count(*)::int n, count(*) filter (where dist_road_m >= 0)::int yol
          from offmarket_leads
         where geo_enriched_at > now() - interval \x2730 minutes\x27`);
      console.log(r.n > 0 ? Math.round((100 * r.yol) / r.n) : -1); await c.end();
    }).catch(() => { console.log("-1"); });'
}

echo "[$(date '+%F %T')] GİZLİ A turu başlıyor · havuzda $(kalan) kayıt · parti boyu $PARTI_BOY" | tee -a "$DURUM"

for ((i=1; i<=PARTI; i++)); do
  KALAN="$(kalan)"
  if [ "$KALAN" = "0" ]; then
    echo "[$(date '+%T')] havuz boşaldı — tur tamamlandı" | tee -a "$DURUM"
    break
  fi
  echo "[$(date '+%T')] parti $i · havuzda kalan $KALAN" | tee -a "$DURUM"

  GEO_GIZLI_A=1 GEO_TOP="$PARTI_BOY" node geo-enrich-offmarket.mjs \
    >>"logs/gizli-a-$i.log" 2>&1
  RC=$?
  SON="$(grep -E '^bitti:' "logs/gizli-a-$i.log" | tail -1)"
  echo "[$(date '+%T')] parti $i geo çıkış=$RC · ${SON:-(özet yok)}" | tee -a "$DURUM"

  ORAN="$(yol_orani)"
  echo "[$(date '+%T')] parti $i yol bulma oranı: %$ORAN (eşik %$YOL_ESIK)" | tee -a "$DURUM"
  if [ "$ORAN" != "-1" ] && [ "$ORAN" -lt "$YOL_ESIK" ]; then
    echo "[$(date '+%T')] ⛔ DURDURULDU — yol bulma oranı eşiğin altında, tur BOZUK olabilir." | tee -a "$DURUM"
    echo "   Kontrol: parseDistances/elMerkez + superSorgu çıktısı (bkz. NOT-MOTORU-KALIBRASYON.md)" | tee -a "$DURUM"
    exit 2
  fi

  # Ayna nefes alsın (429 yeme).
  sleep 15
done

echo "[$(date '+%T')] notlandırma (grade-offmarket)" | tee -a "$DURUM"
node grade-offmarket.mjs >>"logs/gizli-a-grade.log" 2>&1
node geo-durum.mjs >>"$DURUM" 2>&1
echo "[$(date '+%F %T')] GİZLİ A turu bitti" | tee -a "$DURUM"
