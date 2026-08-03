#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ENVANTER ÖZETİ TAZELE — `offmarket_envanter_ozet_mv` materialized view'ı.
//
// NEDEN: /admin/off-market-envanter sayfası eyalet/county özetini bu view'dan
// okuyor. View hasat sonrası TAZELENMEDİĞİ için ekranda "585.191 lead · 21
// eyalet · 233 county" yazıyordu; gerçek 921.271 · 25 · 243. Yani sayfa,
// envanterin üçte birini yok sayıyordu.
//
// Bu betik yeni tablo/kolon YARATMAZ (DDL atmaz) — sadece mevcut view'ı
// yeniden hesaplar. Her hasat / not turundan sonra çalıştırılmalı.
//
// Çalıştır: node scraper/tazele-envanter-ozet.mjs
// ─────────────────────────────────────────────────────────────────────────────
import pg from "pg";
import { dbUrl } from "./grade-offmarket.mjs";

const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("set statement_timeout = 0");

const once = (await client.query(
  `select count(*)::int satir, count(distinct state)::int eyalet, sum(lead_sayisi)::int lead
   from offmarket_envanter_ozet_mv`
)).rows[0];
console.log(`önce : ${once.satir} satır · ${once.eyalet} eyalet · ${Number(once.lead).toLocaleString("en-US")} lead`);

console.log("tazeleniyor…");
const t0 = Date.now();
await client.query("refresh materialized view offmarket_envanter_ozet_mv");

const sonra = (await client.query(
  `select count(*)::int satir, count(distinct state)::int eyalet, sum(lead_sayisi)::int lead
   from offmarket_envanter_ozet_mv`
)).rows[0];
const gercek = (await client.query(
  `select count(*)::int lead, count(distinct state)::int eyalet,
          count(distinct state || '|' || county)::int county from offmarket_leads`
)).rows[0];
await client.end();

console.log(`sonra: ${sonra.satir} satır · ${sonra.eyalet} eyalet · ${Number(sonra.lead).toLocaleString("en-US")} lead  (${Math.round((Date.now() - t0) / 1000)} sn)`);
console.log(`gerçek tablo: ${gercek.county} county · ${gercek.eyalet} eyalet · ${Number(gercek.lead).toLocaleString("en-US")} lead`);
if (Number(sonra.lead) !== Number(gercek.lead)) {
  console.log("⚠ view ile tablo hâlâ uyuşmuyor — view tanımında filtre olabilir (sql/ altına bak).");
}
