#!/usr/bin/env node
/**
 * TEXAS BIS multi-county batch off-market pull.
 * BIS vendor tüm bu county'ler için AYNI şemalı `<County>CADWebService/FeatureServer/0`
 * (Parcels) yayınlar. ArcGIS Online search ile org-ID'ler keşfedildi.
 * Her county'yi _tx-bis-core.runCounty ile çeker (imprv_val=0 vacant, ucuz, absentee işaretli),
 * JSON snapshot yazar + Supabase offmarket_leads upsert. Çalışmayan/şeması farklı county atlanır.
 * Kullanım: node scraper/offmarket-tx-batch.mjs   (ONLY="medina,kerr" ile daraltılabilir)
 */
import { runCounty } from "./_tx-bis-core.mjs";

// slug -> { county görünen ad, layer FeatureServer/0 URL }
const COUNTIES = {
  medina: ["Medina", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/MedinaCADWebService/FeatureServer/0"],
  johnson: ["Johnson", "https://services5.arcgis.com/SNQMi91A9RRB0qcO/arcgis/rest/services/JohnsonCADWebService/FeatureServer/0"],
  kaufman: ["Kaufman", "https://services9.arcgis.com/26s7bQ5Q51Gt4J2Q/arcgis/rest/services/KaufmanCADWebService/FeatureServer/0"],
  zavala: ["Zavala", "https://services6.arcgis.com/WBZuocIl31Gx4uZx/arcgis/rest/services/ZavalaCADWebService/FeatureServer/0"],
  dimmit: ["Dimmit", "https://services8.arcgis.com/LnmYQjpj3hrjkj1L/arcgis/rest/services/DimmitCADWebService/FeatureServer/0"],
  lasalle: ["La Salle", "https://services1.arcgis.com/bpzdxsiZxgumiUwi/arcgis/rest/services/LaSalleCADWebService/FeatureServer/0"],
  uvalde: ["Uvalde", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/UvaldeCADWebService/FeatureServer/0"],
  kinney: ["Kinney", "https://services9.arcgis.com/TltnQBadFEhlQvkR/arcgis/rest/services/KinneyCADWebService/FeatureServer/0"],
  caldwell: ["Caldwell", "https://services.arcgis.com/rVxY74DxxIDrDbc0/arcgis/rest/services/CaldwellCADWebService/FeatureServer/0"],
  jackson: ["Jackson", "https://services7.arcgis.com/O5g7RhdX0pelDe2J/arcgis/rest/services/JacksonCADWebService/FeatureServer/0"],
  atascosa: ["Atascosa", "https://services8.arcgis.com/q1dyPay4QViMab9g/arcgis/rest/services/AtascosaCADWebService/FeatureServer/0"],
  wilson: ["Wilson", "https://services6.arcgis.com/k8X7ZqKHDjdLxW50/arcgis/rest/services/WilsonCADWebService/FeatureServer/0"],
  liveoak: ["Live Oak", "https://services3.arcgis.com/JZj6WxptUNogw8h7/arcgis/rest/services/LiveOakCADWebService/FeatureServer/0"],
  mcmullen: ["McMullen", "https://services5.arcgis.com/Z5ivCgJjcmkyFIuw/arcgis/rest/services/McMullenCADWebService/FeatureServer/0"],
  duval: ["Duval", "https://services8.arcgis.com/RAxb9SOLfINbVMkC/arcgis/rest/services/DuvalCADWebService/FeatureServer/0"],
  brooks: ["Brooks", "https://services8.arcgis.com/wC6vDMSje0egetVY/arcgis/rest/services/BrooksCADWebService/FeatureServer/0"],
  kenedy: ["Kenedy", "https://services5.arcgis.com/ULlHx6dVKNOs2ogU/arcgis/rest/services/KenedyCADWebService/FeatureServer/0"],
  jimwells: ["Jim Wells", "https://services8.arcgis.com/36tOt5wOeEMz3tyS/arcgis/rest/services/JimWellsCADWebService/FeatureServer/0"],
  bee: ["Bee", "https://services3.arcgis.com/UCyyWODS30HHeveq/arcgis/rest/services/BeeCADWebService/FeatureServer/0"],
  goliad: ["Goliad", "https://services8.arcgis.com/WbC8UcChzGlcbEPR/arcgis/rest/services/GoliadCADWebService/FeatureServer/0"],
  bandera: ["Bandera", "https://services7.arcgis.com/ZbeB5GO8asJXJb2R/arcgis/rest/services/BanderaCADWebService/FeatureServer/0"],
  kerr: ["Kerr", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/KerrCADWebService/FeatureServer/0"],
  kendall: ["Kendall", "https://services9.arcgis.com/AugxDVA2CqlsdRYC/arcgis/rest/services/KendallCADWebService/FeatureServer/0"],
  gillespie: ["Gillespie", "https://services.arcgis.com/Jt5Ms9iSpiRKiydw/arcgis/rest/services/GillespieCADWebService/FeatureServer/0"],
  real: ["Real", "https://services5.arcgis.com/zYWSy8EH4fp8Icmp/arcgis/rest/services/RealCADWebService/FeatureServer/0"],
  edwards: ["Edwards", "https://services6.arcgis.com/VtGdG6zirc9oUs4j/arcgis/rest/services/EdwardsCADWebService/FeatureServer/0"],
  sutton: ["Sutton", "https://services5.arcgis.com/lNDBBxMu9YPq0R2u/arcgis/rest/services/SuttonCADWebService/FeatureServer/0"],
  kimble: ["Kimble", "https://services.arcgis.com/DNlZo36viNjkzTpZ/arcgis/rest/services/KimbleCADWebService/FeatureServer/0"],
  mason: ["Mason", "https://services5.arcgis.com/AKlIcTAXzzKLNWkD/arcgis/rest/services/MasonCADWebService/FeatureServer/0"],
  concho: ["Concho", "https://services7.arcgis.com/fDDjckc5AviunneV/arcgis/rest/services/ConchoCADWebService/FeatureServer/0"],
  coleman: ["Coleman", "https://services3.arcgis.com/OgPvbw2eXM4rhmEX/arcgis/rest/services/ColemanCADWebService/FeatureServer/0"],
  brown: ["Brown", "https://services3.arcgis.com/GDTvqYSV5kJg6ilh/arcgis/rest/services/BrownCADWebService/FeatureServer/0"],
  mills: ["Mills", "https://services3.arcgis.com/0xwlcKhzh0RpcMH8/arcgis/rest/services/MillsCADWebService/FeatureServer/0"],
  lampasas: ["Lampasas", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/LampasasCADWebService/FeatureServer/0"],
  coryell: ["Coryell", "https://services3.arcgis.com/qmqVEYNCt8dhXqHl/arcgis/rest/services/CoryellCADWebService/FeatureServer/0"],
  hamilton: ["Hamilton", "https://services5.arcgis.com/pzFcYh1n3tCig21y/arcgis/rest/services/HamiltonCADWebService/FeatureServer/0"],
  bosque: ["Bosque", "https://services7.arcgis.com/9fwv8ViFcx3zYmIW/arcgis/rest/services/BosqueCADWebService/FeatureServer/0"],
  hill: ["Hill", "https://services6.arcgis.com/c1IEzrw0UDP7bzay/arcgis/rest/services/HillCADWebService/FeatureServer/0"],
  henderson: ["Henderson", "https://services7.arcgis.com/4x7oelC9W8TNucjG/arcgis/rest/services/HendersonCADWebService/FeatureServer/0"],
  limestone: ["Limestone", "https://services3.arcgis.com/ApXmrXrf4zi88eKu/arcgis/rest/services/LimestoneCADWebService/FeatureServer/0"],
  falls: ["Falls", "https://services7.arcgis.com/imOmRN2vd4Vxuep1/arcgis/rest/services/FallsCADWebService/FeatureServer/0"],
  milam: ["Milam", "https://services.arcgis.com/mpwrBwk3Up1EFoYK/arcgis/rest/services/MilamCADWebService/FeatureServer/0"],
  robertson: ["Robertson", "https://services6.arcgis.com/vP5EglcJd79Dd1TJ/arcgis/rest/services/RobertsonCADWebService/FeatureServer/0"],
  madison: ["Madison", "https://services.arcgis.com/sJX80aHNsEoY9Kif/arcgis/rest/services/MadisonCADWebService/FeatureServer/0"],
  trinity: ["Trinity", "https://services6.arcgis.com/hLftBSoB3mrzkhE4/arcgis/rest/services/TrinityCADWebService/FeatureServer/0"],
  angelina: ["Angelina", "https://services3.arcgis.com/Ku30AWcUhD95wd6b/arcgis/rest/services/AngelinaCADWebService/FeatureServer/0"],
  shelby: ["Shelby", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/ShelbyCADWebService/FeatureServer/0"],
  cherokee: ["Cherokee", "https://services5.arcgis.com/tyTfZP6fpe41IyyO/arcgis/rest/services/CherokeeCADWebService/FeatureServer/0"],
  wood: ["Wood", "https://services7.arcgis.com/5u6RvFtqihOOiyUO/arcgis/rest/services/WoodCADWebService/FeatureServer/0"],
  upshur: ["Upshur", "https://services5.arcgis.com/uTQe835Qm04W5Cjr/arcgis/rest/services/UpshurCADWebService/FeatureServer/0"],
  camp: ["Camp", "https://services8.arcgis.com/3ERd7aqQXEjL9i0y/arcgis/rest/services/CampCADWebService/FeatureServer/0"],
  titus: ["Titus", "https://services5.arcgis.com/33odzvCca0xzxvGO/arcgis/rest/services/TitusCADWebService/FeatureServer/0"],
  franklintx: ["Franklin", "https://services5.arcgis.com/C0GusFTXlVtEh6ie/arcgis/rest/services/FranklinCADWebService/FeatureServer/0"],
  rains: ["Rains", "https://services.arcgis.com/BfnsH81Ljct7mdRF/arcgis/rest/services/RainsCADWebService/FeatureServer/0"],
  vanzandt: ["Van Zandt", "https://services5.arcgis.com/96Y3rGnOjGwKKDOM/arcgis/rest/services/VanZandtCADWebService/FeatureServer/0"],
  delta: ["Delta", "https://services8.arcgis.com/CPh8611N01zfPAqb/arcgis/rest/services/DeltaCADWebService/FeatureServer/0"],
  lamar: ["Lamar", "https://services3.arcgis.com/f4WhMvUzLwYd9QH8/arcgis/rest/services/LamarCADWebService/FeatureServer/0"],
  redriver: ["Red River", "https://services6.arcgis.com/QegVDgwL3C5CaiQS/arcgis/rest/services/RedRiverCADWebService/FeatureServer/0"],
  casstx: ["Cass", "https://services7.arcgis.com/UQ45NO3AJLtPpLKi/arcgis/rest/services/CassCADWebService/FeatureServer/0"],
  mariontx: ["Marion", "https://services3.arcgis.com/yHyk19CrrUYjbLOM/arcgis/rest/services/MarionCADWebService/FeatureServer/0"],
  harrison: ["Harrison", "https://services5.arcgis.com/9EzFuq4pvjRgSIO3/arcgis/rest/services/HarrisonCADWebService/FeatureServer/0"],
  gregg: ["Gregg", "https://services7.arcgis.com/GGLRLGImTaR7VQAH/arcgis/rest/services/GreggCADWebService/FeatureServer/0"],
};

const only = (process.env.ONLY || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const run = only.length ? only.filter((k) => COUNTIES[k]) : Object.keys(COUNTIES);

const results = [];
for (const slug of run) {
  const [county, layer] = COUNTIES[slug];
  try {
    await runCounty({ county, slug, layer });
    results.push(`${county}: OK`);
  } catch (e) {
    console.error(`\n⚠️ ${county} atlandı: ${e.message}`);
    results.push(`${county}: ATLANDI (${e.message})`);
  }
}
console.log("\n===== TX BATCH ÖZET =====");
for (const r of results) console.log(r);
