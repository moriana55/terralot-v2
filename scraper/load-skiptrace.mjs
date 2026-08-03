#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SKIP-TRACE SONUCU YÜKLE — sağlayıcıdan dönen telefon/e-postayı offmarket_leads'e yazar.
// Girdi: XLSX veya CSV (PropStream · BatchData · Skip Genie · REISkip fark etmez).
//
// ⚠ ÖNCE: scraper/sql/add_contact_cols.sql çalıştırılmış olmalı
//   (phone1 / phone2 / email1 / skiptraced kolonları).
//
// ── EŞLEŞTİRME — 2026-08-03'te DÜZELTİLDİ ───────────────────────────────────
// Eski sürüm kaydı `EYALET-APN` diye arıyordu. Gerçek lead_id'lerimiz
// `EYALET-COUNTY-APN` biçiminde: 921.271 kaydın yalnız 20.157'si (%2) eski
// kalıba uyuyordu. Üstelik Supabase'de EŞLEŞMEYEN update HATA DÖNDÜRMEZ →
// betik "✅ güncellendi" yazıp aslında hiçbir şey yazmıyordu (sessiz
// başarısızlık; elimizde 29 skip-traced kayıt kalmasının sebebi buydu).
//
// Şimdi iki kademeli eşleşme var ve eşleşmeyen satırlar SAYILIP raporlanıyor:
//   1) LeadId sütunu — `export-skiptrace-listesi.mjs` bunu yazar; sağlayıcı
//      gidiş-dönüşte koruduysa birebir ve en güvenilir yol.
//   2) state + apn   — sağlayıcı LeadId'yi düşürdüyse (APN county içinde tekil).
//   Hiçbiri tutmazsa satır ATLANIR ve loglanır — uydurma eşleşme yapılmaz.
//
// Çalıştır:  node scraper/load-skiptrace.mjs <dosya.xlsx|csv>
//            KURU=1 node scraper/load-skiptrace.mjs <dosya>   (yazmadan dene)
// ─────────────────────────────────────────────────────────────────────────────
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2];
const KURU = process.env.KURU === "1";
if (!FILE) {
  console.error("kullanım: node scraper/load-skiptrace.mjs <dosya.xlsx|csv>");
  process.exit(1);
}

const env = readFileSync(resolve(HERE, "../dashboard/.env.local"), "utf8");
const g = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.replace(/^"|"$/g, "");
const supa = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// XLSX/CSV → JSON. Sağlayıcılar kolon adlarını farklı yazdığı için hepsi denenir.
const py = `
import json, sys, csv, os
FILE = ${JSON.stringify(FILE)}
if os.path.splitext(FILE)[1].lower() in (".csv", ".txt"):
    with open(FILE, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
else:
    import openpyxl
    wb = openpyxl.load_workbook(FILE, data_only=True); ws = wb.active
    rows = [list(r) for r in ws.iter_rows(values_only=True)]

hdr = [str(c).strip() if c is not None else "" for c in rows[0]]
idx = {h.lower(): i for i, h in enumerate(hdr)}

def g(r, *names):
    for n in names:
        i = idx.get(n.lower())
        if i is not None and i < len(r) and r[i] is not None:
            v = str(r[i]).strip()
            if v and v.lower() != "none":
                return v
    return ""

out = []
for r in rows[1:]:
    if not any(x is not None and str(x).strip() for x in r):
        continue
    ph = [g(r, "Phone %d" % i, "Phone%d" % i, "phone_%d" % i, "Mobile %d" % i) for i in range(1, 6)]
    ph = [p for p in ph if p]
    em = [g(r, "Email %d" % i, "Email%d" % i, "email_%d" % i) for i in range(1, 5)]
    em = [e for e in em if e]
    out.append({
        "lead_id": g(r, "LeadId", "Lead Id", "lead_id"),
        "state":   g(r, "Property State", "State", "property_state")[:2].upper(),
        "apn":     g(r, "APN", "Parcel Number", "ParcelNum", "parcel_id"),
        "phone1":  ph[0] if ph else None,
        "phone2":  ph[1] if len(ph) > 1 else None,
        "email1":  em[0] if em else None,
        "skiptraced": bool(ph or em),
    })
json.dump(out, sys.stdout)
`;

// Betiği -c ile geçirmiyoruz: kabuk çift tırnak içindeki "\n" kaçışlarını
// olduğu gibi bırakıyor ve Python bunu satır devamı sanıp sözdizimi hatası
// veriyor. Geçici dosyaya yazıp öyle çalıştırmak bu sınıf hatayı tamamen kaldırır.
const gecici = resolve(tmpdir(), `terralot-skiptrace-${process.pid}.py`);
writeFileSync(gecici, py);
let recs;
try {
  recs = JSON.parse(execSync(`python3 ${JSON.stringify(gecici)}`, { encoding: "utf8", maxBuffer: 1 << 28 }));
} finally {
  try { rmSync(gecici, { force: true }); } catch {}
}
const dolu = recs.filter((r) => r.skiptraced);
console.log(`${recs.length.toLocaleString("en-US")} satır okundu · telefon/e-posta dolu: ${dolu.length.toLocaleString("en-US")}`);
if (!dolu.length) { console.log("yazılacak bir şey yok."); process.exit(0); }

// LeadId gelmeyen satırlar için state+apn haritası (tek tek sorgu yerine toplu çek).
const apnGerek = dolu.filter((r) => !r.lead_id && r.state && r.apn);
const apnHarita = new Map();
if (apnGerek.length) {
  console.log(`${apnGerek.length.toLocaleString("en-US")} satırda LeadId yok → state+apn ile aranıyor…`);
  for (const st of [...new Set(apnGerek.map((r) => r.state))]) {
    let from = 0;
    for (;;) {
      const { data, error } = await supa
        .from("offmarket_leads").select("lead_id, apn").eq("state", st).range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      for (const d of data) apnHarita.set(`${st}|${String(d.apn).trim().toUpperCase()}`, d.lead_id);
      if (data.length < 1000) break;
      from += 1000;
    }
  }
}

const yazilacak = [];
const eslesmeyen = [];
for (const r of dolu) {
  const id = r.lead_id || apnHarita.get(`${r.state}|${String(r.apn).trim().toUpperCase()}`);
  if (!id) { eslesmeyen.push(r); continue; }
  yazilacak.push({ ...r, lead_id: id });
}
console.log(`eşleşen: ${yazilacak.length.toLocaleString("en-US")} · EŞLEŞMEYEN: ${eslesmeyen.length.toLocaleString("en-US")}`);

if (eslesmeyen.length) {
  const dir = resolve(HERE, "out");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const log = resolve(dir, `skiptrace-eslesmeyen-${eslesmeyen.length}.json`);
  writeFileSync(log, JSON.stringify(eslesmeyen.slice(0, 500), null, 1));
  console.log(`  ilk 500 örneği: ${log}`);
}
if (KURU) { console.log("KURU=1 — yazılmadı."); process.exit(0); }

// count:"exact" ile DÖNEN satır sayısını sayıyoruz. Sağlayıcı LeadId sütununu
// bozduysa (ya da elle düzenlenmiş bir dosya geldiyse) update sessizce 0 satır
// günceller; bunu "yazıldı" saymak eski sürümün hatasıydı — ayrı raporlanır.
let ok = 0, hata = 0, bulunamayan = 0;
for (const r of yazilacak) {
  const { error, count } = await supa
    .from("offmarket_leads")
    .update({ phone1: r.phone1, phone2: r.phone2, email1: r.email1, skiptraced: true }, { count: "exact" })
    .eq("lead_id", r.lead_id);
  if (error) {
    if (/column .* does not exist|Could not find/i.test(error.message)) {
      console.error("\n❌ Kolonlar yok — önce scraper/sql/add_contact_cols.sql çalıştır (Supabase SQL Editor).");
      process.exit(2);
    }
    hata++;
  } else if ((count ?? 0) > 0) ok += count;
  else bulunamayan++;
  if ((ok + hata) % 2000 === 0 && ok + hata > 0) console.log(`  ${ok.toLocaleString("en-US")} yazıldı…`);
}

console.log(`\n✔ ${ok.toLocaleString("en-US")} kayda telefon/e-posta yazıldı${hata ? ` · ${hata} hata` : ""}.`);
if (bulunamayan) {
  console.log(`⚠ ${bulunamayan.toLocaleString("en-US")} satırın LeadId'si veritabanında YOK — dosyadaki kimlik bozulmuş.`);
}
if (eslesmeyen.length) {
  console.log(`⚠ ${eslesmeyen.length.toLocaleString("en-US")} satır hiç eşleşmedi — sağlayıcı APN/LeadId sütununu düşürmüş olabilir.`);
}
const basarili = ok;
const beklenen = dolu.length;
console.log(`özet: ${beklenen.toLocaleString("en-US")} telefonlu satırdan ${basarili.toLocaleString("en-US")} tanesi kayda bağlandı (%${Math.round((basarili / beklenen) * 100)}).`);
