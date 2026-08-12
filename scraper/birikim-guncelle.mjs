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

/**
 * Log'un county kırılımını "kapsam" kayıtlarına çevirir.
 *
 * NEDEN VAR (2026-08-12): defterin tekillik anahtarı log DOSYA ADI idi, dosya
 * adında tarih olduğu için aynı 7 eyalet her gece yeniden sayılıyordu —
 * "incelenen parsel" 989 binken ekranda 3,5 milyon görünüyordu. Gerçek iş
 * COUNTY başına ölçülür: bir county'yi 10 gece üst üste taramak 10 kat parsel
 * incelemek değildir, aynı county'nin GÜNCEL halini görmektir.
 *
 * Bu yüzden her county için YALNIZCA EN SON gözlem tutulur. Toplam = son
 * gözlemlerin toplamı. Doğrulandı: her logda county toplamı eyalet toplamına
 * birebir eşit, yani kırılım kapsamı eksiksiz.
 */
function logdanKapsam(log, kaynak) {
  const liste = Array.isArray(log?.county) ? log.county : [];
  const zaman = log?.bitis ?? log?.baslangic ?? null;
  const kayitlar = [];
  for (const c of liste) {
    const key = typeof c?.key === "string" ? c.key.trim().toLowerCase() : "";
    if (!key) continue;
    kayitlar.push({
      key,
      eyalet: (key.split("-")[0] ?? "").toUpperCase(),
      kaynak,
      zaman,
      aday: sayi(c?.aday),
      yazilan: sayi(c?.yazilan),
      elenen: Object.fromEntries(
        Object.entries(c?.elenen ?? {}).map(([k, n]) => [k, sayi(n)])
      ),
    });
  }
  return kayitlar;
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
  // county anahtarı → EN SON gözlem (bkz. logdanKapsam açıklaması)
  const kapsamMap = new Map(
    (mevcut.kapsam ?? []).filter((k) => k?.key).map((k) => [k.key, k])
  );

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
    for (const k of logdanKapsam(log, f)) {
      const eski = kapsamMap.get(k.key);
      // Zamanı olmayan eski kayıt varsa yenisi kazanır; ikisi de zamanlıysa en yeni.
      if (!eski || String(k.zaman ?? "") >= String(eski.zaman ?? "")) kapsamMap.set(k.key, k);
    }
    okunan++;
  }

  const turlar = [...map.values()].sort((a, b) => {
    const av = new Date(a.bitis ?? a.baslangic ?? 0).getTime() || 0;
    const bv = new Date(b.bitis ?? b.baslangic ?? 0).getTime() || 0;
    return av - bv || a.kaynak.localeCompare(b.kaynak);
  });

  const kapsam = [...kapsamMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  // GERÇEK (tekilleştirilmiş) iş: county başına son gözlemlerin toplamı.
  const toplamAday = kapsam.reduce((s, k) => s + k.aday, 0);
  const toplamYazilan = kapsam.reduce((s, k) => s + k.yazilan, 0);
  // Tur toplamı SADECE karşılaştırma için — ekranda kullanılmaz (tekrarlı sayar).
  const turAday = turlar.reduce((s, t) => s + t.aday, 0);
  const eyaletler = [...new Set(turlar.flatMap((t) => t.eyaletler))].sort();

  console.log(
    `birikim: ${okunan} log okundu · defter ${oncekiSayi} → ${turlar.length} tur · ` +
      `county=${kapsam.length} · incelenen=${toplamAday.toLocaleString("tr-TR")} ` +
      `uygun=${toplamYazilan.toLocaleString("tr-TR")} eyalet=${eyaletler.length} [${eyaletler.join(",")}]`
  );
  if (turAday > toplamAday) {
    console.log(
      `birikim: tur toplamı ${turAday.toLocaleString("tr-TR")} — aynı county'nin ` +
        `tekrar taranmasından gelen ${(turAday - toplamAday).toLocaleString("tr-TR")} fazlalık ekrana YAZILMIYOR.`
    );
  }

  if (SADECE_RAPOR) {
    console.log("birikim: --rapor modu — dosya YAZILMADI.");
    return;
  }

  mkdirSync(path.dirname(DEFTER), { recursive: true });
  writeFileSync(
    DEFTER,
    JSON.stringify(
      { surum: 2, guncelleme: new Date().toISOString(), kapsam, turlar },
      null,
      2
    )
  );
  console.log(`birikim: yazıldı → ${DEFTER}`);
}

main();
