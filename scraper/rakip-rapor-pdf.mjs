#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// RAKİP KÂRLILIK RAPORU (PDF) — Discount Lots'un Mohave County'deki her
// parselinin alım/satış ekonomisi, zarar analizi dahil.
//
//   node scraper/rakip-rapor-pdf.mjs
//
// KAYNAKLAR (ikisi APN üzerinden eşleştirilir):
//   • ALIM  : Mohave County Assessor açık verisi — SALEP (tapuya kaydedilen
//             bedel), SALEDT (tarih), RECPTNO (tescil no), DEEDTYPE
//   • SATIŞ : discountlots.com/property/{APN} ilan sayfası + Wayback arşivi
//
// METODOLOJİ KARARI — PAKET TAPULAR HARİÇ: 87 tapunun 36'sı "paket" (tek
// tescil no altında birden çok parsel). County bu tapularda bedeli HER satıra
// TOPLAM olarak yazıyor; parsel başına düşen pay ancak eşit-bölüşüm VARSAYIMIYLA
// tahmin edilebilir ve bu varsayım yanlış (bir parsel yola cepheli, öbürü kadük
// olabilir). Bu tahminler dahil edilince medyan alım $5.000 yerine $8.900,
// medyan çarpan 3,33x yerine 1,53x çıkıyordu — iki yönde birden hatalı.
// Bu rapor SADECE tek parselli tapuları kullanır: sayı az ama her satır denetlenebilir.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const J = (f) => JSON.parse(readFileSync(resolve(__dirname, f), "utf8"));
const norm = (s) => String(s ?? "").replace(/[^0-9]/g, "");
const num = (v) => Number(String(v ?? "").replace(/[$,]/g, "")) || null;
const usd = (v) => (v == null ? "—" : "$" + Math.round(v).toLocaleString("en-US"));

export function buildRows(tapu, ilan) {
  const satis = new Map();
  for (const x of ilan.kayitlar ?? []) satis.set(norm(x.apn), x);
  const rows = [];
  for (const d of tapu.kayitlar ?? []) {
    const paket = Number(d.deed_parcel_count) > 1;
    const alim = num(d.fiyat);
    const s = satis.get(norm(d.belge_no_apn));
    const sat = s?.satis_fiyati ? Number(s.satis_fiyati) : null;
    rows.push({
      apn: d.belge_no_apn, paket, deed_n: Number(d.deed_parcel_count) || 1,
      acres: d.acres ? Number(d.acres) : null,
      alim, alim_tarih: d.tarih || null, deed_type: d.deed_type || null,
      satici: d.karsi_taraf || null, bolge: d.bolge || null,
      sat, statu: s?.statu ?? null, pesinat: s?.pesinat ? Number(s.pesinat) : null,
      aylik: s?.aylik ? Number(s.aylik) : null, vade: s?.vade ? Number(s.vade) : null,
      kayit_tipi: d.kayit_tipi || null,
    });
  }
  return rows;
}

/** SAF: tek parselli + iki tarafı da bilinen kayıtların ekonomisi. */
export function analyze(rows) {
  const temiz = rows.filter((r) => !r.paket && r.alim > 500);
  const eslesen = temiz.filter((r) => r.sat > 0).map((r) => ({
    ...r, kar: r.sat - r.alim, carpan: r.sat / r.alim,
    // Taksitli satışta toplam tahsilat peşin fiyattan yüksektir.
    toplam_tahsilat: r.aylik && r.vade ? (r.pesinat ?? 0) + r.aylik * r.vade : null,
  }));
  // DURUM AYRIMI (2026-07-26 düzeltmesi): "satıldı" tek kova değil.
  //   Sold-*            → işlem kapandı, para alındı
  //   Servicing Retained→ taksitli satıldı, TAHSİLAT SÜRÜYOR (kâr gerçekleşmedi)
  //   Available         → HÂLÂ SATILIK; ilk sürümde yanlışlıkla "satılan"a girmişti
  const kapandi = eslesen.filter((r) => /^Sold/.test(r.statu ?? ""));
  const taksitte = eslesen.filter((r) => /Servicing Retained/.test(r.statu ?? ""));
  const ilanda = eslesen.filter((r) => !/^Sold|Servicing Retained/.test(r.statu ?? ""));
  const envanter = temiz.filter((r) => !(r.sat > 0));
  const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const srt = (x) => x.sort((a, b) => b.carpan - a.carpan);
  return {
    eslesen: srt(eslesen), kapandi: srt(kapandi), taksitte: srt(taksitte), ilanda: srt(ilanda),
    med_carpan_kapandi: med(kapandi.map((r) => r.carpan)),
    med_carpan_taksitte: med(taksitte.map((r) => r.carpan)),
    envanter,
    zarar: eslesen.filter((r) => r.kar < 0),
    basabas: eslesen.filter((r) => r.kar === 0),
    med_alim: med(eslesen.map((r) => r.alim)),
    med_sat: med(eslesen.map((r) => r.sat)),
    med_carpan: med(eslesen.map((r) => r.carpan)),
    med_kar: med(eslesen.map((r) => r.kar)),
    toplam_alim: eslesen.reduce((a, r) => a + r.alim, 0),
    toplam_sat: eslesen.reduce((a, r) => a + r.sat, 0),
    paket_sayisi: rows.filter((r) => r.paket).length,
  };
}

function html(a, rows) {
  const satir = (r) => `<tr>
    <td class="m">${r.apn}</td><td class="r">${r.acres ?? "—"}</td>
    <td class="r">${usd(r.alim)}</td><td class="d">${r.alim_tarih ?? "—"}</td>
    <td class="r">${usd(r.sat)}</td>
    <td class="r ${r.kar < 0 ? "neg" : "pos"}">${usd(r.kar)}</td>
    <td class="r b">${r.carpan.toFixed(2)}x</td>
    <td class="s">${r.statu ?? "—"}</td>
    <td class="r">${r.toplam_tahsilat ? usd(r.toplam_tahsilat) : "—"}</td></tr>`;
  const env = (r) => `<tr><td class="m">${r.apn}</td><td class="r">${r.acres ?? "—"}</td>
    <td class="r">${usd(r.alim)}</td><td class="d">${r.alim_tarih ?? "—"}</td>
    <td class="s" colspan="5">${r.kayit_tipi === "envanter" ? "Satılmamış — hâlâ envanterde" : (r.kayit_tipi ?? "—")}</td></tr>`;
  return `<style>
  @page { size: A4 landscape; margin: 14mm 10mm; }
  body { font: 10px/1.45 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #16181d; }
  h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: -.2px; }
  h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #16181d; }
  .sub { color: #6b7280; font-size: 10px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .4px;
       color: #4b5563; border-bottom: 1px solid #9ca3af; padding: 4px 5px; }
  td { padding: 3.5px 5px; border-bottom: .5px solid #e5e7eb; }
  tr:nth-child(even) td { background: #fafafa; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .m { font-family: ui-monospace, Menlo, monospace; font-size: 9px; }
  .d { font-size: 9px; color: #6b7280; }
  .s { font-size: 9px; }
  .b { font-weight: 700; }
  .pos { color: #15803d; } .neg { color: #b91c1c; font-weight: 700; }
  .kpi { display: flex; gap: 10px; margin: 10px 0 4px; }
  .kpi div { flex: 1; border: 1px solid #d1d5db; border-radius: 5px; padding: 7px 9px; }
  .kpi .l { font-size: 8.5px; text-transform: uppercase; letter-spacing: .4px; color: #6b7280; }
  .kpi .v { font-size: 16px; font-weight: 700; margin-top: 1px; font-variant-numeric: tabular-nums; }
  .note { background: #f7f7f8; border-left: 3px solid #16181d; padding: 8px 11px; margin: 12px 0; font-size: 9.5px; }
  .note b { display: block; margin-bottom: 2px; }
</style>
<h1>Discount Lots — Mohave County (AZ) Alım/Satım Ekonomisi</h1>
<div class="sub">Kaynak: Mohave County Assessor tapu kayıtları (SALEP/SALEDT) × discountlots.com ilan verisi · Yalnızca tek parselli tapular</div>

<div class="kpi">
  <div><div class="l">İşlem kapandı</div><div class="v">${a.kapandi.length}</div></div>
  <div><div class="l">Taksit sürüyor</div><div class="v">${a.taksitte.length}</div></div>
  <div><div class="l">Medyan alım</div><div class="v">${usd(a.med_alim)}</div></div>
  <div><div class="l">Kapanan medyan çarpan</div><div class="v">${a.med_carpan_kapandi.toFixed(2)}x</div></div>
  <div><div class="l">Zarar eden</div><div class="v ${a.zarar.length ? "neg" : "pos"}">${a.zarar.length}</div></div>
</div>

<div class="note"><b>ZARAR ETTİLER Mİ?</b>
Eşleşen ${a.eslesen.length} parselin <b style="display:inline">${a.zarar.length} tanesinde zarar</b>, ${a.basabas.length} tanesinde başabaş var.
Toplam alım ${usd(a.toplam_alim)} → toplam beyan edilen satış ${usd(a.toplam_sat)}
(brüt fark ${usd(a.toplam_sat - a.toplam_alim)}). Kapanış masrafı, emlak vergisi ve pazarlama
gideri düşülmemiştir. <b style="display:inline">Not:</b> alım tarafı tapu kaydıdır (kesin), satış tarafı
firmanın kendi ilan sayfasındaki beyandır (bağımsız doğrulanmadı).</div>

<h2>A · İşlem kapanmış — para alınmış (${a.kapandi.length} parsel, medyan ${a.med_carpan_kapandi.toFixed(2)}x)</h2>
<table><thead><tr><th>APN</th><th class="r">Dönüm</th><th class="r">Alım</th><th>Alım tarihi</th>
<th class="r">Satış</th><th class="r">Brüt kâr</th><th class="r">Çarpan</th><th>Durum</th>
<th class="r">Taksitli toplam</th></tr></thead><tbody>
${a.kapandi.map(satir).join("\n")}</tbody></table>

<h2>B · Taksitli satılmış, tahsilat SÜRÜYOR (${a.taksitte.length} parsel, medyan ${a.med_carpan_taksitte.toFixed(2)}x)</h2>
<div class="sub" style="margin:-2px 0 6px">Bu satırlarda kâr GERÇEKLEŞMEMİŞTİR — alıcı temerrüde düşerse tutar tahsil edilmez.</div>
<table><thead><tr><th>APN</th><th class="r">Dönüm</th><th class="r">Alım</th><th>Alım tarihi</th>
<th class="r">Sözleşme fiyatı</th><th class="r">Brüt fark</th><th class="r">Çarpan</th><th>Durum</th>
<th class="r">Taksitli toplam</th></tr></thead><tbody>
${a.taksitte.map(satir).join("\n")}</tbody></table>
${a.ilanda.length ? `<h2>C · Hâlâ satılık — SATILMAMIŞ (${a.ilanda.length} parsel)</h2>
<table><thead><tr><th>APN</th><th class="r">Dönüm</th><th class="r">Alım</th><th>Alım tarihi</th>
<th class="r">İstenen fiyat</th><th class="r">Potansiyel fark</th><th class="r">Çarpan</th><th>Durum</th>
<th class="r">Taksitli toplam</th></tr></thead><tbody>
${a.ilanda.map(satir).join("\n")}</tbody></table>` : ""}

<h2>Alınmış ama satılmamış (envanterde bekleyen) — ${a.envanter.length} parsel</h2>
<table><thead><tr><th>APN</th><th class="r">Dönüm</th><th class="r">Alım</th><th>Alım tarihi</th>
<th>Durum</th></tr></thead><tbody>
${a.envanter.map(env).join("\n")}</tbody></table>

<div class="note"><b>METODOLOJİ VE SINIRLAR — okumadan sayı kullanmayın</b>
1. <b style="display:inline">Paket tapular hariç tutuldu.</b> 87 tapunun ${a.paket_sayisi}'i tek tescil no altında birden çok
parsel içeriyor; county bedeli her satıra TOPLAM yazdığı için parsel başına pay ancak eşit-bölüşüm
varsayımıyla tahmin edilebilir — ve o varsayım yanlış. Dahil edilince medyan alım $8.900 (gerçekte $5.000),
medyan çarpan 1,53x (gerçekte ${a.med_carpan.toFixed(2)}x) çıkıyordu.<br>
2. <b style="display:inline">Satış fiyatı = kendi ilan sayfalarındaki fiyat</b>, tapuya kaydedilmiş satış bedeli değil.
Taksitli satışta tapu genellikle ödeme bitince devrolur.<br>
3. <b style="display:inline">"Servicing Retained"</b> = taksitli sözleşme devam ediyor; para henüz tamamen tahsil edilmedi.
Bu satırlarda "kâr" gerçekleşmiş değil, sözleşmeye bağlıdır.<br>
4. Yalnızca <b style="display:inline">Mohave County</b>. Başka county'lerdeki ekonomileri farklı olabilir.<br>
5. Brüt rakamlardır: kapanış, tapu, vergi, pazarlama ve temerrüt riski düşülmemiştir.</div>`;
}

async function main() {
  const rows = buildRows(J("rakip-tapu-sonuc.json"), J("rakip-ilan-fiyat.json"));
  const a = analyze(rows);
  const out = resolve(__dirname, "rakip-mohave-karlilik.pdf");
  const page = html(a, rows);
  writeFileSync(resolve(__dirname, "rakip-mohave-karlilik.html"), page);

  const puppeteer = (await import("puppeteer")).default;
  // Puppeteer'ın kendi Chromium'u indirilmemiş; sistemdeki Chrome kullanılır.
  const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await puppeteer.launch({
    headless: "new", args: ["--no-sandbox"],
    executablePath: existsSync(CHROME) ? CHROME : undefined,
  });
  const p = await browser.newPage();
  await p.setContent(page, { waitUntil: "load" });
  await p.pdf({ path: out, format: "A4", landscape: true, printBackground: true,
    margin: { top: "14mm", bottom: "14mm", left: "10mm", right: "10mm" } });
  await browser.close();

  console.log(`eşleşen ${a.eslesen.length} · envanter ${a.envanter.length} · ZARAR ${a.zarar.length} · başabaş ${a.basabas.length}`);
  console.log(`medyan: alım ${usd(a.med_alim)} → satış ${usd(a.med_sat)} · kâr ${usd(a.med_kar)} · ${a.med_carpan.toFixed(2)}x`);
  console.log(`toplam: alım ${usd(a.toplam_alim)} → satış ${usd(a.toplam_sat)}`);
  console.log(`\n✓ ${out}`);
}

if (process.argv[1]?.endsWith("rakip-rapor-pdf.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
