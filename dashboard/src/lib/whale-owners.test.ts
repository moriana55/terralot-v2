import { test } from "node:test";
import assert from "node:assert/strict";
import { isCorporateOrWhaleOwner } from "./whale-owners";

test("gerçek şahıs owner → kurumsal DEĞİL", () => {
  assert.equal(isCorporateOrWhaleOwner("BOURN THOMAS L", "1 MAIN ST"), false);
  assert.equal(isCorporateOrWhaleOwner("SMITH JOHN & JANE", "123 OAK AVE"), false);
});

test("LLC/TRUST/HOLDINGS gibi anahtar kelimeler → kurumsal", () => {
  assert.equal(isCorporateOrWhaleOwner("REDPOINT HOLDINGS LLC", "20 ANY ST"), true);
  assert.equal(isCorporateOrWhaleOwner("SMITH FAMILY TRUST", "20 ANY ST"), true);
  assert.equal(isCorporateOrWhaleOwner("ACME PROPERTIES INC", "20 ANY ST"), true);
});

test("bilinen balina/gizli-ağ posta kutusu → owner adı alakasız olsa da kurumsal", () => {
  // Aileron ağı (3141 Beach View Ct) — gerçek örnek: APN 329-07-086.
  assert.equal(isCorporateOrWhaleOwner("REDPOINT HOLDINGS LLC", "3141 BEACH VIEW CT"), true);
  // Owner adı KEYWORD içermese bile aynı gizli-ağ kutusu → kurumsal.
  assert.equal(isCorporateOrWhaleOwner("JOHN Q RANDOMNAME", "806 BUCHANAN BLVD STE 115 BOX 298"), true);
  // Discount Lots / WP RE ailesi adresi (450 Anthony Trl, Northbrook IL).
  assert.equal(isCorporateOrWhaleOwner("SOME SERIES LLC 12", "450 ANTHONY TRL"), true);
});

test("bilinen balina owner ön-eki (adres olmasa da) → kurumsal", () => {
  assert.equal(isCorporateOrWhaleOwner("1D LLC", ""), true);
  assert.equal(isCorporateOrWhaleOwner("WESTERN LAND & RANCHES LLC", undefined), true);
});
