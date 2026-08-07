// Pazaryeri hasadı — SAF çözümleyici testleri (ağ/DB yok).
// Koşu: node --test scraper/pazaryeri-hasat.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { sayfaCoz, eyaletKodu } from "./pazaryeri-hasat.mjs";

/** Gerçek sayfanın iskeleti: __NEXT_DATA__ + altta similarProperties tuzağı. */
const sayfa = (pageProps, benzerler = []) =>
  `<html><body><div>içerik</div>` +
  `<script id="__NEXT_DATA__" type="application/json">` +
  JSON.stringify({ props: { pageProps: { ...pageProps, similarProperties: benzerler } } }) +
  `</script></body></html>`;

test("eyalet: tam ad ve iki harfli kod çözülür", () => {
  assert.equal(eyaletKodu("Michigan"), "MI");
  assert.equal(eyaletKodu("new mexico"), "NM");
  assert.equal(eyaletKodu("New-Mexico"), "NM");
  assert.equal(eyaletKodu("PA"), "PA");
  assert.equal(eyaletKodu("Atlantis"), null);
  assert.equal(eyaletKodu("ZZ"), null);
  assert.equal(eyaletKodu(null), null);
});

test("sayfa: fiyat, county, eyalet, acre, koordinat çözülür", () => {
  const h = sayfa({
    id: 171, title: "39.61 Acres Humboldt County, NV - L07362", price: 20799,
    acres: 39.61, county: "Humboldt County", state: "Nevada",
    latitude: "40.9729584", longitude: "-117.7356849",
  });
  assert.deepEqual(sayfaCoz(h), {
    state: "NV", county: "Humboldt", acres: 39.61, price: 20799,
    title: "39.61 Acres Humboldt County, NV - L07362",
    lat: 40.9729584, lng: -117.7356849,
  });
});

test("acre alanı boşsa İLANIN BAŞLIĞINDAN okunur", () => {
  const h = sayfa({
    id: 33, title: "Michigan, Antrim County, 0.49 Acres, Lot 397", price: 4923,
    acres: null, county: "Antrim County", state: "Michigan",
    latitude: "44.942194", longitude: "-84.867806",
  });
  const r = sayfaCoz(h);
  assert.equal(r.acres, 0.49);
  assert.equal(r.county, "Antrim");
});

test("similarProperties acre'i ANA İLANIN acre'i sanılmaz (regex tuzağı)", () => {
  // Canlı hata buydu: 0,49 acre'lik ilana benzer ilanların 47,63'ü yazılıyordu.
  const h = sayfa(
    { id: 33, title: "Lot 397", price: 4923, acres: 0.49, county: "Antrim County", state: "Michigan" },
    [{ id: 662846, title: "Miller Lake 47", price: 849000, acres: 47.63 }],
  );
  assert.equal(sayfaCoz(h).acres, 0.49);
  assert.equal(sayfaCoz(h).price, 4923);
});

test("Parish / Borough eki temizlenir", () => {
  const h = sayfa({ id: 1, title: "Longleaf Pine", price: 390000, acres: 163.6, county: "Rapides Parish", state: "Louisiana" });
  assert.equal(sayfaCoz(h).county, "Rapides");
  assert.equal(sayfaCoz(h).state, "LA");
});

test("county boş olabilir — kayıt yine de geçerli", () => {
  const h = sayfa({ id: 2, title: "Sheriff Sale", price: 1600, acres: 0.03, county: null, state: "PA" });
  const r = sayfaCoz(h);
  assert.equal(r.county, null);
  assert.equal(r.state, "PA");
  assert.equal(r.price, 1600);
});

test("acre hiçbir yerde yoksa null — uydurulmaz", () => {
  const h = sayfa({ id: 3, title: "Güzel arsa", price: 5000, acres: null, county: "X County", state: "Texas" });
  assert.equal(sayfaCoz(h).acres, null);
});

test("fiyat yok / sıfır / eyalet tanınmıyor → kayıt reddedilir", () => {
  assert.equal(sayfaCoz(sayfa({ id: 4, title: "t", price: 0, state: "Texas" })), null);
  assert.equal(sayfaCoz(sayfa({ id: 5, title: "t", price: null, state: "Texas" })), null);
  assert.equal(sayfaCoz(sayfa({ id: 6, title: "t", price: 900, state: "Atlantis" })), null);
});

test("__NEXT_DATA__ yoksa / bozuksa null döner, çökmez", () => {
  assert.equal(sayfaCoz("<html><body>bos</body></html>"), null);
  assert.equal(sayfaCoz('<script id="__NEXT_DATA__" type="application/json">{bozuk</script>'), null);
});

test("0 koordinat null sayılır (kaynak boş koordinatı 0 yazıyor)", () => {
  const h = sayfa({ id: 7, title: "t", price: 1000, acres: 1, county: "A", state: "Ohio", latitude: "0", longitude: "0" });
  const r = sayfaCoz(h);
  assert.equal(r.lat, null);
  assert.equal(r.lng, null);
});
