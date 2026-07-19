#!/usr/bin/env node
/**
 * TEXAS BIS multi-county batch #2 — ArcGIS Online'da keşfedilen 85 EK county.
 * Batch #1 (offmarket-tx-batch.mjs) + orijinal 4 dışındaki BIS CADWebService county'leri.
 * Aynı _tx-bis-core.runCounty deseni (vacant/imprv=0, ucuz, absentee işaretli, owner+posta zorunlu).
 * Kullanım: node scraper/offmarket-tx-batch2.mjs   (ONLY="bell,comal" ile daraltılabilir)
 */
import { runCounty } from "./_tx-bis-core.mjs";

const COUNTIES = {
  andrews: ["Andrews", "https://services7.arcgis.com/ihDsRGnlJz5F4xyl/arcgis/rest/services/AndrewsCADWebService/FeatureServer/0"],
  aransas: ["Aransas", "https://services8.arcgis.com/91dtIBbR8eaxrmHR/arcgis/rest/services/AransasCADWebService/FeatureServer/0"],
  austin: ["Austin", "https://services7.arcgis.com/rNakmFefTO1XjYg4/arcgis/rest/services/AustinCADWebService/FeatureServer/0"],
  bailey: ["Bailey", "https://services7.arcgis.com/UpQN8IYpnCYHn7nk/arcgis/rest/services/BaileyCADWebService/FeatureServer/0"],
  bastrop: ["Bastrop", "https://services.arcgis.com/aS4XD9PgZha28y8P/arcgis/rest/services/BastropCADWebService/FeatureServer/0"],
  baylor: ["Baylor", "https://services3.arcgis.com/atNqsVjR9lTf1DBY/arcgis/rest/services/BaylorCADWebService/FeatureServer/0"],
  bell: ["Bell", "https://services7.arcgis.com/EHW2HuuyZNO7DZct/arcgis/rest/services/BellCADWebService/FeatureServer/0"],
  blanco: ["Blanco", "https://services7.arcgis.com/GsFOwV8KcywEbxTn/arcgis/rest/services/BlancoCADWebService/FeatureServer/0"],
  borden: ["Borden", "https://services7.arcgis.com/Dw7EwNsLHGmSsEFx/arcgis/rest/services/BordenCADWebService/FeatureServer/0"],
  brazoria: ["Brazoria", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/BrazoriaCADWebService/FeatureServer/0"],
  brazos: ["Brazos", "https://services5.arcgis.com/ZgRzAvgtfHgf0HWs/arcgis/rest/services/BrazosCADWebService/FeatureServer/0"],
  burleson: ["Burleson", "https://services8.arcgis.com/0uWFXDEpQd9NFiad/arcgis/rest/services/BurlesonCADWebService/FeatureServer/0"],
  calhoun: ["Calhoun", "https://services6.arcgis.com/nEraHEKblzwMBYQ3/arcgis/rest/services/CalhounCADWebService/FeatureServer/0"],
  callahan: ["Callahan", "https://services8.arcgis.com/W7qqCKXBmbtc0d4r/arcgis/rest/services/CallahanCADWebService/FeatureServer/0"],
  carson: ["Carson", "https://services8.arcgis.com/Nj4FmPqF8WshvjrP/arcgis/rest/services/CarsonCADWebService/FeatureServer/0"],
  castro: ["Castro", "https://services5.arcgis.com/iunrO5vjpmI1MJJA/arcgis/rest/services/CastroCADWebService/FeatureServer/0"],
  cochran: ["Cochran", "https://services2.arcgis.com/d7f5jhAosYNYotdL/arcgis/rest/services/CochranCADWebService/FeatureServer/0"],
  coke: ["Coke", "https://services3.arcgis.com/ffBxoPN79nRAYU6E/arcgis/rest/services/CokeCADWebService/FeatureServer/0"],
  colorado: ["Colorado", "https://services8.arcgis.com/kLPk1FdZyvjjB3o2/arcgis/rest/services/ColoradoCADWebService/FeatureServer/0"],
  comal: ["Comal", "https://services7.arcgis.com/Yz6eib2o8WvEgWq8/arcgis/rest/services/ComalCADWebService/FeatureServer/0"],
  comanche: ["Comanche", "https://services6.arcgis.com/gshWNaFhUNegaQZA/arcgis/rest/services/ComancheCADWebService/FeatureServer/0"],
  cooke: ["Cooke", "https://services8.arcgis.com/7URdiHea1cO6D1Iw/arcgis/rest/services/CookeCADWebService/FeatureServer/0"],
  dallam: ["Dallam", "https://services6.arcgis.com/jwCCs5I7EWDwKVZK/arcgis/rest/services/DallamCADWebService/FeatureServer/0"],
  deafsmith: ["DeafSmith", "https://services8.arcgis.com/PggHKOKuiChUpH94/arcgis/rest/services/DeafSmithCADWebService/FeatureServer/0"],
  erath: ["Erath", "https://services7.arcgis.com/gIWyxqmQ0YHPVqA2/arcgis/rest/services/ErathCADWebService/FeatureServer/0"],
  fayette: ["Fayette", "https://services7.arcgis.com/INOomfRKQGxc9OW4/arcgis/rest/services/FayetteCADWebService/FeatureServer/0"],
  gaines: ["Gaines", "https://services8.arcgis.com/nHWyvEneKvyPn23C/arcgis/rest/services/GainesCADWebService/FeatureServer/0"],
  garza: ["Garza", "https://services8.arcgis.com/Bt5L98Rubsv0bzHI/arcgis/rest/services/GarzaCADWebService/FeatureServer/0"],
  glasscock: ["Glasscock", "https://services.arcgis.com/YNGHnBhGIqsBFqY2/arcgis/rest/services/GlasscockCADWebService/FeatureServer/0"],
  gray: ["Gray", "https://services6.arcgis.com/ZBvh25uqWsIRmkWK/arcgis/rest/services/GrayCADWebService/FeatureServer/0"],
  grimes: ["Grimes", "https://services8.arcgis.com/fpr21jaV02YtR7tv/arcgis/rest/services/GrimesCADWebService/FeatureServer/0"],
  guadalupe: ["Guadalupe", "https://services9.arcgis.com/1l4hbpt78hjlsIcl/arcgis/rest/services/GuadalupeCADWebService/FeatureServer/0"],
  hale: ["Hale", "https://services6.arcgis.com/MsKAwpqiJD1YHM2q/arcgis/rest/services/HaleCADWebService/FeatureServer/0"],
  hardin: ["Hardin", "https://services9.arcgis.com/8oveauLo4lI1NjDp/arcgis/rest/services/HardinCADWebService/FeatureServer/0"],
  hartley: ["Hartley", "https://services6.arcgis.com/9AShvsLksvOzPnzm/arcgis/rest/services/HartleyCADWebService/FeatureServer/0"],
  hidalgo: ["Hidalgo", "https://services2.arcgis.com/oGBvyq0nPROvpcSn/arcgis/rest/services/HidalgoCADWebService/FeatureServer/0"],
  hockley: ["Hockley", "https://services6.arcgis.com/PaxwrMmTVp4WH7Xr/arcgis/rest/services/HockleyCADWebService/FeatureServer/0"],
  hood: ["Hood", "https://services.arcgis.com/n4964dyKb7h58xBo/arcgis/rest/services/HoodCADWebService/FeatureServer/0"],
  howard: ["Howard", "https://services6.arcgis.com/T3dTslR6IXXsd0JO/arcgis/rest/services/HowardCADWebService/FeatureServer/0"],
  hunt: ["Hunt", "https://services3.arcgis.com/GIIiqmeq0npieHV9/arcgis/rest/services/HuntCADWebService/FeatureServer/0"],
  jasper: ["Jasper", "https://services3.arcgis.com/8W4ZPPjIzqjTNZWj/arcgis/rest/services/JasperCADWebService/FeatureServer/0"],
  kleberg: ["Kleberg", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/KlebergCADWebService/FeatureServer/0"],
  knox: ["Knox", "https://services2.arcgis.com/Ju5vg9anco2Yv2af/arcgis/rest/services/KnoxCADWebService/FeatureServer/0"],
  lamb: ["Lamb", "https://services.arcgis.com/RMWDKEBWPrvUSf0r/arcgis/rest/services/LambCADWebService/FeatureServer/0"],
  lavaca: ["Lavaca", "https://services.arcgis.com/NIfETzIj7kHquibp/arcgis/rest/services/LavacaCADWebService/FeatureServer/0"],
  leetx: ["Lee", "https://services1.arcgis.com/la5KbvGUYLup9Aee/arcgis/rest/services/LeeCADWebService/FeatureServer/0"],
  libertytx: ["Liberty", "https://services3.arcgis.com/LbQai106UcFy2LlR/arcgis/rest/services/LibertyCADWebService/FeatureServer/0"],
  llano: ["Llano", "https://services.arcgis.com/3fXpNNO2cx0O3RtY/arcgis/rest/services/LlanoCADWebService/FeatureServer/0"],
  matagorda: ["Matagorda", "https://services7.arcgis.com/pOoGFPnvGO2DVZ5T/arcgis/rest/services/MatagordaCADWebService/FeatureServer/0"],
  mclennan: ["McLennan", "https://services8.arcgis.com/5e4b1SY8bogTc3pH/arcgis/rest/services/McLennanCADWebService/FeatureServer/0"],
  midland: ["Midland", "https://services5.arcgis.com/1pOc2HE5GDuzMESK/arcgis/rest/services/MidlandCADWebService/FeatureServer/0"],
  mitchell: ["Mitchell", "https://services5.arcgis.com/GLd5zlieI7IBJJ6U/arcgis/rest/services/MitchellCADWebService/FeatureServer/0"],
  moore: ["Moore", "https://services5.arcgis.com/ENPboUyBmARUSE46/arcgis/rest/services/MooreCADWebService/FeatureServer/0"],
  newton: ["Newton", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/NewtonCADWebService/FeatureServer/0"],
  nueces: ["Nueces", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/NuecesCADWebService/FeatureServer/0"],
  ochiltree: ["Ochiltree", "https://services7.arcgis.com/tzXFuAOuVv9jbvkS/arcgis/rest/services/OchiltreeCADWebService/FeatureServer/0"],
  oldham: ["Oldham", "https://services6.arcgis.com/wE0ehOaljLzej1d7/arcgis/rest/services/OldhamCADWebService/FeatureServer/0"],
  orangetx: ["Orange", "https://services3.arcgis.com/HiTjmoyc4HjgiceA/arcgis/rest/services/OrangeCADWebService/FeatureServer/0"],
  parker: ["Parker", "https://services.arcgis.com/79g1H99xInKSRRK3/arcgis/rest/services/ParkerCADWebService/FeatureServer/0"],
  parmer: ["Parmer", "https://services6.arcgis.com/VFKV32Si4tVahTQv/arcgis/rest/services/ParmerCADWebService/FeatureServer/0"],
  polktx: ["Polk", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/PolkCADWebService/FeatureServer/0"],
  roberts: ["Roberts", "https://services6.arcgis.com/alqG7E4N4tIlsolr/arcgis/rest/services/RobertsCADWebService/FeatureServer/0"],
  sanjacinto: ["SanJacinto", "https://services8.arcgis.com/Cj28SFmpkCtGCeEQ/arcgis/rest/services/SanJacintoCADWebService/FeatureServer/0"],
  sanpatricio: ["SanPatricio", "https://services8.arcgis.com/EPyTHdGc5BhnbNty/arcgis/rest/services/SanPatricioCADWebService/FeatureServer/0"],
  schleicher: ["Schleicher", "https://services.arcgis.com/ygP2nTN7mgjm8uRV/arcgis/rest/services/SchleicherCADWebService/FeatureServer/0"],
  scurry: ["Scurry", "https://services7.arcgis.com/JFlw2pRIhV8pU9ke/arcgis/rest/services/ScurryCADWebService/FeatureServer/0"],
  shackelford: ["Shackelford", "https://services6.arcgis.com/OmXFyVE6f9Flbdu7/arcgis/rest/services/ShackelfordCADWebService/FeatureServer/0"],
  somervell: ["Somervell", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/SomervellCADWebService/FeatureServer/0"],
  starr: ["Starr", "https://services.arcgis.com/eeOR7tCg5imWJmGV/arcgis/rest/services/StarrCADWebService/FeatureServer/0"],
  stephens: ["Stephens", "https://services.arcgis.com/uIMunOkV6KNGlZzT/arcgis/rest/services/StephensCADWebService/FeatureServer/0"],
  swisher: ["Swisher", "https://services5.arcgis.com/iHlGUy6wTsOU69bC/arcgis/rest/services/SwisherCADWebService/FeatureServer/0"],
  tomgreen: ["TomGreen", "https://services5.arcgis.com/3KYdtBnAMnav1mt9/arcgis/rest/services/TomGreenCADWebService/FeatureServer/0"],
  tylertx: ["Tyler", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/TylerCADWebService/FeatureServer/0"],
  victoria: ["Victoria", "https://services6.arcgis.com/TFRbpkUZXMMkfhmY/arcgis/rest/services/VictoriaCADWebService/FeatureServer/0"],
  walker: ["Walker", "https://services6.arcgis.com/hEVWOxh6v1J8BInI/arcgis/rest/services/WalkerCADWebService/FeatureServer/0"],
  waller: ["Waller", "https://services3.arcgis.com/KKhSlBnH1Rm0YK62/arcgis/rest/services/WallerCADWebService/FeatureServer/0"],
  washingtontx: ["Washington", "https://services3.arcgis.com/42lb4t0mpCcD1zg8/arcgis/rest/services/WashingtonCADWebService/FeatureServer/0"],
  wharton: ["Wharton", "https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/WhartonCADWebService/FeatureServer/0"],
  wilbarger: ["Wilbarger", "https://services6.arcgis.com/XORm2dmqucrRUHcY/arcgis/rest/services/WilbargerCADWebService/FeatureServer/0"],
  willacy: ["Willacy", "https://services7.arcgis.com/HXKJeileNKFB6FPd/arcgis/rest/services/WillacyCADWebService/FeatureServer/0"],
  winkler: ["Winkler", "https://services1.arcgis.com/hizvOwr7qy6jQYxo/arcgis/rest/services/WinklerCADWebService/FeatureServer/0"],
  wise: ["Wise", "https://services1.arcgis.com/9sR6E9qY5UqEzC5T/arcgis/rest/services/WiseCADWebService/FeatureServer/0"],
  yoakum: ["Yoakum", "https://services6.arcgis.com/9OUuANKRTlIFdUUK/arcgis/rest/services/YoakumCADWebService/FeatureServer/0"],
  young: ["Young", "https://services.arcgis.com/XkhWnpXLglOI9qps/arcgis/rest/services/YoungCADWebService/FeatureServer/0"],
  zapata: ["Zapata", "https://services6.arcgis.com/poXnfPDnR34RXAaR/arcgis/rest/services/ZapataCADWebService/FeatureServer/0"],
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
console.log("\n===== TX BATCH2 ÖZET =====");
for (const r of results) console.log(r);
