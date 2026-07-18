#!/usr/bin/env node
/** Terrell County (West TX / Trans-Pecos) off-market vacant-land pull. node scraper/offmarket-tx-terrell.mjs */
import { runCounty } from "./_tx-bis-core.mjs";
runCounty({
  county: "Terrell", slug: "terrell",
  layer: "https://services3.arcgis.com/g3gXc91BCpz3M4tF/arcgis/rest/services/TerrellCADWebService/FeatureServer/0",
}).catch((e) => { console.error("HATA:", e); process.exit(1); });
