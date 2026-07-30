#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# geo-turu-vps.sh — SÜREKLİ geo doğrulama turu, systemd altında koşmak için.
#
# Mac'teki scraper/geo-turu-gizli-a.sh ve geo-turu.sh'e DOKUNMADAN yazılmış
# VPS sürümü. Farklar (ve nedenleri):
#
#   • GIT YOK — Mac'teki geo-turu.sh her partide `git commit` atıyor. VPS'te
#     uzak depo yok, dosyalar rsync ile geliyor; commit atmak çalışma kopyasını
#     Mac'ten sapıtır. Burada hiç git çağrısı YOK.
#   • KİLİT (flock) — systemd + elle koşu üst üste binmesin. İkinci süreç
#     sessizce çıkar (exit 0), DB'de mükerrer iş olmaz.
#   • OTOMATİK MOD — önce "gizli A" havuzu (getirisi en yüksek küme: tek eksiği
#     doğrulama olan lead'ler), havuz boşalınca TAM kuyruğa geçer. Sonsuz döner.
#   • SAĞLIK KAPISI — her partide "yol bulma oranı" ölçülür. 2026-07-29'daki
#     `out center bb` hatasında bu oran %0'dı ve 99.309 parsel yanlışlıkla F
#     oldu. Oran eşiğin altına düşerse tur ÇIKIŞ 2 ile durur; systemd birimi
#     `RestartPreventExitStatus=2` ile bunu YENİDEN BAŞLATMAZ (bozuk veriyle
#     kayıt damgalamak, durmaktan kötüdür).
#   • LOG DÖNGÜSÜ — tek dosyaya değil, parti başına dosyaya yazar ve eski
#     logları budar (2026-07-27 disk krizi tekrarlamasın).
#
# KULLANIM
#   ./geo-turu-vps.sh                 # sonsuz (systemd böyle çağırır)
#   PARTI=5 ./geo-turu-vps.sh         # 5 parti sonra dur
#   GEO_MOD=tam ./geo-turu-vps.sh     # gizli-A'yı atla, doğrudan tam kuyruk
#   PARTI_BOY=3000 ./geo-turu-vps.sh  # parti boyu
#
# RESUME: her parti KENDİ node süreci. `geo_enriched_at IS NULL` filtresi +
# kalıcı hücre önbelleği (scraper/data/geo-cell-cache.ndjson) sayesinde süreç
# kesilse, sunucu yeniden başlasa bile aynı komut kaldığı yerden devam eder.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BURADA="$(cd "$(dirname "$0")" && pwd)"
KOK="${VEGALAND_SCRAPER:-$(cd "$BURADA/../../scraper" 2>/dev/null && pwd)}"
if [ ! -f "$KOK/geo-enrich-offmarket.mjs" ]; then
  echo "HATA: scraper klasörü bulunamadı ($KOK). VEGALAND_SCRAPER=/yol/scraper ver." >&2
  exit 3
fi
cd "$KOK"

PARTI="${PARTI:-0}"                  # 0 = sonsuz
PARTI_BOY="${PARTI_BOY:-1500}"
YOL_ESIK="${YOL_ESIK:-20}"           # % — altına düşerse DUR
NEFES="${NEFES:-15}"                 # partiler arası saniye (ayna 429 yemesin)
GEO_MOD="${GEO_MOD:-oto}"            # oto | gizli-a | tam
LOG_DIZIN="$KOK/logs/geo-vps"
LOG_SAKLA="${GEO_LOG_SAKLA:-60}"     # kaç parti logu tutulsun
DURUM="$LOG_DIZIN/durum.txt"
KILIT="$KOK/.geo-vps.lock"

mkdir -p "$LOG_DIZIN"

# ── KİLİT: aynı iş iki kez koşmasın ────────────────────────────────────────
# flock varsa onu kullan (yarış koşulu yok). Yoksa PID'li yedek mekanizma.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$KILIT"
  if ! flock -n 9; then
    echo "[$(date '+%F %T')] geo turu ZATEN koşuyor (kilit: $KILIT) — çıkılıyor." | tee -a "$DURUM"
    exit 0
  fi
  echo $$ >&9
else
  if [ -f "$KILIT" ] && kill -0 "$(cat "$KILIT" 2>/dev/null)" 2>/dev/null; then
    echo "[$(date '+%F %T')] geo turu ZATEN koşuyor (PID $(cat "$KILIT")) — çıkılıyor." | tee -a "$DURUM"
    exit 0
  fi
  echo $$ > "$KILIT"
  trap 'rm -f "$KILIT"' EXIT
fi

not() { echo "[$(date '+%F %T')] $*" | tee -a "$DURUM"; }

# ── Log budama: parti logları birikip diski doldurmasın ────────────────────
log_buda() {
  # Yeniden eskiye sırala, ilk LOG_SAKLA'yı bırak, gerisini sil.
  ls -1t "$LOG_DIZIN"/parti-*.log 2>/dev/null | tail -n "+$((LOG_SAKLA + 1))" | while read -r f; do rm -f "$f"; done
  # durum.txt şişerse son 5000 satırı tut.
  if [ -f "$DURUM" ] && [ "$(wc -l < "$DURUM")" -gt 20000 ]; then
    tail -5000 "$DURUM" > "$DURUM.yeni" && mv "$DURUM.yeni" "$DURUM"
  fi
}

# ── SALT-OKUNUR DB sorguları (SELECT yalnızca) ────────────────────────────
sorgu() {
  # $1 = SQL (tek satırlık sayısal sonuç bekleniyor). Hata → -1.
  SQL="$1" node -e '
    import("pg").then(async ({ default: pg }) => {
      const { dbUrl } = await import("./grade-offmarket.mjs");
      const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
      await c.connect();
      const { rows: [r] } = await c.query(process.env.SQL);
      console.log(Object.values(r)[0]);
      await c.end();
    }).catch(() => { console.log("-1"); });' 2>/dev/null
}

# "Gizli A" havuzunda kaç kayıt kaldı? (geo-turu-gizli-a.sh ile AYNI sorgu)
gizli_a_kalan() {
  sorgu "with a as (select state, min(grade_score) a_min from offmarket_leads
                     where grade in ('A','A+') group by 1)
         select count(*)::int n from offmarket_leads o join a on a.state = o.state
          where o.grade = 'B' and o.geo_enriched_at is null and o.lat is not null
            and o.grade_score >= a.a_min"
}

# Tam kuyrukta kaç kayıt kaldı?
tam_kalan() {
  sorgu "select count(*)::int n from offmarket_leads
          where geo_enriched_at is null and lat is not null"
}

# Son 30 dk'da taranan kayıtların yol bulma oranı (%). Veri yoksa -1.
yol_orani() {
  sorgu "select case when count(*) = 0 then -1
                else (100 * count(*) filter (where dist_road_m >= 0) / count(*))::int end n
           from offmarket_leads where geo_enriched_at > now() - interval '30 minutes'"
}

# ── Açılış ────────────────────────────────────────────────────────────────
not "════ GEO TURU (VPS) BAŞLIYOR ════"
not "kök=$KOK · mod=$GEO_MOD · parti boyu=$PARTI_BOY · yol eşiği=%$YOL_ESIK · parti limiti=${PARTI:-sonsuz}"

# Ayna durumu tura başlamadan bir kez yazılsın — logda "neden yavaş" görünsün.
if [ -x "$BURADA/overpass-test.sh" ]; then
  "$BURADA/overpass-test.sh" 2>&1 | grep -E "^SONUÇ|^⚠|^⛔|^✔" | while read -r s; do not "ayna: $s"; done
fi

i=0
while :; do
  i=$((i + 1))
  [ "$PARTI" -gt 0 ] && [ "$i" -gt "$PARTI" ] && { not "parti limiti doldu ($PARTI) — duruluyor."; break; }

  # ── Mod seçimi: önce gizli-A, boşalınca tam kuyruk ──
  MOD="$GEO_MOD"
  if [ "$MOD" = "oto" ]; then
    GA="$(gizli_a_kalan)"
    if [ "$GA" = "-1" ]; then
      not "⛔ DB'ye bağlanılamadı — 5 dk sonra tekrar denenecek."
      sleep 300; continue
    fi
    if [ "$GA" -gt 0 ]; then MOD="gizli-a"; else MOD="tam"; fi
  fi

  if [ "$MOD" = "gizli-a" ]; then
    KALAN="$(gizli_a_kalan)"; ETIKET="gizli-A"
  else
    KALAN="$(tam_kalan)"; ETIKET="tam kuyruk"
  fi

  if [ "$KALAN" = "-1" ]; then
    not "⛔ DB'ye bağlanılamadı — 5 dk sonra tekrar."
    sleep 300; continue
  fi
  if [ "$KALAN" = "0" ]; then
    not "✔ $ETIKET havuzu BOŞ — yapılacak geo işi yok. 30 dk sonra tekrar bakılacak."
    node grade-offmarket.mjs >>"$LOG_DIZIN/grade.log" 2>&1 || true
    log_buda
    sleep 1800; continue
  fi

  LOG="$LOG_DIZIN/parti-$(date +%Y%m%d_%H%M%S).log"
  not "parti $i · mod=$ETIKET · havuzda $KALAN kayıt · log=$(basename "$LOG")"

  if [ "$MOD" = "gizli-a" ]; then
    GEO_GIZLI_A=1 GEO_TOP="$PARTI_BOY" node geo-enrich-offmarket.mjs >>"$LOG" 2>&1
  else
    GEO_TOP="$PARTI_BOY" node geo-enrich-offmarket.mjs >>"$LOG" 2>&1
  fi
  RC=$?
  SON="$(grep -E '^bitti:' "$LOG" | tail -1)"
  not "parti $i geo çıkış=$RC · ${SON:-(özet yok)}"

  # geo-enrich, hiçbir ayna canlı değilse 1 ile çıkar (resume güvenli).
  if [ "$RC" -ne 0 ] && grep -q "Hiçbir Overpass aynası" "$LOG"; then
    not "⚠ Hiçbir ayna canlı değil — 10 dk bekleyip tekrar denenecek (veri kaybı YOK)."
    sleep 600; continue
  fi

  # ── SAĞLIK KAPISI ──
  ORAN="$(yol_orani)"
  not "parti $i yol bulma oranı: %$ORAN (eşik %$YOL_ESIK · sağlıklı turlarda ~%88)"
  if [ "$ORAN" != "-1" ] && [ "$ORAN" -lt "$YOL_ESIK" ]; then
    not "⛔ DURDURULDU — yol bulma oranı eşiğin ALTINDA. Tur BOZUK olabilir."
    not "   Kontrol: parseDistances / elMerkez / superSorgu (bkz. NOT-MOTORU-KALIBRASYON.md)"
    not "   systemd bu çıkışta yeniden başlatmaz. Düzeltince: systemctl restart vegaland-geo"
    exit 2
  fi

  # Doğrulanan kayıtlar A+/A havuzuna GİREBİLSİN diye notları tazele.
  node grade-offmarket.mjs >>"$LOG" 2>&1 || not "⚠ notlandırma hata verdi (bkz. $LOG)"
  node geo-durum.mjs >>"$DURUM" 2>&1 || true

  log_buda
  sleep "$NEFES"
done

not "════ GEO TURU (VPS) BİTTİ ════"
