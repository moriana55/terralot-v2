#!/usr/bin/env node
/** Hudspeth County (West TX desert) off-market vacant-land pull. node scraper/offmarket-tx-hudspeth.mjs */
import { runCounty } from "./_tx-bis-core.mjs";
runCounty({
  county: "Hudspeth", slug: "hudspeth",
  layer: "https://services6.arcgis.com/TCoMB3SwAXtBwSdM/arcgis/rest/services/HudspethCADWebService/FeatureServer/0",
}).catch((e) => { console.error("HATA:", e); process.exit(1); });
