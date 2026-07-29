#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TUTARLILIK DENETÇİSİ — türetilmiş verinin bozulduğunu İNSAN değil SİSTEM bulsun.
//
//   node scraper/tutarlilik-kontrol.mjs          # rapor (çıkış 0/1)
//   node scraper/tutarlilik-kontrol.mjs --json   # makine okunur
//
// NEDEN VAR (2026-07-27): Veri zinciri şu:
//     comp → satış değeri (est_retail) → teklif (est_offer) → marj → not → harita
// Bir halkayı güncelleyince alttakiler BAYATLIYOR ama hiçbir şey uyarmıyordu.
// Aynı gün üç kez aynı hataya düşüldü:
//   • est_offer comp'a geçti, est_retail 2999 sabitinde kaldı → 45.321 lead'de
//     NEGATİF marj ("3.200'e al, 2.099'a sat")
//   • marj değişti ama not motoru çalıştırılmadı → notlar bayat
//   • UI'da Supabase satır tavanı sessizce kesti → 13.612 lead 655 göründü
// Bu dosya o hataların her birini KURAL haline getirir. Yeni bir hata bulunca
// buraya kural eklenir; bir daha sessizce geçmez.
//
// KURAL: her kontrol ya GEÇER ya KALIR — "muhtemelen iyidir" yok.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const JSON_OUT = process.argv.includes("--json");
const KURALLAR = [];

/** Kural tanımı. sorgu tek satır döndürmeli: { deger, detay? } */
function kural(ad, aciklama, sorgu, gecer, tavsiye) {
  KURALLAR.push({ ad, aciklama, sorgu, gecer, tavsiye });
}

// ── 1) MARJ ARİTMETİĞİ ───────────────────────────────────────────────────────
kural(
  "marj-aritmetigi",
  "est_margin, est_retail − est_offer'a eşit olmalı",
  `select count(*) deger from offmarket_leads
   where est_offer is not null and est_retail is not null and est_margin is not null
     and abs(est_margin - (est_retail - est_offer)) > 1`,
  (n) => n === 0,
  "teklif-motoru.mjs yeniden çalıştır (üçünü birlikte yazar)"
);

kural(
  "negatif-marj",
  "Teklifimiz satış değerinden büyük olamaz",
  `select count(*) deger from offmarket_leads
   where est_offer is not null and est_retail is not null and est_offer > est_retail`,
  (n) => n === 0,
  "est_retail ile est_offer AYNI kaynaktan gelmeli — teklif-motoru.mjs"
);

// ── 2) UYDURMA SABİT İZİ ─────────────────────────────────────────────────────
kural(
  "uydurma-sabit-2999",
  "est_retail 2999 sabitinden türetilmiş kayıt kalmamalı (comp'a geçildi)",
  `select count(*) deger from offmarket_leads
   where est_retail is not null and acres > 0
     and abs(est_retail - 2999 * least(greatest(acres, 0.7), 2)) < 1`,
  (n) => n === 0,
  "o county için comp topla (harvest-land-comps.mjs) veya fiyatsız bırak"
);

// ── 3) FİYAT ↔ DAYANAK ───────────────────────────────────────────────────────
kural(
  "dayanaksiz-teklif",
  "Comp modeli olmayan county×bantta teklif olmamalı",
  `select count(*) deger from offmarket_leads l
   where l.state = 'FL' and l.est_offer is not null and l.acres > 0
     and not exists (
       select 1 from offer_summary o
       where o.county = regexp_replace(l.county, '\\s+County.*$', '')
     )`,
  (n) => n === 0,
  "teklif-motoru.mjs — dayanağı olmayan lead fiyatsız bırakılmalı"
);

// ── 4) NOT TAZELİĞİ ──────────────────────────────────────────────────────────
kural(
  "not-tazeligi",
  "Fiyatı değişen lead'in notu da tazelenmiş olmalı (updated_at karşılaştırması)",
  `select count(*) deger from offmarket_leads
   where est_offer is not null and grade is not null
     and updated_at > coalesce((select max(built_at) from offer_summary), 'epoch')
     + interval '1 hour'`,
  (n) => n === 0,
  "grade-offmarket.mjs çalıştır (idempotent)"
);

kural(
  "notsuz-fiyatli",
  "Fiyatı olan lead notsuz kalmamalı",
  `select count(*) deger from offmarket_leads
   where est_offer is not null and grade is null and grade_reason is null`,
  (n) => n === 0,
  "grade-offmarket.mjs çalıştır"
);

// ── 5) DEĞERLEME KADEMESİ ────────────────────────────────────────────────────
kural(
  "karantina-sizintisi",
  "T3/T4 kademedeki county yatırım ekranına sızmamalı",
  `select count(*) deger from county_valuation
   where tier in ('T3','T4') and quarantine_reason is null`,
  (n) => n === 0,
  "build-county-valuation.mjs — karantina sebebi yazılmadan T3/T4 verilmemeli"
);

// ── 6) RAKİP PROFİLİ ─────────────────────────────────────────────────────────
kural(
  "rakip-profili-bayat",
  "competitor_profile, parcel_owners'tan sonra hesaplanmış olmalı",
  `select case when (select max(pulled_at) from parcel_owners)
                  > coalesce((select max(analyzed_at) from competitor_profile), 'epoch')
                    + interval '1 hour'
          then 1 else 0 end deger`,
  (n) => n === 0,
  "rakip-derin-analiz.mjs --write çalıştır"
);

// ── 7) COMP HAVUZU ───────────────────────────────────────────────────────────
kural(
  "comp-ureme-sinirlari",
  "Ürün bandı dışı $/dönüm comp'u yatırım tablosuna girmemeli",
  `select count(*) deger from county_valuation
   where tier in ('T1','T2') and (med_ppa > 250000 or med_ppa < 50)`,
  (n) => n === 0,
  "build-county-valuation.mjs PPA_MIN/PPA_MAX freni"
);

async function main() {
  const pool = new pg.Pool({ connectionString: dbUrl(), max: 3, keepAlive: true });
  pool.on("error", (e) => console.warn(`pg: ${e.message}`));

  const sonuc = [];
  for (const k of KURALLAR) {
    let deger = null, hata = null;
    try {
      const { rows } = await pool.query(k.sorgu);
      deger = Number(rows[0]?.deger ?? 0);
    } catch (e) {
      hata = String(e.message).slice(0, 120);
    }
    const gecti = hata ? null : k.gecer(deger);
    sonuc.push({ ad: k.ad, aciklama: k.aciklama, deger, gecti, hata, tavsiye: k.tavsiye });
  }
  await pool.end();

  if (JSON_OUT) {
    console.log(JSON.stringify({ sonuc, kalan: sonuc.filter((s) => s.gecti === false).length }, null, 1));
  } else {
    console.log("TUTARLILIK DENETİMİ\n");
    for (const s of sonuc) {
      const isaret = s.hata ? "⚠" : s.gecti ? "✓" : "✗";
      console.log(`${isaret} ${s.ad.padEnd(24)} ${s.hata ? `HATA: ${s.hata}` : `${s.deger} ihlal`}`);
      if (!s.gecti && !s.hata) {
        console.log(`   ${s.aciklama}`);
        console.log(`   → ${s.tavsiye}`);
      }
    }
    const kalan = sonuc.filter((s) => s.gecti === false).length;
    const hatali = sonuc.filter((s) => s.hata).length;
    console.log(`\n${sonuc.length - kalan - hatali}/${sonuc.length} kural geçti` +
      (kalan ? ` · ${kalan} İHLAL` : "") + (hatali ? ` · ${hatali} çalıştırılamadı` : ""));
  }
  process.exit(sonuc.some((s) => s.gecti === false) ? 1 : 0);
}

if (process.argv[1]?.endsWith("tutarlilik-kontrol.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
