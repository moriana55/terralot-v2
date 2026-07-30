#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// NOT MOTORU KALİBRASYONU — notu GERÇEKLEŞMİŞ SATIŞLARLA sınar.
//
//   node scraper/not-kalibrasyon.mjs          # ölç + grade_calibration'a yaz
//   node scraper/not-kalibrasyon.mjs --dry    # yalnız rapor
//
// SORU: A+/A dediğimiz parseller gerçekten B/C/D'den daha mı iyi, yoksa not
// motoru kendi kendine konuşan bir gürültü mü?
//
// YÖNTEM (uydurma yok, tek gerçek yer-doğrusu):
//   land_comps'ta 2024-25 arası GERÇEKLEŞMİŞ boş arsa satışları var. Bu
//   satışların APN'lerini offmarket_leads ile eşleştiriyoruz → "bizim notumuz
//   şuydu, parsel gerçekte şu fiyata satıldı" çifti. Yani not, kendi girdisiyle
//   değil, DIŞ bir sonuçla sınanıyor.
//
// ÖRNEKLEM SINIRI — DÜRÜSTÇE:
//   • land_comps yalnız FL + CO kapsıyor (25 eyaletin 2'si).
//   • CO DIŞARIDA: fiyat alanı county'ye göre sent/dolar karışık ve tek bir
//     toplu tapu fiyatı (ör. $7.212.000) onlarca parsele aynen yazılmış;
//     kol satışı ayıklaması güvenilir değil. APN eşleşmesi de 11 satır.
//   • FL'de yalnız DOR kalite kodu 01/02 (kol satışı) kullanılır. Kod 05
//     "birden çok parsel içeren satış" (medyan $1,9M) — piyasa değeri DEĞİL.
//   → Sonuçlar FL platlı arsa pazarı için geçerlidir; ülke geneline
//     genellenemez. A+/A örneklemi (n≈12) TEK BAŞINA eşik değiştirmeye YETMEZ.
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const DRY = process.argv.includes("--dry");

/** Kol satışı comp havuzu — APN normalize edilmiş, tek satır/parsel. */
export const COMP_CTE = `
  comps as (
    select state, regexp_replace(apn,'[^0-9A-Za-z]','','g') k,
           max(sale_price::float8) sp, max(acres::float8) ca
      from land_comps
     where state = 'FL' and qual_code in ('01','02')
       and sale_price > 1000 and acres > 0
     group by 1,2
  ),
  leads as (
    select lead_id, grade, grade_score, acres::float8 ac,
           (geo_enriched_at is not null) geo,
           regexp_replace(apn,'[^0-9A-Za-z]','','g') k
      from offmarket_leads where state = 'FL'
  ),
  eslesme as (
    select l.*, c.sp, c.ca from leads l left join comps c on c.k = l.k
  )`;

const SQL_BAND = `with ${COMP_CTE}
  select coalesce(grade,'N/A') anahtar, count(*) n_lead, count(sp) n_satis,
         round(100.0*count(sp)/nullif(count(*),0),2) satis_orani,
         percentile_cont(0.5) within group (order by sp) med_satis,
         round(avg(grade_score)::numeric,1) ort_skor,
         percentile_cont(0.5) within group (order by sp/nullif(ca,0)) med_ppa
    from eslesme group by 1 order by 1`;

const SQL_DESIL = `with ${COMP_CTE},
  satanlar as (select * from eslesme where sp is not null and grade_score is not null),
  d as (select *, ntile(10) over (order by grade_score) q from satanlar)
  select q::text anahtar, count(*) n_satis, min(grade_score) s_alt, max(grade_score) s_ust,
         percentile_cont(0.5) within group (order by sp) med_satis
    from d group by 1 order by min(grade_score)`;

const SQL_GEO = `with ${COMP_CTE}
  select case when geo then 'geo-dogrulanmis' else 'geo-bekliyor' end anahtar,
         count(*) n_lead, count(sp) n_satis,
         round(100.0*count(sp)/nullif(count(*),0),2) satis_orani,
         percentile_cont(0.5) within group (order by sp) med_satis,
         round(avg(grade_score)::numeric,1) ort_skor
    from eslesme group by 1 order by 1`;

// Spearman = sıra değerleri üzerinde Pearson. Skor ile gerçekleşen satış
// fiyatı arasındaki tekdüze ilişkinin gücü; 0 = gürültü, 1 = kusursuz sıralama.
const SQL_SPEARMAN = `with ${COMP_CTE},
  s as (select grade_score, sp from eslesme where sp is not null and grade_score is not null),
  r as (select rank() over (order by grade_score) rs, rank() over (order by sp) rp from s)
  select count(*) n, round(corr(rs, rp)::numeric, 3) spearman from r`;

// Geo taraması yapılmadığı için B tavanında kalan ama skoru kendi eyaletindeki
// en düşük A skorunu zaten aşan kayıtlar = "gizli A havuzu" (yanlış negatif).
const SQL_YANLIS_NEGATIF = `
  with a as (select state, min(grade_score) a_min from offmarket_leads where grade in ('A','A+') group by 1)
  select o.state anahtar, count(*) n_lead
    from offmarket_leads o join a on a.state = o.state
   where o.grade = 'B' and o.geo_enriched_at is null and o.grade_score >= a.a_min
   group by 1 order by 2 desc`;

const SQL_DAGILIM = `
  select coalesce(grade,'N/A') anahtar, count(*) n_lead,
         count(*) filter (where geo_enriched_at is not null) n_geo,
         round(avg(grade_score)::numeric,1) ort_skor,
         min(grade_score) s_alt, max(grade_score) s_ust
    from offmarket_leads group by 1 order by 1`;

const n0 = (v) => (v == null ? "-" : Math.round(Number(v)).toLocaleString("tr-TR"));
const usd = (v) => (v == null ? "-" : "$" + Math.round(Number(v)).toLocaleString("en-US"));

async function main() {
  const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await c.connect();

  const toplam = (await c.query("select count(*) n from offmarket_leads")).rows[0].n;
  console.log(`offmarket_leads satır: ${Number(toplam).toLocaleString("tr-TR")}\n`);

  const dagilim = (await c.query(SQL_DAGILIM)).rows;
  console.log("BAND DAĞILIMI (canlı)");
  console.log("  not      kayıt      geo   ort.skor   skor aralığı");
  for (const r of dagilim)
    console.log(`  ${r.anahtar.padEnd(5)}${n0(r.n_lead).padStart(10)}${n0(r.n_geo).padStart(9)}` +
      `${String(r.ort_skor ?? "-").padStart(11)}   ${r.s_alt ?? "-"} – ${r.s_ust ?? "-"}`);

  const band = (await c.query(SQL_BAND)).rows;
  console.log("\nBAND × GERÇEKLEŞEN SATIŞ (FL, kol satışı comp'ları)");
  console.log("  not    FL kayıt   satan   satış%   medyan satış   medyan $/dönüm  ort.skor");
  for (const r of band)
    console.log(`  ${r.anahtar.padEnd(5)}${n0(r.n_lead).padStart(10)}${n0(r.n_satis).padStart(8)}` +
      `${String(r.satis_orani ?? "-").padStart(9)}${usd(r.med_satis).padStart(15)}` +
      `${usd(r.med_ppa).padStart(17)}${String(r.ort_skor ?? "-").padStart(10)}`);

  const desil = (await c.query(SQL_DESIL)).rows;
  console.log("\nSKOR DESİLİ × MEDYAN GERÇEKLEŞEN SATIŞ (yalnız satan parseller)");
  for (const r of desil)
    console.log(`  D${r.anahtar.padStart(2)}  skor ${String(r.s_alt).padStart(4)}–${String(r.s_ust).padEnd(4)}` +
      `  n=${String(r.n_satis).padStart(4)}   ${usd(r.med_satis)}`);

  const sp = (await c.query(SQL_SPEARMAN)).rows[0];
  console.log(`\nSPEARMAN (skor ↔ gerçekleşen satış fiyatı): ρ = ${sp.spearman}  (n = ${n0(sp.n)})`);

  const geo = (await c.query(SQL_GEO)).rows;
  console.log("\nGEO TAVANI AYIRT EDİCİ Mİ (FL)");
  for (const r of geo)
    console.log(`  ${r.anahtar.padEnd(18)} kayıt=${n0(r.n_lead).padStart(7)} satan=${String(r.n_satis).padStart(5)}` +
      ` satış%=${String(r.satis_orani ?? "-").padStart(6)} medyan=${usd(r.med_satis).padStart(9)} ort.skor=${r.ort_skor ?? "-"}`);

  const yn = (await c.query(SQL_YANLIS_NEGATIF)).rows;
  const ynTop = yn.reduce((s, r) => s + Number(r.n_lead), 0);
  console.log(`\nYANLIŞ NEGATİF (geo beklediği için B'de duran, skoru A tabanını aşan): ${n0(ynTop)}`);
  for (const r of yn.slice(0, 8)) console.log(`  ${r.anahtar}  ${n0(r.n_lead)}`);

  if (DRY) { await c.end(); return; }

  await c.query(`
    create table if not exists grade_calibration (
      tur text not null, anahtar text not null,
      n_lead bigint, n_satis bigint, satis_orani numeric,
      med_satis numeric, ort_skor numeric, ek jsonb,
      built_at timestamptz default now(),
      primary key (tur, anahtar)
    )`);

  const yaz = async (tur, anahtar, r, ek = null) =>
    c.query(
      `insert into grade_calibration (tur,anahtar,n_lead,n_satis,satis_orani,med_satis,ort_skor,ek,built_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,now())
       on conflict (tur,anahtar) do update set n_lead=excluded.n_lead, n_satis=excluded.n_satis,
         satis_orani=excluded.satis_orani, med_satis=excluded.med_satis, ort_skor=excluded.ort_skor,
         ek=excluded.ek, built_at=now()`,
      [tur, anahtar, r.n_lead ?? null, r.n_satis ?? null, r.satis_orani ?? null,
       r.med_satis ?? null, r.ort_skor ?? null, ek]);

  for (const r of band) await yaz("band", r.anahtar, r, { med_ppa: r.med_ppa });
  for (const r of desil) await yaz("desil", r.anahtar, r, { s_alt: r.s_alt, s_ust: r.s_ust });
  for (const r of geo) await yaz("geo", r.anahtar, r);
  await yaz("ozet", "spearman", { n_satis: sp.n }, { spearman: Number(sp.spearman) });
  await yaz("ozet", "yanlis_negatif", { n_lead: ynTop }, { eyalet: yn.slice(0, 10) });
  await yaz("ozet", "kapsam", { n_lead: Number(toplam) }, {
    comp_eyalet: ["FL"],
    comp_dislanan: { CO: "fiyat ölçeği sent/dolar karışık + toplu tapu fiyatı parsellere kopyalanmış; APN eşleşmesi 11" },
    comp_kalite_kodu: ["01", "02"],
    not: "land_comps 25 eyaletin yalnız 2'sini kapsıyor; sonuç FL platlı arsa pazarı için geçerlidir",
  });

  console.log("\n✓ grade_calibration yazıldı (admin ekranı buradan canlı okur)");
  await c.end();
}

if (process.argv[1]?.endsWith("not-kalibrasyon.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
