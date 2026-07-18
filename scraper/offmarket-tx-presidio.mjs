#!/usr/bin/env node
/** Presidio County (West TX / Big Bend) off-market vacant-land pull. node scraper/offmarket-tx-presidio.mjs */
import { runCounty } from "./_tx-bis-core.mjs";
runCounty({
  county: "Presidio", slug: "presidio",
  layer: "https://services3.arcgis.com/olwlVbUZZ1LTljgD/arcgis/rest/services/PresidioCADWebService/FeatureServer/0",
}).catch((e) => { console.error("HATA:", e); process.exit(1); });
