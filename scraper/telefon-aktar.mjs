#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TELEFON AKTARIMI — PropStream skip trace çıktısı → offmarket_leads.phone
//
//   node scraper/telefon-aktar.mjs ~/Downloads/propstream-export.csv
//   node scraper/telefon-aktar.mjs <dosya> --kuru      (yazmadan dener)
//
// NEDEN VAR: skip trace 4.060 kişide çalıştı ama sonuç sağlayıcının panelinde
// kaldı; bizim tablomuzun `phone` alanı boştu, dolayısıyla Sıcak Arama kuyruğu
// boş açılıyordu. "Telefonlar var" demek ile telefonların SİSTEMDE olması ayrı
// şeyler — bu betik ikisini birleştirir.
//
// EŞLEŞTİRME: PropStream çıktısında bizim lead_id'miz YOK. Elimizdeki ortak
// alan sahibin posta adresi; liste zaten (owner, mailing_address) tekilliğiyle
// üretilmişti (propstream-sade.mjs). Bu yüzden anahtar:
//
//     normalize(mailing_address) + mailing_zip(5) + soyadın ilk harfleri
//
// Soyad da anahtara girer çünkü aynı adreste birden fazla malik olabiliyor
// (eş, kardeş, tröst). Adres+zip tek başına onları birbirine karıştırırdı.
//
// SÜTUN ADLARI SABİT DEĞİL: PropStream dışa aktarımda "Phone 1", "Mobile",
// "Landline", "Email 1" gibi farklı başlıklar kullanabiliyor. Başlıklar elle
// yazılmaz — regex ile tanınır. (Bu dosyanın atası olan içe aktarma betiğinde
// başlık adı elle yazılmıştı ve tam da bu yüzden 1.817 kayıt boş girmişti.)
//
// GÜVENLİK: DOLU BİR TELEFONUN ÜZERİNE YAZILMAZ. Betik yalnız `phone` alanı
// boş olan satırları doldurur; ikinci numara varsa `phone2`ye yazar. Aynı
// dosya iki kez çalıştırılabilir, sayı şişmez.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const KURU = process.argv.includes("--kuru");
const DOSYA = process.argv.slice(2).find((a) => !a.startsWith("--"));

if (!DOSYA) {
  console.error("Kullanım: node scraper/telefon-aktar.mjs <export.csv> [--kuru]");
  process.exit(1);
}

/** RFC4180 — tırnak içindeki virgül ve çift tırnak kaçışını doğru okur. */
function csvOku(metin) {
  const satirlar = [];
  let alan = "";
  let satir = [];
  let tirnakta = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnakta) {
      if (c === '"') {
        if (metin[i + 1] === '"') { alan += '"'; i++; } else tirnakta = false;
      } else alan += c;
      continue;
    }
    if (c === '"') { tirnakta = true; continue; }
    if (c === ",") { satir.push(alan); alan = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && metin[i + 1] === "\n") i++;
      satir.push(alan); alan = "";
      if (satir.some((x) => x !== "")) satirlar.push(satir);
      satir = [];
      continue;
    }
    alan += c;
  }
  satir.push(alan);
  if (satir.some((x) => x !== "")) satirlar.push(satir);
  return satirlar;
}

/** Adres karşılaştırması için sadeleştirme — noktalama, kısaltma, fazla boşluk. */
const KISALTMA = {
  street: "st", str: "st", road: "rd", drive: "dr", avenue: "ave", lane: "ln",
  court: "ct", circle: "cir", boulevard: "blvd", highway: "hwy", place: "pl",
  parkway: "pkwy", terrace: "ter", trail: "trl", north: "n", south: "s",
  east: "e", west: "w", apartment: "apt", suite: "ste",
};
function adresAnahtar(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((k) => KISALTMA[k] ?? k)
    .join(" ")
    .trim();
}

/** ABD telefonu → 10 hane. Geçersizse null. */
function telefon(s) {
  const d = String(s ?? "").replace(/\D/g, "");
  const on = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (on.length !== 10) return null;
  if (/^(\d)\1{9}$/.test(on)) return null; // 0000000000 gibi çöp
  return on;
}

/** Başlıkları ADLARINA GÖRE DEĞİL, DESENİNE göre tanı. */
function sutunlar(baslik) {
  const bul = (re) => baslik.map((h, i) => [h, i]).filter(([h]) => re.test(h.toLowerCase())).map(([, i]) => i);
  return {
    soyad: bul(/^last\s*name$/)[0] ?? bul(/last.*name/)[0],
    adres: bul(/^mail(ing)?\s*(street\s*)?address$/)[0] ?? bul(/mail.*address/)[0],
    zip: bul(/^mail(ing)?\s*zip/)[0] ?? bul(/mail.*zip/)[0],
    // Telefon: "Phone 1..5", "Mobile", "Landline", "Wireless" — hepsi.
    telefonlar: bul(/(phone|mobile|landline|wireless|cell)/),
    epostalar: bul(/e-?mail/),
    dnc: bul(/dnc|do\s*not\s*call/),
  };
}

async function main() {
  const satirlar = csvOku(readFileSync(DOSYA, "utf8"));
  if (satirlar.length < 2) { console.error("Dosya boş."); process.exit(1); }

  const baslik = satirlar[0].map((h) => h.trim());
  const s = sutunlar(baslik);

  console.log("Tanınan sütunlar:");
  console.log(`  soyad  : ${s.soyad != null ? baslik[s.soyad] : "YOK"}`);
  console.log(`  adres  : ${s.adres != null ? baslik[s.adres] : "YOK"}`);
  console.log(`  zip    : ${s.zip != null ? baslik[s.zip] : "YOK"}`);
  console.log(`  telefon: ${s.telefonlar.map((i) => baslik[i]).join(", ") || "YOK"}`);
  console.log(`  eposta : ${s.epostalar.map((i) => baslik[i]).join(", ") || "YOK"}`);
  if (s.dnc.length) console.log(`  dnc    : ${s.dnc.map((i) => baslik[i]).join(", ")}`);

  if (s.adres == null || s.zip == null || !s.telefonlar.length) {
    console.error("\n✖ Zorunlu sütun bulunamadı (adres / zip / telefon). Dışa aktarımda bu alanlar seçili mi?");
    process.exit(1);
  }

  // ── CSV → anahtar → numaralar
  const csvKayit = new Map();
  for (const r of satirlar.slice(1)) {
    const adres = adresAnahtar(r[s.adres]);
    const zip = String(r[s.zip] ?? "").replace(/\D/g, "").slice(0, 5);
    const soyad = String(s.soyad != null ? r[s.soyad] : "").trim().toLowerCase().slice(0, 4);
    if (!adres || zip.length !== 5) continue;

    const tels = [...new Set(s.telefonlar.map((i) => telefon(r[i])).filter(Boolean))];
    const mails = [...new Set(s.epostalar.map((i) => String(r[i] ?? "").trim()).filter((x) => x.includes("@")))];
    if (!tels.length && !mails.length) continue;

    csvKayit.set(`${adres}|${zip}|${soyad}`, { tels, mails });
  }
  console.log(`\nCSV: ${satirlar.length - 1} satır → ${csvKayit.size} eşleştirilebilir kayıt`);

  // ── DB tarafı: telefonu BOŞ olan, posta adresi dolu satırlar
  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();
  await db.query("set statement_timeout = 0");

  const { rows } = await db.query(
    `select lead_id, owner, mailing_address, mailing_zip
       from offmarket_leads
      where (phone is null or phone = '')
        and mailing_address is not null and mailing_address <> ''
        and mailing_zip is not null and mailing_zip <> ''`,
  );
  console.log(`DB : ${rows.length.toLocaleString("tr-TR")} telefonsuz aday satır`);

  const guncelle = [];
  for (const r of rows) {
    const adres = adresAnahtar(r.mailing_address);
    const zip = String(r.mailing_zip).replace(/\D/g, "").slice(0, 5);
    // Sahip adı "SOYAD, AD" ya da "AD SOYAD" gelebiliyor; ikisini de dene.
    const parcalar = String(r.owner ?? "").toLowerCase().split(/[,\s]+/).filter(Boolean);
    const adaylar = [...new Set([parcalar[0]?.slice(0, 4), parcalar[parcalar.length - 1]?.slice(0, 4)].filter(Boolean))];

    for (const soyad of adaylar) {
      const bulunan = csvKayit.get(`${adres}|${zip}|${soyad}`);
      if (bulunan) { guncelle.push({ lead_id: r.lead_id, ...bulunan }); break; }
    }
  }

  console.log(`\nEşleşen: ${guncelle.length.toLocaleString("tr-TR")} satır`);
  if (guncelle.length) {
    const o = guncelle[0];
    console.log(`  örnek → ${o.lead_id} · ${o.tels.join(", ")}${o.mails.length ? " · " + o.mails[0] : ""}`);
  }

  if (KURU) { console.log("\n(--kuru: hiçbir şey yazılmadı)"); await db.end(); return; }
  if (!guncelle.length) { console.log("\nYazılacak bir şey yok."); await db.end(); return; }

  // ── Yazma: parça parça, dolu telefonun üzerine YAZMADAN
  let yazilan = 0;
  const PARCA = 500;
  for (let i = 0; i < guncelle.length; i += PARCA) {
    const dilim = guncelle.slice(i, i + PARCA);
    const r = await db.query(
      `update offmarket_leads t
          set phone  = coalesce(nullif(t.phone, ''),  v.p1),
              phone2 = coalesce(nullif(t.phone2, ''), v.p2)
         from (select * from unnest($1::text[], $2::text[], $3::text[]) as x(lead_id, p1, p2)) v
        where t.lead_id = v.lead_id`,
      [
        dilim.map((x) => x.lead_id),
        dilim.map((x) => x.tels[0] ?? null),
        dilim.map((x) => x.tels[1] ?? null),
      ],
    );
    yazilan += r.rowCount;
    process.stdout.write(`\r  yazıldı: ${yazilan.toLocaleString("tr-TR")}/${guncelle.length.toLocaleString("tr-TR")}`);
  }

  const { rows: son } = await db.query(
    `select count(*) filter (where phone is not null and phone <> '')::int telefonlu,
            count(*) filter (where phone is not null and phone <> '' and grade in ('A+','A'))::int telefonlu_ust
       from offmarket_leads`,
  );
  console.log(`\n\n✔ Bitti. Telefonu olan parsel: ${son[0].telefonlu.toLocaleString("tr-TR")} (A+/A: ${son[0].telefonlu_ust.toLocaleString("tr-TR")})`);
  console.log("  Sıcak Arama ekranı artık dolu açılacak: /admin/arama");

  await db.end();
}

await main();
