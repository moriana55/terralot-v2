#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// hasat-runner.mjs — VegaLand günlük veri hasadının TEK giriş noktası.
//                    launchd (com.terralot.sourcing) bunu çağırır.
//
// ── NEDEN VAR (2026-07-29 teşhisi) ───────────────────────────────────────────
// Eski kurulum ~/Library/Application Support/terralot-runner/ altındaki bir
// AYNA klasörde koşuyordu. Sebep: macOS TCC, launchd'nin başlattığı Apple
// platform ikililerinin (/bin/bash, ls, cat, rsync) ~/Desktop altını okumasını
// engelliyor. Ayna her koşumda kaynaktan rsync denemesi yapıyor ama launchd
// altında bu da TCC'ye takılıyordu → ayna 29 Haziran'da donmuştu. Temmuz'da
// yazılan hiçbir hasat betiği (offmarket-*.mjs, harvest-*.mjs, disk-guard.mjs …)
// otomasyonda ÇALIŞMIYORDU. Üstelik run-all.sh her adımı yutup exit 0 döndüğü
// için status.json her gün "başarılı" yazıyordu — 3,5 haftalık sessiz ölüm.
//
// ── ÇÖZÜM ───────────────────────────────────────────────────────────────────
// TCC kısıtı ikiliye özgüdür: Homebrew node (/opt/homebrew/bin/node) Desktop'ı
// OKUYABİLİYOR (2026-07-29'da launchd altında ölçüldü) ve başlattığı ÇOCUK
// süreçler (bash, rsync, node) bu izni devralıyor. Bu yüzden launchd artık
// doğrudan node ile BU dosyayı gerçek proje klasöründe çalıştırır. Aynaya
// gerek kalmadı.
//
// ── SORUMLULUKLARI ──────────────────────────────────────────────────────────
//   1) Kilit      — üst üste binen koşuyu engeller (.hasat.lock, PID kontrollü).
//   2) Log        — zaman damgalı ayrı stdout/stderr dosyaları, otomatik döngü.
//   3) Ölçüm      — koşu öncesi/sonrası satır sayıları, dokunulan county'ler.
//   4) Durum      — .hasat-durum.json (makine-okunur; panel /admin/sistem okur).
//   5) Çıkış kodu — bir adım patlarsa runner da PATLAR. Sessiz başarı YOK.
//
// Kullanım:
//   node hasat-runner.mjs              # tam tur
//   node hasat-runner.mjs --smoke      # betikleri koşmadan ortamı doğrular
//   HASAT_ZORLA_HATA=1 node hasat-runner.mjs   # kasıtlı hata (tatbikat)
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const KOK = path.dirname(fileURLToPath(import.meta.url));
const PROJE = path.resolve(KOK, "..");
const LOG_DIZIN = path.join(KOK, "logs", "hasat");
const KILIT = path.join(KOK, ".hasat.lock");
const DURUM = path.join(KOK, ".hasat-durum.json");

// Log döngüsü ayarları (disk krizi tekrarlamasın — 2026-07-27).
const LOG_SAKLA_ADET = Number(process.env.HASAT_LOG_SAKLA || 30);
const LOG_SAKLA_GUN = Number(process.env.HASAT_LOG_GUN || 21);
const LOG_TOPLAM_MB = Number(process.env.HASAT_LOG_MB || 200);
/** Bu yaşı geçen kilit, PID canlı görünse bile bayat sayılır (saat). */
const KILIT_TAVAN_SAAT = Number(process.env.HASAT_KILIT_SAAT || 6);

// Delta ölçülecek tablolar.
const IZLENEN_TABLOLAR = [
  "offmarket_leads",
  "competitor_listings",
  "tax_delinquent_properties",
];

// launchd, süreçlere kırpılmış bir PATH verir (/usr/bin:/bin:/usr/sbin:/sbin) —
// içinde node YOKTUR. run-all.sh "node: command not found" ile patlar. Bu yüzden
// çocuk süreçlere PATH'i açıkça geçiriyoruz.
// Alt süreçler HER ZAMAN runner ile aynı node'u kullansın (sabit yol yazmak,
// node başka yere kurulunca sessizce bozulur).
const NODE = process.execPath;
const NODE_DIZIN = path.dirname(NODE);
const COCUK_PATH = [NODE_DIZIN, "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin"]
  .filter(Boolean)
  .join(":");

const SMOKE = process.argv.includes("--smoke");
const zaman = () => new Date().toISOString();
const damga = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace("T", "_")
  .slice(0, 15);

const LOG_YOL = path.join(LOG_DIZIN, `hasat_${damga}.log`);
const HATA_YOL = path.join(LOG_DIZIN, `hasat_${damga}.err.log`);

fs.mkdirSync(LOG_DIZIN, { recursive: true });
const logAkis = fs.createWriteStream(LOG_YOL, { flags: "a" });
const hataAkis = fs.createWriteStream(HATA_YOL, { flags: "a" });

/** Her satır zaman damgalı — "ne zaman patladı" sorusu logdan cevaplanabilsin. */
function yaz(metin, hataMi = false) {
  const satir = `[${zaman()}] ${metin}\n`;
  logAkis.write(satir);
  if (hataMi) hataAkis.write(satir);
  process.stdout.write(satir);
}

// ── Kilit ────────────────────────────────────────────────────────────────────
function pidYasiyorMu(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function kilitAl() {
  if (fs.existsSync(KILIT)) {
    let onceki = {};
    try {
      onceki = JSON.parse(fs.readFileSync(KILIT, "utf8"));
    } catch {
      /* bozuk kilit = bayat kilit */
    }
    // Yaş tavanı: PID'ler geri dönüştürülür. Ölü bir koşunun PID'ini alakasız
    // bir süreç kapmışsa kilit sonsuza kadar "canlı" görünür ve hasat bir daha
    // hiç koşmaz — yine sessiz ölüm. KİLİT_TAVAN_SAAT'i geçen kilit her hâlükârda
    // bayat sayılır (normal tur ~1 saat).
    const yasSaat = onceki.baslangic
      ? (Date.now() - new Date(onceki.baslangic).getTime()) / 3600000
      : Infinity;
    if (onceki.pid && pidYasiyorMu(onceki.pid) && yasSaat < KILIT_TAVAN_SAAT) {
      yaz(
        `KİLİT: önceki hasat hâlâ koşuyor (pid ${onceki.pid}, başlangıç ${onceki.baslangic}). Bu tur atlanıyor.`
      );
      return false;
    }
    yaz(
      `KİLİT: bayat kilit bulundu (pid ${onceki.pid ?? "?"}, yaş ${
        Number.isFinite(yasSaat) ? yasSaat.toFixed(1) + "sa" : "bilinmiyor"
      }) — temizlendi.`
    );
    fs.rmSync(KILIT, { force: true });
  }
  fs.writeFileSync(
    KILIT,
    JSON.stringify({ pid: process.pid, baslangic: zaman(), log: LOG_YOL }, null, 2)
  );
  return true;
}

const kilitBirak = () => fs.rmSync(KILIT, { force: true });

// ── Log döngüsü ──────────────────────────────────────────────────────────────
function loglariDondur() {
  // Hem runner logları (logs/hasat/hasat_*) hem run-all.sh logları (logs/run_*)
  // aynı politikaya tabi — ikisi de birikip diski doldurabiliyor.
  const kaynaklar = [
    { dizin: LOG_DIZIN, on: "hasat_" },
    { dizin: path.join(KOK, "logs"), on: "run_" },
  ];
  let dosyalar = [];
  try {
    for (const k of kaynaklar) {
      if (!fs.existsSync(k.dizin)) continue;
      dosyalar.push(
        ...fs
          .readdirSync(k.dizin)
          .filter((f) => f.startsWith(k.on))
          .map((f) => {
            const p = path.join(k.dizin, f);
            const st = fs.statSync(p);
            return { p, f, mtime: st.mtimeMs, size: st.size };
          })
          .filter((d) => fs.statSync(d.p).isFile())
      );
    }
    dosyalar.sort((a, b) => b.mtime - a.mtime);
  } catch {
    return { silinen: 0 };
  }

  const simdi = Date.now();
  const silinecek = new Set();

  // 1) Yaş sınırı
  for (const d of dosyalar) {
    if (simdi - d.mtime > LOG_SAKLA_GUN * 86400000) silinecek.add(d.p);
  }
  // 2) Adet sınırı (koşu başına 2 dosya: .log + .err.log)
  dosyalar.slice(LOG_SAKLA_ADET * 2).forEach((d) => silinecek.add(d.p));
  // 3) Toplam boyut sınırı — en eskiden başlayarak kırp
  let toplam = dosyalar.reduce((t, d) => t + (silinecek.has(d.p) ? 0 : d.size), 0);
  for (const d of [...dosyalar].reverse()) {
    if (toplam <= LOG_TOPLAM_MB * 1024 * 1024) break;
    if (silinecek.has(d.p)) continue;
    silinecek.add(d.p);
    toplam -= d.size;
  }

  // Bu koşunun kendi logları asla silinmesin.
  silinecek.delete(LOG_YOL);
  silinecek.delete(HATA_YOL);
  for (const p of silinecek) fs.rmSync(p, { force: true });
  return { silinen: silinecek.size };
}

// ── Supabase ölçümü ──────────────────────────────────────────────────────────
function istemci() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok (.env)");
  return createClient(url, key);
}

async function satirSayilari(sb) {
  const sonuc = {};
  for (const t of IZLENEN_TABLOLAR) {
    try {
      const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
      sonuc[t] = error ? null : count;
    } catch {
      sonuc[t] = null;
    }
  }
  return sonuc;
}

/** Koşu penceresinde offmarket_leads'te dokunulan eyalet/county'ler. */
async function dokunulanCountyler(sb, baslangicIso) {
  try {
    const { data, error } = await sb
      .from("offmarket_leads")
      .select("state, county")
      .gte("updated_at", baslangicIso)
      .limit(20000);
    if (error || !data) return [];
    const sayac = new Map();
    for (const r of data) {
      const k = `${r.state ?? "?"}/${r.county ?? "?"}`;
      sayac.set(k, (sayac.get(k) ?? 0) + 1);
    }
    return [...sayac.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([ad, satir]) => ({ ad, satir }));
  } catch {
    return [];
  }
}

// ── Alt süreç çalıştırıcı ────────────────────────────────────────────────────
function kosut(komut, argv, secenek = {}) {
  return new Promise((coz) => {
    const t0 = Date.now();
    // nice: hasat turu makineyi boğmasın (launchd tarafında da ProcessType=Background).
    const cocuk = spawn("/usr/bin/nice", ["-n", "10", komut, ...argv], {
      cwd: secenek.cwd ?? KOK,
      env: { ...process.env, PATH: COCUK_PATH, ...(secenek.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let hataTampon = "";
    cocuk.stdout.on("data", (b) => {
      logAkis.write(b);
      process.stdout.write(b); // terminalden koşarken canlı görünsün
    });
    cocuk.stderr.on("data", (b) => {
      logAkis.write(b);
      hataAkis.write(b);
      process.stdout.write(b);
      // Son 8 KB yeter — dev yığın izleri belleği şişirmesin.
      hataTampon = (hataTampon + String(b)).slice(-8192);
    });
    cocuk.on("error", (e) =>
      coz({ kod: 127, sureSn: 0, sonHata: `süreç başlatılamadı: ${e.message}` })
    );
    cocuk.on("close", (kod) =>
      coz({
        kod: kod ?? 1,
        sureSn: Math.round((Date.now() - t0) / 1000),
        // Adım BAŞARILIYSA hata alanı boş kalsın: stderr'e yazılan uyarılar
        // (ör. node'un MODULE_TYPELESS_PACKAGE_JSON bandı) panelde "hata" gibi
        // görünmesin.
        sonHata: (kod ?? 1) === 0 ? "" : anlamliHataSatiri(hataTampon),
      })
    );
  });
}

/**
 * stderr yığınından İŞE YARAR satırı seçer.
 * Naif "son satır" yaklaşımı Node'da hep sürüm bandını ("Node.js v25.9.0")
 * yakalıyordu — panelde hiçbir şey anlatmıyor. Önce gerçek hata satırını ara.
 */
export function anlamliHataSatiri(metin) {
  const satirlar = String(metin ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    // Gürültü: yığın izi çerçeveleri, node sürüm bandı, süslü parantezler.
    .filter(
      (s) =>
        !/^at\s/.test(s) &&
        !/^Node\.js v/.test(s) &&
        !/^[{}^]+$/.test(s) &&
        !/^node:internal\//.test(s) // "node:internal/modules/cjs/loader:1478" gibi konum satırları
    );
  const anlamli = satirlar.find((s) =>
    // \b[45]\d{2}\b: HTTP kodu. Sınırsız yazılırsa "loader:1478" gibi satır
    // numaralarını da yakalıyor — sınır şart.
    /(error|hata|✗|failed|fail:|cannot|denied|timeout|refused|ENOENT|\b[45]\d{2}\b)/i.test(s)
  );
  return (anlamli ?? satirlar[satirlar.length - 1] ?? "").slice(0, 400);
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  const baslangic = zaman();
  yaz(`==== HASAT BAŞLADI ${damga} (smoke=${SMOKE ? 1 : 0}) ====`);
  yaz(`proje: ${PROJE}`);
  yaz(`log:   ${LOG_YOL}`);

  const dondu = loglariDondur();
  if (dondu.silinen) yaz(`log döngüsü: ${dondu.silinen} eski dosya silindi.`);

  const adimlar = [];
  let hata = null;

  const sb = istemci();
  const once = await satirSayilari(sb);
  yaz(`satır (önce): ${JSON.stringify(once)}`);

  // Kasıtlı hata tatbikatı — sessiz yutma testi için.
  if (process.env.HASAT_ZORLA_HATA === "1") {
    yaz("TATBİKAT: HASAT_ZORLA_HATA=1 — var olmayan county betiği çağrılıyor.", true);
    const r = await kosut(NODE, ["offmarket-xx-olmayan-county.mjs"]);
    adimlar.push({ ad: "tatbikat: olmayan county", kod: r.kod, sureSn: r.sureSn, hata: r.sonHata });
    if (r.kod !== 0) hata = `tatbikat: olmayan county (çıkış ${r.kod}) — ${r.sonHata}`;
  } else if (SMOKE) {
    const r = await kosut(NODE, ["disk-guard.mjs", "--report"]);
    adimlar.push({ ad: "smoke: disk-guard --report", kod: r.kod, sureSn: r.sureSn, hata: r.sonHata });
    if (r.kod !== 0) hata = `smoke başarısız (çıkış ${r.kod}) — ${r.sonHata}`;
  } else {
    // 1) Ana boru hattı. run-all.sh her adımın gerçek çıkış kodunu
    //    ADIM_SONUC_DOSYASI'na yazar ve bir adım patlarsa NONZERO döner.
    const adimDosya = path.join(LOG_DIZIN, `.adimlar_${damga}.tsv`);
    const r1 = await kosut("/bin/bash", [path.join(KOK, "run-all.sh")], {
      env: { SKIP_ZILLOW: "1", ADIM_SONUC_DOSYASI: adimDosya },
    });
    for (const satir of okuAdimlar(adimDosya)) adimlar.push(satir);
    if (r1.kod !== 0) hata = `run-all.sh çıkış ${r1.kod} — ${r1.sonHata || "adım(lar) başarısız"}`;
    fs.rmSync(adimDosya, { force: true });

    // 2) Rakip radar günlük snapshot + diff (dashboard tarafı).
    const dashEnv = path.join(PROJE, "dashboard", ".env.local");
    const r2 = await kosut(
      NODE,
      [
        ...(fs.existsSync(dashEnv) ? [`--env-file=${dashEnv}`] : []),
        path.join(PROJE, "dashboard", "scripts", "rakip-radar-refresh.mjs"),
      ],
      { cwd: path.join(PROJE, "dashboard") }
    );
    adimlar.push({ ad: "rakip-radar-refresh", kod: r2.kod, sureSn: r2.sureSn, hata: r2.sonHata });
    if (r2.kod !== 0) {
      hata = `${hata ? hata + " | " : ""}rakip-radar-refresh çıkış ${r2.kod} — ${r2.sonHata}`;
    }
  }

  const sonra = await satirSayilari(sb);
  const countyler = SMOKE ? [] : await dokunulanCountyler(sb, baslangic);
  yaz(`satır (sonra): ${JSON.stringify(sonra)}`);

  const satirlar = {};
  let toplamYeni = 0;
  for (const t of IZLENEN_TABLOLAR) {
    const delta = once[t] != null && sonra[t] != null ? sonra[t] - once[t] : null;
    satirlar[t] = { once: once[t], sonra: sonra[t], delta };
    if (delta && delta > 0) toplamYeni += delta;
  }

  const basarili = !hata;
  durumYaz({
    baslangic,
    bitis: zaman(),
    basarili,
    hata,
    adimlar,
    satirlar,
    toplamYeniSatir: toplamYeni,
    countyler,
    smoke: SMOKE,
  });

  yaz(
    `==== HASAT BİTTİ — ${basarili ? "BAŞARILI" : "BAŞARISIZ"} · yeni satır ${toplamYeni} · ` +
      `county ${countyler.length} ====`,
    !basarili
  );
  if (hata) yaz(`HATA: ${hata}`, true);

  // Sessiz başarı YOK: hata varsa launchd de hata görsün.
  return basarili ? 0 : 1;
}

/** run-all.sh'in yazdığı TSV: ad \t çıkışKodu \t saniye */
function okuAdimlar(dosya) {
  try {
    return fs
      .readFileSync(dosya, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((s) => {
        const [ad, kod, sn] = s.split("\t");
        return { ad, kod: Number(kod), sureSn: Number(sn) || 0, hata: null };
      });
  } catch {
    return [];
  }
}

/** Panelin okuduğu makine-okunur durum dosyası. */
function durumYaz(k) {
  let eski = {};
  try {
    eski = JSON.parse(fs.readFileSync(DURUM, "utf8"));
  } catch {
    /* ilk koşu */
  }
  const durum = {
    surum: 1,
    sonKosuBaslangic: k.baslangic,
    sonKosuBitis: k.bitis,
    sonKosuBasarili: k.basarili,
    sonBasariliKosu: k.basarili ? k.bitis : (eski.sonBasariliKosu ?? null),
    ustUsteHata: k.basarili ? 0 : (eski.ustUsteHata ?? 0) + 1,
    sonHata: k.hata,
    smoke: k.smoke,
    sureSn: Math.round((new Date(k.bitis) - new Date(k.baslangic)) / 1000),
    adimlar: k.adimlar,
    satirlar: k.satirlar,
    toplamYeniSatir: k.toplamYeniSatir,
    countyler: k.countyler.slice(0, 50),
    countySayisi: k.countyler.length,
    log: k.basarili ? LOG_YOL : HATA_YOL,
    logDizin: LOG_DIZIN,
  };
  fs.writeFileSync(DURUM, JSON.stringify(durum, null, 2));
  return durum;
}

/** Runner'ın KENDİSİ patlarsa da durum dosyası yazılsın — yoksa yine sessiz ölüm. */
function cokmeyiKaydet(e) {
  try {
    durumYaz({
      baslangic: zaman(),
      bitis: zaman(),
      basarili: false,
      hata: `runner çöktü: ${e?.message ?? e}`,
      adimlar: [],
      satirlar: {},
      toplamYeniSatir: 0,
      countyler: [],
      smoke: SMOKE,
    });
  } catch {
    /* durum bile yazılamıyorsa yapacak bir şey yok */
  }
}

if (!kilitAl()) process.exit(0);

let cikis = 1;
try {
  cikis = await main();
} catch (e) {
  yaz(`ÖLÜMCÜL: ${e?.stack ?? e}`, true);
  cokmeyiKaydet(e);
  cikis = 1;
} finally {
  kilitBirak();
}
logAkis.end();
hataAkis.end();
process.exit(cikis);
