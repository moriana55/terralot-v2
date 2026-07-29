#!/usr/bin/env node
/**
 * BİRİKİMLİ "İNCELENEN PARSEL" SAYACI
 *
 * Neden var: /admin/eleme-hunisi ekranı yatırımcıya "kaç parsel incelendi"
 * diyor. Bu sayı TEK bir hasat turunun logundan okunursa her turda SIFIRLANIR
 * ve log döngüsü eski dosyaları sildiğinde tarih kaybolur. Bu betik her turda
 * `scraper/logs/filtreli-hasat-*.json` çıktılarını okuyup kalıcı bir deftere
 * ekler; defter panelin okuduğu dosyadır:
 *
 *     dashboard/public/hasat-birikim.json
 *
 * TEKİLLİK ANAHTARI = log dosyasının adı. Aynı log ikinci kez işlenirse kayıt
 * ÜZERİNE yazılır, toplamlar ŞİŞMEZ (idempotent). Betik istediğin kadar
 * çalıştırılabilir.
 *
 * Bu dosya sadece BİRLEŞTİRİR; toplama/yüzdeleme panelde
 * `dashboard/src/lib/eleme-hunisi.ts` içinde yapılır ve orada test edilir
 * (`eleme-hunisi.test.ts`). Şema değişirse iki tarafı birlikte güncelle.
 *
 * Kullanım:
 *   node birikim-guncelle.mjs            # tüm filtreli-hasat loglarını işle
 *   node birikim-guncelle.mjs --rapor    # yazmadan özet bas
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOK = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIZIN = path.join(KOK, "logs");
const DEFTER = path.join(KOK, "..", "dashboard", "public", "hasat-birikim.json");
const SADECE_RAPOR = process.argv.includes("--rapor");

/** Sayı gibi görünmeyen / negatif her şey 0. Tahmin üretilmez. */
function sayi(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** filtreli-hasat log dosyasını defter kaydına çevirir (eyalet bloğu yoksa null). */
function logdanTur(log, kaynak) {
  const blok = log?.eyalet;
  if (!blok || typeof blok !== "object") return null;
  const eyaletler = [];
  let aday = 0;
  let yazilan = 0;
  const elenen = {};
  for (const [st, v] of Object.entries(blok)) {
    if (!st) continue;
    eyaletler.push(st.toUpperCase());
    aday += sayi(v?.aday);
    yazilan += sayi(v?.yazilan);
    for (const [k, n] of Object.entries(v?.elenen ?? {})) elenen[k] = (elenen[k] ?? 0) + sayi(n);
  }
  if (!eyaletler.length) return null;
  return {
    kaynak,
    baslangic: log?.baslangic ?? null,
    bitis: log?.bitis ?? null,
    eyaletler: eyaletler.sort(),
    aday,
    yazilan,
    elenen,
  };
}

function defterOku() {
  try {
    return JSON.parse(readFileSync(DEFTER, "utf8"));
  } catch {
    return { surum: 1, guncelleme: null, turlar: [] };
  }
}

function main() {
  if (!existsSync(LOG_DIZIN)) {
    console.log("birikim: logs/ dizini yok — yapacak iş yok.");
    return;
  }

  const dosyalar = readdirSync(LOG_DIZIN)
    .filter((f) => /^filtreli-hasat-.*\.json$/.test(f))
    .sort();

  const mevcut = defterOku();
  const map = new Map((mevcut.turlar ?? []).filter((t) => t?.kaynak).map((t) => [t.kaynak, t]));
  const oncekiSayi = map.size;

  let okunan = 0;
  for (const f of dosyalar) {
    let log;
    try {
      log = JSON.parse(readFileSync(path.join(LOG_DIZIN, f), "utf8"));
    } catch (e) {
      console.warn(`birikim: ${f} okunamadı — atlandı (${e.message})`);
      continue;
    }
    const t = logdanTur(log, f);
    if (!t) continue;
    map.set(t.kaynak, t); // aynı ad → üzerine yaz, TOPLAM ŞİŞMEZ
    okunan++;
  }

  const turlar = [...map.values()].sort((a, b) => {
    const av = new Date(a.bitis ?? a.baslangic ?? 0).getTime() || 0;
    const bv = new Date(b.bitis ?? b.baslangic ?? 0).getTime() || 0;
    return av - bv || a.kaynak.localeCompare(b.kaynak);
  });

  const toplamAday = turlar.reduce((s, t) => s + t.aday, 0);
  const toplamYazilan = turlar.reduce((s, t) => s + t.yazilan, 0);
  const eyaletler = [...new Set(turlar.flatMap((t) => t.eyaletler))].sort();

  console.log(
    `birikim: ${okunan} log okundu · defter ${oncekiSayi} → ${turlar.length} tur · ` +
      `incelenen=${toplamAday.toLocaleString("tr-TR")} uygun=${toplamYazilan.toLocaleString("tr-TR")} ` +
      `eyalet=${eyaletler.length} [${eyaletler.join(",")}]`
  );

  if (SADECE_RAPOR) {
    console.log("birikim: --rapor modu — dosya YAZILMADI.");
    return;
  }

  mkdirSync(path.dirname(DEFTER), { recursive: true });
  writeFileSync(
    DEFTER,
    JSON.stringify({ surum: 1, guncelleme: new Date().toISOString(), turlar }, null, 2)
  );
  console.log(`birikim: yazıldı → ${DEFTER}`);
}

main();
