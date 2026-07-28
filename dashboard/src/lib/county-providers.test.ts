import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeArcGis, parseBirlesikAdres, buildArcGisWhere, clientFilter,
} from "@/lib/county-providers/arcgis";
import { normalizeRegrid, regridOzellikleri, cacheAnahtari } from "@/lib/county-providers/regrid";
import { COUNTY_REGISTRY, COUNTY_OPTIONS, REGISTRY_STATES } from "@/lib/county-registry";
import { mailable } from "@/lib/live-county-types";
import {
  HEDEF_EYALETLER, HEDEF_EYALET_KODLARI, HEDEF_SAYISI,
  TAKSIT_YASAK_EYALETLER, POSTA_ADRESI_OLMAYAN, hedef,
} from "@/lib/eyalet-hedefleri";
import type { ArcGisFieldMap, ArcGisSource } from "@/lib/county-providers/types";

// ─── Birleşik adres ayrıştırma ──────────────────────────────────────────────

test("parseBirlesikAdres: NM Valencia satır-sonu deseni", () => {
  const r = parseBirlesikAdres("PO BOX 38070 \nPHOENIX, AZ 85069");
  assert.equal(r.street, "PO BOX 38070");
  assert.equal(r.city, "PHOENIX");
  assert.equal(r.st, "AZ");
  assert.equal(r.zip, "85069");
});

test("parseBirlesikAdres: NC OneMap çok-boşluk deseni, zip ayrı parça", () => {
  const r = parseBirlesikAdres("304 WEST SUNSET ST     AHOSKIE, NC  27910");
  assert.equal(r.street, "304 WEST SUNSET ST");
  assert.equal(r.city, "AHOSKIE");
  assert.equal(r.st, "NC");
  assert.equal(r.zip, "27910");
});

test("parseBirlesikAdres: boş girdi çökmez", () => {
  assert.deepEqual(parseBirlesikAdres(null), { street: "", city: "", st: "", zip: "" });
});

// ─── ArcGIS normalize ───────────────────────────────────────────────────────

const temelMap: ArcGisFieldMap = {
  apn: ["APN", "ALT"],
  owner: ["O1", "O2"],
  mailAddress: ["A1", "A2"],
  mailCity: "CITY", mailState: "ST", mailZip: "ZIP",
  situs: ["S1", "S2"], situsJoin: ", ",
  useConst: "VACANT",
  acres: "AC",
  value: "VAL",
};

test("normalizeArcGis: temel eşleme + absentee hesabı", () => {
  const r = normalizeArcGis(
    { APN: "123", O1: "AYSE", O2: "MEHMET", A1: "PO BOX 5", CITY: "DALLAS", ST: "tx", ZIP: "75001", S1: "1 MAIN", S2: "MARFA", AC: 3.456, VAL: "1,200" },
    temelMap, "NM",
  );
  assert.ok(r);
  assert.equal(r.apn, "123");
  assert.equal(r.owner, "AYSE & MEHMET");
  assert.equal(r.mailing_state, "TX");
  assert.equal(r.situs, "1 MAIN, MARFA");
  assert.equal(r.acres, 3.46); // varsayılan 2 basamak
  assert.equal(r.land_value, 1200);
  assert.equal(r.absentee, true); // TX ≠ NM
});

test("normalizeArcGis: aynı eyaletse absentee false", () => {
  const r = normalizeArcGis({ APN: "1", O1: "X", A1: "Y", CITY: "SANTA FE", ST: "NM" }, temelMap, "NM");
  assert.equal(r?.absentee, false);
});

test("normalizeArcGis: sahip YOKSA kayıt üretilmez (mektup atılamaz)", () => {
  assert.equal(normalizeArcGis({ APN: "1", A1: "Y", CITY: "Z" }, temelMap, "NM"), null);
});

test("normalizeArcGis: posta adresi YOKSA kayıt üretilmez", () => {
  assert.equal(normalizeArcGis({ APN: "1", O1: "X", CITY: "Z" }, temelMap, "NM"), null);
});

test("normalizeArcGis: şehir YOKSA kayıt üretilmez", () => {
  assert.equal(normalizeArcGis({ APN: "1", O1: "X", A1: "Y" }, temelMap, "NM"), null);
});

test("normalizeArcGis: 'N/A' doldurmaları anlamsız sayılır", () => {
  assert.equal(normalizeArcGis({ APN: "1", O1: "X", A1: "N/A", CITY: "Z" }, temelMap, "NM"), null);
  const r = normalizeArcGis({ APN: "1", O1: "X", A1: "Y", CITY: "Z", S1: "N/A", S2: "MARFA" }, temelMap, "NM");
  assert.equal(r?.situs, "MARFA");
});

test("normalizeArcGis: APN ilk DOLU adaydan alınır", () => {
  const r = normalizeArcGis({ APN: "", ALT: "B9", O1: "X", A1: "Y", CITY: "Z" }, temelMap, "NM");
  assert.equal(r?.apn, "B9");
});

test("normalizeArcGis: shapeAreaSqft ft² → acre çevirir", () => {
  const f: ArcGisFieldMap = { ...temelMap, acres: "SQ", acresFrom: "shapeAreaSqft" };
  const r = normalizeArcGis({ APN: "1", O1: "X", A1: "Y", CITY: "Z", SQ: 43560 }, f, "NM");
  assert.equal(r?.acres, 1);
});

test("normalizeArcGis: acre 0 varsayılan olarak null, izin verilirse 0", () => {
  const a = normalizeArcGis({ APN: "1", O1: "X", A1: "Y", CITY: "Z", AC: 0 }, temelMap, "NM");
  assert.equal(a?.acres, null);
  const b = normalizeArcGis({ APN: "1", O1: "X", A1: "Y", CITY: "Z", AC: 0 }, { ...temelMap, acresAllowZero: true }, "NM");
  assert.equal(b?.acres, 0);
});

test("normalizeArcGis: değer alanı yoksa land_value null (uydurulmaz)", () => {
  const f: ArcGisFieldMap = { ...temelMap, value: undefined };
  const r = normalizeArcGis({ APN: "1", O1: "X", A1: "Y", CITY: "Z", VAL: 999 }, f, "NM");
  assert.equal(r?.land_value, null);
});

test("normalizeArcGis: 'CITY, ST' birleşik şehir alanı ayrıştırılır (NV Nye)", () => {
  const f: ArcGisFieldMap = { ...temelMap, mailState: undefined, mailCityHasState: true };
  const r = normalizeArcGis({ APN: "1", O1: "X", A1: "Y", CITY: "PAHRUMP, NV" }, f, "NV");
  assert.equal(r?.mailing_city, "PAHRUMP");
  assert.equal(r?.mailing_state, "NV");
  assert.equal(r?.absentee, false);
});

test("normalizeArcGis: şehir boşsa adres birleşik olarak ayrıştırılır (NC Northampton)", () => {
  const f: ArcGisFieldMap = { ...temelMap, mailCombinedFallback: true };
  const r = normalizeArcGis(
    { APN: "1", O1: "EAST COAST TIMBER LLC", A1: "304 WEST SUNSET ST     AHOSKIE, NC  27910", CITY: "", ST: "", ZIP: "" },
    f, "NC",
  );
  assert.equal(r?.mailing_address, "304 WEST SUNSET ST");
  assert.equal(r?.mailing_city, "AHOSKIE");
  assert.equal(r?.mailing_state, "NC");
  assert.equal(r?.mailing_zip, "27910");
  assert.equal(mailable(r!), true);
});

// ─── WHERE üretimi ──────────────────────────────────────────────────────────

const src: ArcGisSource = {
  kind: "arcgis", endpoint: "https://x/query", outFields: "a", orderBy: "a ASC",
  baseWhere: "imprv=0", fields: temelMap,
  searchFields: { owner: "O1", apn: "APN", mailState: "ST", value: "VAL" },
};

test("buildArcGisWhere: filtre yoksa yalnızca baseWhere", () => {
  assert.equal(buildArcGisWhere(src, {}), "imprv=0");
});

test("buildArcGisWhere: sahip/apn/eyalet/değer koşulları eklenir", () => {
  const w = buildArcGisWhere(src, { owner: "smith", apn: "99", mailingState: "tx", minValue: 500, maxValue: 9000 });
  assert.ok(w.includes("UPPER(O1) LIKE '%SMITH%'"));
  assert.ok(w.includes("APN LIKE '%99%'"));
  assert.ok(w.includes("UPPER(ST)='TX'"));
  assert.ok(w.includes("VAL>=500"));
  assert.ok(w.includes("VAL<=9000"));
});

test("buildArcGisWhere: tek tırnak kaçışlanır (SQL enjeksiyonu)", () => {
  const w = buildArcGisWhere(src, { owner: "O'BRIEN' OR 1=1--" });
  assert.ok(w.includes("O''BRIEN'' OR 1=1--"));
  assert.equal(w.split("'").length % 2, 1); // tırnaklar dengeli
});

test("buildArcGisWhere: sunucuda desteklenmeyen alan sessizce atlanır", () => {
  const s2: ArcGisSource = { ...src, searchFields: { owner: "O1" } };
  const w = buildArcGisWhere(s2, { mailingState: "TX", minValue: 100 });
  assert.equal(w, "imprv=0");
});

// ─── Client filtre ──────────────────────────────────────────────────────────

const satir = (o: Partial<ReturnType<typeof mkRow>>) => ({ ...mkRow(), ...o });
function mkRow() {
  return {
    apn: "1", owner: "X", mailing_address: "A", mailing_city: "C",
    mailing_state: "TX", mailing_zip: "75001", situs: "", use: "VACANT",
    acres: 1 as number | null, land_value: 1000 as number | null, absentee: false,
  };
}

test("clientFilter: posta eyaleti filtrelenir", () => {
  const rows = [satir({ mailing_state: "TX" }), satir({ mailing_state: "CA" })];
  assert.equal(clientFilter(rows, { mailingState: "ca" }).length, 1);
});

test("clientFilter: değeri BİLİNMEYEN kayıt fiyat filtresiyle elenmez", () => {
  const rows = [satir({ land_value: null }), satir({ land_value: 50_000 })];
  const out = clientFilter(rows, { maxValue: 5000 });
  assert.equal(out.length, 1);
  assert.equal(out[0].land_value, null);
});

// ─── Regrid normalize ───────────────────────────────────────────────────────

test("normalizeRegrid: standart Regrid alanlarını eşler", () => {
  const r = normalizeRegrid({
    parcelnumb: "R-1", owner: "JOHN DOE", mailadd: "PO BOX 1", mailcity: "RENO",
    mailstate2: "nv", mailzip: "89501", address: "1 DESERT RD", usedesc: "Vacant",
    ll_gisacre: 2.5, landval: 4000,
  }, "AZ");
  assert.equal(r?.apn, "R-1");
  assert.equal(r?.mailing_state, "NV");
  assert.equal(r?.acres, 2.5);
  assert.equal(r?.land_value, 4000);
  assert.equal(r?.absentee, true);
});

test("normalizeRegrid: sahip/adres eksikse kayıt üretilmez", () => {
  assert.equal(normalizeRegrid({ parcelnumb: "R-1", mailadd: "X", mailcity: "Y" }, "AZ"), null);
  assert.equal(normalizeRegrid({ parcelnumb: "R-1", owner: "D" }, "AZ"), null);
});

test("regridOzellikleri: iki sarmalayıcı biçimini de çözer", () => {
  assert.equal(regridOzellikleri({ parcels: { features: [{ properties: { fields: { owner: "A" } } }] } })[0].owner, "A");
  assert.equal(regridOzellikleri({ features: [{ properties: { owner: "B" } }] })[0].owner, "B");
  assert.deepEqual(regridOzellikleri(null), []);
});

test("cacheAnahtari: aynı sorgu aynı anahtar, farklı sorgu farklı", () => {
  const a = cacheAnahtari("/us/tx/hudspeth", { owner: "smith" }, 25);
  const b = cacheAnahtari("/us/tx/hudspeth", { owner: "SMITH " }, 25);
  const c = cacheAnahtari("/us/tx/hudspeth", { owner: "jones" }, 25);
  assert.equal(a, b); // normalize edilir → boşuna para harcanmaz
  assert.notEqual(a, c);
});

// ─── Kayıt defteri bütünlüğü ────────────────────────────────────────────────

test("kayıt defteri: her county'nin anahtarı benzersiz ve eyaletiyle tutarlı", () => {
  for (const [key, e] of Object.entries(COUNTY_REGISTRY)) {
    assert.ok(key.startsWith(e.state.toLowerCase() + "-"), `${key} → ${e.state} önekiyle başlamalı`);
    assert.ok(e.label.length > 0);
    assert.ok(e.leadIdPrefix.length > 0);
  }
});

test("kayıt defteri: ArcGIS kaynaklarının uç noktası /query ile biter", () => {
  for (const e of Object.values(COUNTY_REGISTRY)) {
    for (const s of e.sources) {
      if (s.kind === "arcgis") assert.ok(s.endpoint.endsWith("/query"), `${e.label}: ${s.endpoint}`);
    }
  }
});

test("kayıt defteri: hasValue true ise ArcGIS kaynağında değer alanı tanımlı", () => {
  for (const e of Object.values(COUNTY_REGISTRY)) {
    const arc = e.sources.find((s) => s.kind === "arcgis");
    if (e.hasValue && arc && arc.kind === "arcgis") {
      assert.ok(arc.fields.value, `${e.label}: hasValue=true ama değer alanı yok`);
    }
  }
});

test("kayıt defteri: 'calisiyor' işaretli county'nin gerçek bir kaynağı olmalı", () => {
  for (const e of Object.values(COUNTY_REGISTRY)) {
    if (e.bilinenDurum === "calisiyor") {
      assert.ok(e.sources.length > 0, `${e.label}: çalışıyor işaretli ama kaynağı yok`);
    }
  }
});

test("kayıt defteri: seçenek listesi ve eyalet listesi kayıtla aynı boyutta", () => {
  assert.equal(COUNTY_OPTIONS.length, Object.keys(COUNTY_REGISTRY).length);
  assert.equal(REGISTRY_STATES.length, new Set(COUNTY_OPTIONS.map((o) => o.state)).size);
  assert.deepEqual(REGISTRY_STATES, [...REGISTRY_STATES].sort());
});

// ─── Hedef 25 eyalet ────────────────────────────────────────────────────────

test("hedef listesi tam 25 eyalet ve kodlar benzersiz", () => {
  assert.equal(HEDEF_SAYISI, 25);
  assert.equal(HEDEF_EYALETLER.length, 25);
  assert.equal(new Set(HEDEF_EYALETLER.map((e) => e.kod)).size, 25);
});

test("İŞ KURALI: taksitli satış yasak eyaletler (NY) hedefte OLAMAZ", () => {
  for (const yasak of TAKSIT_YASAK_EYALETLER) {
    assert.equal(HEDEF_EYALET_KODLARI.includes(yasak), false, `${yasak} hedefte olmamalı`);
  }
  for (const e of HEDEF_EYALETLER) {
    assert.notEqual(e.installment, "yasak", `${e.kod} taksite kapalı, hedefte olmamalı`);
  }
});

test("her hedef eyaletin gerekçesi, county'leri ve kaynak notu dolu", () => {
  for (const e of HEDEF_EYALETLER) {
    assert.ok(e.gerekce.length > 10, `${e.kod}: gerekçe yok`);
    assert.ok(e.countyler.length > 0, `${e.kod}: hedef county yok`);
    assert.ok(e.kaynakNotu.length > 10, `${e.kod}: kaynak notu yok`);
  }
});

test("kayıt defterindeki her eyalet hedef listesinde olmalı (başıboş county yok)", () => {
  for (const s of REGISTRY_STATES) {
    assert.ok(HEDEF_EYALET_KODLARI.includes(s), `${s} kayıtta var ama hedef listesinde yok`);
  }
});

test("posta adresi olmayan eyaletler dürüstçe işaretli", () => {
  // Bu eyaletlerde ücretsiz kaynak sahibin posta adresini vermiyor → mektup atılamaz.
  for (const kod of POSTA_ADRESI_OLMAYAN) {
    assert.equal(hedef(kod)?.veriYolu, "posta-adresi-yok");
  }
});

// ─── mailable tanımı ────────────────────────────────────────────────────────

test("mailable: beş alanın hepsi dolu değilse false", () => {
  assert.equal(mailable(satir({})), true);
  assert.equal(mailable(satir({ mailing_zip: "" })), false);
  assert.equal(mailable(satir({ owner: "" })), false);
  assert.equal(mailable(satir({ mailing_city: "  " })), false);
});
