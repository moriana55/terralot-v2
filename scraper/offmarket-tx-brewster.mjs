#!/usr/bin/env node
/** Brewster County (West TX / Big Bend) off-market vacant-land pull. node scraper/offmarket-tx-brewster.mjs */
import { runCounty } from "./_tx-bis-core.mjs";
runCounty({
  county: "Brewster", slug: "brewster",
  layer: "https://services6.arcgis.com/rQ0f7V2sPSbAKMbv/arcgis/rest/services/BrewsterCADWebService/FeatureServer/0",
}).catch((e) => { console.error("HATA:", e); process.exit(1); });
