// socrata-harvest deterministik id testleri (node --test).
// Kritik davranış: APN olsun/olmasın, aynı satır her koşuda AYNI id'yi almalı
// (idempotent upsert) ve satır SIRASI id'yi ETKİLEMEMELİ (eski `${dsId}-${idx}`
// fallback'i sıraya bağlıydı → gece refresh'inde id kayması yapıyordu).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rowKey, mapRow, buildMapper, detId } = require('./socrata-harvest');

const DS = 'abcd-1234';
const DOMAIN = 'data.example.gov';

// APN kolonu OLMAYAN örnek şema (value var → kullanılabilir satır).
const rowA = { owner_name: 'JOHN DOE', assessed_value: '12000', situs_address: '1 MAIN ST' };
const rowB = { owner_name: 'JANE ROE', assessed_value: '8000', situs_address: '2 OAK AVE' };

test('rowKey: aynı içerik → aynı anahtar; key sırası fark etmez', () => {
  assert.equal(rowKey(rowA), rowKey({ ...rowA }));
  // Aynı alanlar farklı insertion-order ile → yine aynı anahtar (sort'lu stringify).
  const shuffled = { situs_address: '1 MAIN ST', assessed_value: '12000', owner_name: 'JOHN DOE' };
  assert.equal(rowKey(rowA), rowKey(shuffled));
  assert.notEqual(rowKey(rowA), rowKey(rowB));
});

test('APN yokken id satır SIRASINDAN bağımsız (idempotent upsert)', () => {
  const m = buildMapper(rowA);
  assert.equal(m.apn, null); // bu şemada APN kolonu yok → fallback devrede
  const idsForward = [rowA, rowB].map((r) => mapRow(r, m, DOMAIN, 'TX', DS).id);
  const idsReversed = [rowB, rowA].map((r) => mapRow(r, m, DOMAIN, 'TX', DS).id);
  // Ters sırada bile her satır kendi id'sini korur.
  assert.deepEqual(new Set(idsForward), new Set(idsReversed));
  assert.equal(idsForward[0], idsReversed[1]);
  assert.equal(idsForward[1], idsReversed[0]);
});

test('APN varken id = detId(SOCRATA|domain|apn) — kaynak+parsel bazlı', () => {
  const row = { parcel_id: 'R123-456', assessed_value: '5000' };
  const m = buildMapper(row);
  assert.equal(m.apn, 'parcel_id');
  const out = mapRow(row, m, DOMAIN, 'TX', DS);
  assert.equal(out.apn, 'R123-456');
  assert.equal(out.id, detId(`SOCRATA|${DOMAIN}|R123-456`));
  // Aynı girdi ikinci koşuda da aynı id (deterministik).
  assert.equal(mapRow(row, m, DOMAIN, 'TX', DS).id, out.id);
});

test('detId: UUID formatında ve deterministik', () => {
  const a = detId('SOCRATA|x|1');
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(a, detId('SOCRATA|x|1'));
  assert.notEqual(a, detId('SOCRATA|x|2'));
});
