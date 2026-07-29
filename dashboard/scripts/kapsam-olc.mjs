// ─────────────────────────────────────────────────────────────────────────────
// KAPSAM ÖLÇÜMÜ — kayıt defterindeki HER county'ye GERÇEK sorgu atar.
//
// Çıktı: public/kapsam-olcum.json  (Eyalet Kapsamı ekranı bunu okur)
//
// Kullanım:
//   node --import ./test/resolve-alias.mjs scripts/kapsam-olc.mjs
//   node --import ./test/resolve-alias.mjs scripts/kapsam-olc.mjs co-costilla fl-lee
//
// DÜRÜSTLÜK: sonuçlar ölçümden gelir. Çalışmayan county "çalışıyor" yazılmaz.
// Ücretli (Regrid) çağrılar sayılır ve raporun sonunda gösterilir.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";

// .env.local yükle (REGRID_API_TOKEN vb.)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const { COUNTY_REGISTRY } = await import("../src/lib/county-registry.ts");
const { queryCounty } = await import("../src/lib/county-providers/index.ts");
const { countArcGis } = await import("../src/lib/county-providers/arcgis.ts");
const { mailable } = await import("../src/lib/live-county-types.ts");

// Hasadı BİTMİŞ eyaletler — ölçüm bunlara dokunmaz. FL 19 Tem'de çekildi
// (84.044 kayıt, %100 mailable); tekrar yoklamanın faydası yok, boşuna istek.
// Zorlamak için: `npm run kapsam -- --tumu` ya da county anahtarını elle ver.
const HASADI_BITEN = new Set(["FL"]);
const TUMU = process.argv.includes("--tumu");

const SECILI = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const keys = (SECILI.length ? SECILI : Object.keys(COUNTY_REGISTRY)).filter((k) => {
  if (SECILI.length || TUMU) return true; // elle istendiyse atlama
  const e = COUNTY_REGISTRY[k];
  if (e && HASADI_BITEN.has(e.state)) {
    console.log(`⏭  ${k.padEnd(16)} atlandı — ${e.state} hasadı tamam, tekrar sorgulanmıyor`);
    return false;
  }
  return true;
});
const ORNEK = 25; // her county'den çekilecek örnek satır — küçük tutuldu (maliyet/hız)

const sonuclar = [];
let toplamApiCagri = 0;

for (const key of keys) {
  const entry = COUNTY_REGISTRY[key];
  if (!entry) { console.error(`⚠ bilinmeyen county: ${key}`); continue; }

  const r = await queryCounty(key, entry, {}, ORNEK);
  toplamApiCagri += r.apiCalls;

  // Toplam parsel sayısı (yalnızca ArcGIS için ucuz; Regrid'de sayım yapmayız)
  let toplam = null, toplamHata;
  const arc = entry.sources.find((s) => s.kind === "arcgis");
  if (arc && r.status !== "servis-hatasi") {
    const c = await countArcGis(arc);
    toplam = c.count; toplamHata = c.error;
  }

  const mailableSayi = r.rows.filter(mailable).length;
  const degerliSayi = r.rows.filter((x) => x.land_value != null && x.land_value > 0).length;

  // Ölçülen duruma göre dürüst durum kodu
  let durum;
  if (r.status === "ok") durum = mailableSayi > 0 ? "calisiyor" : "posta-adresi-yok";
  else if (r.status === "bos") durum = "veri-yok";
  else if (r.status === "servis-hatasi") durum = "servis-kapali";
  else if (r.status === "kimlik-hatasi") durum = "kimlik-hatasi";
  else if (r.status === "kota-doldu") durum = "kota-doldu";
  else durum = "kaynak-yok";

  const kayit = {
    key, label: entry.label, state: entry.state, county: entry.county,
    saglayici: r.provider,
    kaynakZinciri: entry.sources.map((s) => s.kind).join(" → ") || "yok",
    durum,
    apiStatus: r.status,
    ornekSatir: r.rows.length,
    mailable: mailableSayi,
    mailableOran: r.rows.length ? Math.round((mailableSayi / r.rows.length) * 100) : null,
    degerVar: degerliSayi > 0,
    toplamParsel: toplam,
    toplamHata: toplamHata ?? null,
    sureMs: r.attempts.reduce((t, a) => t + a.durationMs, 0),
    mesaj: r.message ?? null,
    olcumZamani: r.fetchedAt,
    apiCagri: r.apiCalls,
  };
  sonuclar.push(kayit);

  const ok = durum === "calisiyor" ? "✅" : durum === "veri-yok" ? "⚪" : "❌";
  console.log(
    `${ok} ${key.padEnd(16)} ${String(durum).padEnd(18)} ` +
    `örnek=${String(kayit.ornekSatir).padStart(3)} mailable=${String(mailableSayi).padStart(3)} ` +
    `toplam=${toplam ?? "—"} ${kayit.mesaj ? "· " + kayit.mesaj.slice(0, 90) : ""}`,
  );
}

// Kısmi çalıştırmada ÖNCEKİ ölçümler korunur — sadece bu turda ölçülenler
// güncellenir. Aksi halde tek county ölçmek tüm tabloyu siler.
const out = path.join(process.cwd(), "public", "kapsam-olcum.json");
let onceki = [];
if (SECILI.length && fs.existsSync(out)) {
  try { onceki = JSON.parse(fs.readFileSync(out, "utf8")).sonuclar ?? []; } catch { /* bozuksa yoksay */ }
}
const birlesik = [...onceki.filter((o) => !sonuclar.some((s) => s.key === o.key)), ...sonuclar];

const cikti = {
  olcumZamani: new Date().toISOString(),
  countySayisi: birlesik.length,
  eyaletSayisi: new Set(birlesik.map((s) => s.state)).size,
  calisan: birlesik.filter((s) => s.durum === "calisiyor").length,
  toplamApiCagri,
  sonuclar: birlesik,
};

fs.writeFileSync(out, JSON.stringify(cikti, null, 2));

console.log("\n─────────────────────────────────────────");
console.log(`Eyalet: ${cikti.eyaletSayisi} · County: ${cikti.countySayisi} · Çalışan: ${cikti.calisan}`);
console.log(`Ücretli API çağrısı: ${toplamApiCagri}`);
console.log(`Yazıldı: ${out}`);
