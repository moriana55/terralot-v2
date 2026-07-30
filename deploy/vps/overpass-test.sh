#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# overpass-test.sh — TEK BAŞINA çalışan Overpass ayna testi.
#
# NEDEN: geo doğrulamanın hızı, ABD verisi döndüren CANLI ayna sayısıyla doğru
# orantılı (toplam işçi = canlı ayna × GEO_PER_MIRROR). Mac'te 7 aynadan
# çoğu ECONNREFUSED/timeout veriyor; bu yüzden geo turu sürünüyor. Bu betik
# "VPS'ten kaç ayna açık?" sorusunu KURULUMDAN ÖNCE cevaplar — karar noktası.
#
# BAĞIMLILIK YOK: sadece `node` (>=18, global fetch) gerekir. npm install,
# pg, .env, DB — hiçbiri lazım değil. Fresh bir sunucuya scp'leyip koşturabilirsin.
#
#   ./overpass-test.sh                          # ayna listesini projeden okur
#   GEO_KAYNAK=/yol/geo-enrich-offmarket.mjs ./overpass-test.sh
#   GEO_MIRRORS="https://a/api/interpreter,https://b/api/interpreter" ./overpass-test.sh
#   AYNA_TIMEOUT=20000 ./overpass-test.sh       # daha kısa zaman aşımı
#
# ÇIKIŞ KODU: canlı ayna sayısı 0 ise 1, değilse 0.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
BURADA="$(cd "$(dirname "$0")" && pwd)"

# Ayna listesinin kaynağı: geo-enrich-offmarket.mjs. Tek doğru kaynak orası —
# burada liste KOPYALANMAZ (kopya, kod değişince sessizce yanlışa döner).
KAYNAK="${GEO_KAYNAK:-}"
if [ -z "$KAYNAK" ]; then
  for aday in \
    "$BURADA/../../scraper/geo-enrich-offmarket.mjs" \
    "$BURADA/../scraper/geo-enrich-offmarket.mjs" \
    "$BURADA/scraper/geo-enrich-offmarket.mjs" \
    "$PWD/scraper/geo-enrich-offmarket.mjs"
  do
    [ -f "$aday" ] && KAYNAK="$aday" && break
  done
fi

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: node bulunamadı. Node 18+ kur, sonra tekrar dene." >&2
  exit 2
fi

if [ -z "${GEO_MIRRORS:-}" ] && [ ! -f "$KAYNAK" ]; then
  cat >&2 <<'YRD'
HATA: ayna listesi bulunamadı.
  Ya geo-enrich-offmarket.mjs yolunu ver:   GEO_KAYNAK=/yol/geo-enrich-offmarket.mjs ./overpass-test.sh
  Ya da listeyi elle geç:                   GEO_MIRRORS="https://.../api/interpreter,..." ./overpass-test.sh
YRD
  exit 2
fi

echo "makine : $(uname -s) $(uname -m) · $(hostname)"
echo "node   : $(node -v)"
[ -f "$KAYNAK" ] && echo "kaynak : $KAYNAK"
echo

AYNA_KAYNAK="$KAYNAK" node --input-type=module <<'NODE'
// Aynı sorgu ve aynı karar mantığı scraper/geo-enrich-offmarket.mjs içindeki
// aynaYokla() ile bilerek AYNI tutuldu; sonuç oradaki koşuyla kıyaslanabilsin.
import { readFileSync } from "node:fs";

const UA = "terralot-geo/1.0 (land grading; contact sales@nocturndev.com)";
const TIMEOUT = Number(process.env.AYNA_TIMEOUT || 45000);
const DENEME = Number(process.env.AYNA_DENEME || 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ayna listesini kaynak dosyadan söker (liste burada KOPYALANMAZ). */
function aynalariOku() {
  if (process.env.GEO_MIRRORS) {
    return process.env.GEO_MIRRORS.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const src = readFileSync(process.env.AYNA_KAYNAK, "utf8");
  const m = src.match(/OVERPASS_MIRRORS\s*=\s*\(process\.env\.GEO_MIRRORS\s*\|\|\s*\[([\s\S]*?)\]/);
  if (!m) throw new Error("OVERPASS_MIRRORS listesi kaynak dosyada bulunamadı");
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
}

// Mississippi ortası (32.5,-89.5) — ABD verisi döndüğünü kanıtlar. Bölgesel
// aynalar (ör. osm.ch, yalnız İsviçre) 200 döner ama 0 eleman verir → ÖLÜ sayılır.
const Q = `[out:json][timeout:25];(node(around:30000,32.5,-89.5)["place"~"^(town|city|village)$"];);out center 30;`;

async function tek(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: "data=" + encodeURIComponent(Q),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (r.status === 429 || r.status === 503 || r.status === 504) {
      return { url, ok: true, mesgul: true, not: `HTTP ${r.status} meşgul (KULLANILIR)`, ms: Date.now() - t0 };
    }
    if (!r.ok) return { url, ok: false, not: `HTTP ${r.status}`, ms: Date.now() - t0 };
    const j = await r.json();
    const n = j?.elements?.length ?? 0;
    return { url, ok: n > 0, not: n > 0 ? `${n} eleman` : "ABD verisi yok (bölgesel ayna)", ms: Date.now() - t0 };
  } catch (e) {
    const kod = e.cause?.code || e.name || "";
    const gecici = kod === "TimeoutError" || /timeout/i.test(e.message || "");
    return { url, ok: false, gecici, not: (kod || e.message || "hata").slice(0, 40), ms: Date.now() - t0 };
  }
}

const aynalar = aynalariOku();
console.log(`${aynalar.length} ayna yoklanıyor (zaman aşımı ${TIMEOUT / 1000}sn, deneme ${DENEME})…\n`);

const sonuc = await Promise.all(aynalar.map(async (url) => {
  let son = null;
  for (let i = 0; i < DENEME; i++) {
    son = await tek(url);
    if (son.ok || !son.gecici) return son;   // kalıcı hata → tekrar denemek boşa vakit
    if (i < DENEME - 1) await sleep(3000);
  }
  return son;
}));

// ── Tablo ─────────────────────────────────────────────────────────────────
const kisa = (u) => u.replace(/^https?:\/\//, "").replace(/\/api\/interpreter$/, "").replace(/\/osm\/tools\/overpass$/, "");
const w = Math.max(24, ...sonuc.map((s) => kisa(s.url).length));
console.log(`${"AYNA".padEnd(w)}  DURUM   ${"GECİKME".padStart(9)}  NOT`);
console.log("─".repeat(w + 2) + "  ──────  " + "─".repeat(9) + "  " + "─".repeat(30));
for (const s of sonuc.sort((a, b) => (b.ok - a.ok) || (a.ms - b.ms))) {
  const durum = s.ok ? (s.mesgul ? "MEŞGUL" : "  AÇIK") : " KAPALI";
  console.log(`${kisa(s.url).padEnd(w)}  ${durum}  ${(s.ms + "ms").padStart(9)}  ${s.not}`);
}

const canli = sonuc.filter((s) => s.ok);
const perMirror = Number(process.env.GEO_PER_MIRROR || 3);
console.log("");
console.log(`SONUÇ: ${canli.length}/${sonuc.length} ayna kullanılabilir → tahmini işçi = ${canli.length} × ${perMirror} = ${canli.length * perMirror}`);
if (canli.length === 0) {
  console.log("⛔ Hiçbir ayna ABD verisi döndürmedi — bu makineden geo turu KOŞMAZ.");
} else if (canli.length <= 2) {
  console.log("⚠ Dar boğaz: 1-2 ayna. Geo hızı düşük kalır (Mac'teki durumla benzer).");
} else {
  console.log("✔ Sağlıklı paralellik. Geo turu bu makinede hızlı koşar.");
}
console.log("");
console.log("KARŞILAŞTIRMA İÇİN: aynı betiği Mac'te de koştur, canlı ayna sayılarını kıyasla.");
process.exit(canli.length ? 0 : 1);
NODE
