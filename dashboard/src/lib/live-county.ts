// ─────────────────────────────────────────────────────────────────────────────
// CANLI COUNTY REGISTRY — kullanıcı istediğinde bir county'nin ArcGIS parsel
// servisine O AN sorgu atıp normalize sonuç döndürür. 195K statik lead'den AYRI:
// bu veri her istekte doğrudan county ArcGIS'inden gelir (dürüst canlı sorgu).
//
// Endpoint + alan adı + baseWhere desenleri scraper/offmarket-*.mjs dosyalarından
// birebir alındı — orada gerçek/çalışan olduğu kanıtlanmış servisler. Her county'nin
// alan adları farklı olduğu için normalize() fonksiyonu county-özel.
//
// Bu dosyada SIR YOK (sadece halka açık ArcGIS URL'leri + alan haritası); güvenli
// biçimde hem sunucu route'u hem client sayfa import edebilir. Fetch yine SUNUCUDA
// (route.ts) yapılır — county servisleri yavaş/engelli olabilir.
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveCountyResult {
  apn: string;
  owner: string;
  mailing_address: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip: string;
  situs: string;
  use: string;
  acres: number | null;
  land_value: number | null;
  absentee: boolean;
}

export interface LiveSearch {
  owner?: string;
  apn?: string;
  mailingState?: string;
  minValue?: number;
  maxValue?: number;
}

interface RegistryEntry {
  label: string;
  /** Home state code (absentee karşılaştırması + lead_id öneki). */
  state: string;
  county: string;
  region: string;
  /** offmarket_leads.lead_id öneki — scraper ile AYNI (canlı kayıt scraper kaydıyla dedupe olsun). */
  leadIdPrefix: string;
  /** ArcGIS `.../query` uç noktası. */
  endpoint: string;
  outFields: string;
  orderBy: string;
  /** min/max değer aramasını destekliyor mu (değer alanı olan county'ler). */
  hasValue: boolean;
  /** Boş-arsa / temel filtre (scraper'dan). Değer üst sınırı KULLANICIYA bırakılır. */
  baseWhere: string;
  ownerField?: string;
  apnField?: string;
  /** Posta eyaleti alanı (sunucu-taraflı absentee/eyalet filtresi). Yoksa client filtre. */
  stateField?: string;
  valueField?: string;
  normalize(a: Record<string, unknown>): LiveCountyResult | null;
}

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const numOr = (v: unknown, d: number | null = null): number | null => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : d;
};
const acresPos = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

// Valencia OwnerAddre tek string: "STREET \nCITY, ST ZIP" — scraper parseAddr birebir.
function parseValenciaAddr(raw: unknown) {
  const t = String(raw ?? "").replace(/\r/g, "").trim();
  const parts = t.split("\n").map((x) => x.trim()).filter(Boolean);
  let street = "", city = "", st = "", zip = "";
  if (parts.length === 0) return { street, city, st, zip };
  const last = parts[parts.length - 1];
  street = parts.slice(0, -1).join(" ").trim();
  const m = last.match(/^(.*?),\s*([A-Za-z]{2})\b\s*(\d{5}(?:-\d{4})?)?/);
  if (m) { city = m[1].trim(); st = m[2].toUpperCase(); zip = (m[3] || "").trim(); }
  else { city = last; }
  if (!street) street = last;
  return { street, city, st, zip };
}

export const LIVE_COUNTY_REGISTRY: Record<string, RegistryEntry> = {
  "co-costilla": {
    label: "Costilla County, CO",
    state: "CO", county: "Costilla", region: "Costilla County", leadIdPrefix: "CO-Costilla",
    endpoint: "https://services7.arcgis.com/qznFlX1g8SfaPebZ/arcgis/rest/services/Costilla_County_FGDB_May_Update/FeatureServer/8/query",
    outFields: "ParcelNum,Parcel,Owner_Name,Additional_Owners,Mailing_Address,Mailing_City,Mailing_State,Mailing_Zip,Total_Value,Total_Assessed_Value,Total_Area,Location_Street_Number,Location_Street",
    orderBy: "Total_Value ASC",
    hasValue: true,
    baseWhere: "Total_Value>0 AND Mailing_State IS NOT NULL AND Mailing_State<>''",
    ownerField: "Owner_Name", apnField: "ParcelNum", stateField: "Mailing_State", valueField: "Total_Value",
    normalize(a) {
      const apn = s(a.ParcelNum) || s(a.Parcel);
      const owner = [a.Owner_Name, a.Additional_Owners].filter(Boolean).map(s).join(" & ").trim();
      const mail = s(a.Mailing_Address), city = s(a.Mailing_City);
      if (!apn || !owner || !mail || !city) return null;
      const st = s(a.Mailing_State).toUpperCase();
      const situs = [a.Location_Street_Number, a.Location_Street]
        .map(s).filter((x) => x && x.toUpperCase() !== "N/A").join(" ").trim();
      return {
        apn, owner, mailing_address: mail, mailing_city: city, mailing_state: st,
        mailing_zip: s(a.Mailing_Zip), situs, use: "VACANT",
        acres: acresPos(a.Total_Area), land_value: numOr(a.Total_Value),
        absentee: !!(st && st !== "CO"),
      };
    },
  },

  "co-lasanimas": {
    label: "Las Animas County, CO",
    state: "CO", county: "Las Animas", region: "Las Animas County", leadIdPrefix: "CO-LasAnimas",
    endpoint: "https://services7.arcgis.com/NWWOCaXnjdetEWUz/arcgis/rest/services/LasAnimasParcels/FeatureServer/2/query",
    outFields: "ACCOUNTNO,ParcelNum,NAME,CAREOF,ADDRESS1,ADDRESS2,CITY,STATE,ZIPCODEM,SitusWhole,FullAddres,ACRES,ACCTTYPE",
    orderBy: "OBJECTID ASC",
    hasValue: false, // ⚠ değer alanı yok → land_value null
    baseWhere: "ACCTTYPE LIKE '%VACANT%' AND STATE IS NOT NULL AND STATE<>''",
    ownerField: "NAME", apnField: "ACCOUNTNO", stateField: "STATE",
    normalize(a) {
      const apn = s(a.ACCOUNTNO) || s(a.ParcelNum);
      const owner = s(a.NAME);
      const street = [a.ADDRESS1, a.ADDRESS2].filter(Boolean).map(s).join(" ").trim();
      const city = s(a.CITY);
      if (!apn || !owner || !street || !city) return null;
      const st = s(a.STATE).toUpperCase();
      return {
        apn, owner, mailing_address: street, mailing_city: city, mailing_state: st,
        mailing_zip: s(a.ZIPCODEM), situs: s(a.SitusWhole) || s(a.FullAddres),
        use: s(a.ACCTTYPE) || "VACANT_LAND", acres: acresPos(a.ACRES), land_value: null,
        absentee: !!(st && st !== "CO"),
      };
    },
  },

  "nm-valencia": {
    label: "Valencia County, NM",
    state: "NM", county: "Valencia", region: "Valencia County", leadIdPrefix: "NM-Valencia",
    endpoint: "https://arcgisce2.co.valencia.nm.us/arcgis/rest/services/GIS_OnlineMap/MapServer/14/query",
    outFields: "UPC,AccountNum,Owner,OwnerAddre,Situs,LANDACT,ActualValu,LANDASD,Shape_Area",
    orderBy: "UPC ASC",
    hasValue: true,
    baseWhere: "IMPASD=0 AND LANDACT>0",
    ownerField: "Owner", apnField: "UPC", valueField: "LANDACT",
    // ⚠ ayrı mailing-state alanı YOK → posta OwnerAddre'den parse; eyalet/absentee CLIENT filtre.
    normalize(a) {
      const apn = s(a.UPC) || s(a.AccountNum);
      const owner = s(a.Owner);
      if (!apn || !owner) return null;
      const ad = parseValenciaAddr(a.OwnerAddre);
      if (!ad.street || !ad.city) return null;
      const acres = a.Shape_Area ? Math.round((Number(a.Shape_Area) / 43560) * 100) / 100 : null;
      return {
        apn, owner, mailing_address: ad.street, mailing_city: ad.city, mailing_state: ad.st,
        mailing_zip: ad.zip, situs: s(a.Situs), use: "VACANT",
        acres, land_value: numOr(a.LANDACT),
        absentee: !!(ad.st && ad.st !== "NM"),
      };
    },
  },

  "az-mohave": {
    label: "Mohave County, AZ",
    state: "AZ", county: "Mohave", region: "Mohave County", leadIdPrefix: "AZ-Mohave",
    endpoint: "https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/38/query",
    outFields: "PARCEL,OWNER,OWNER_2,MAILING_ADDRESS,CITY,STATE,ZIP,SITE_ADDRESS,PROPUSE,USE_CODE,PARCEL_SIZE,LANDVALUE,FULL_CASH_VALUE",
    orderBy: "LANDVALUE ASC",
    hasValue: true,
    baseWhere: "IMPVALUE=0 AND LANDVALUE>0 AND STATE<>''",
    ownerField: "OWNER", apnField: "PARCEL", stateField: "STATE", valueField: "LANDVALUE",
    normalize(a) {
      const apn = s(a.PARCEL);
      const owner = [a.OWNER, a.OWNER_2].filter(Boolean).map(s).join(" & ").trim();
      const mail = s(a.MAILING_ADDRESS), city = s(a.CITY);
      if (!apn || !owner || !mail || !city) return null;
      const st = s(a.STATE).toUpperCase();
      return {
        apn, owner, mailing_address: mail, mailing_city: city, mailing_state: st,
        mailing_zip: s(a.ZIP), situs: s(a.SITE_ADDRESS),
        use: s(a.PROPUSE) || s(a.USE_CODE) || "VACANT",
        acres: acresPos(a.PARCEL_SIZE), land_value: numOr(a.LANDVALUE),
        absentee: !!(st && st !== "AZ"),
      };
    },
  },

  "fl-lee": {
    label: "Lee County, FL",
    state: "FL", county: "Lee", region: "Lee County", leadIdPrefix: "FL-Lee",
    endpoint: "https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/arcgis/rest/services/Lee_County_Parcels/FeatureServer/0/query",
    outFields: "STRAP,O_NAME,O_OTHERS,O_ADDR1,O_ADDR2,O_CITY,O_STATE,O_ZIP,LAND,JUST,GISACRES,SITEADDR,SITECITY,LANDUSEDES,DORCODE",
    orderBy: "LAND ASC",
    hasValue: true,
    baseWhere: "DORCODE LIKE '00%' AND O_STATE IS NOT NULL AND O_STATE<>''",
    ownerField: "O_NAME", apnField: "STRAP", stateField: "O_STATE", valueField: "LAND",
    normalize(a) {
      const apn = s(a.STRAP);
      const owner = [a.O_NAME, a.O_OTHERS].filter(Boolean).map(s).join(" & ").trim();
      const mail = [a.O_ADDR1, a.O_ADDR2].filter(Boolean).map(s).join(" ").trim();
      const city = s(a.O_CITY);
      if (!apn || !owner || !mail || !city) return null;
      const st = s(a.O_STATE).toUpperCase();
      const acres = numOr(a.GISACRES);
      return {
        apn, owner, mailing_address: mail, mailing_city: city, mailing_state: st,
        mailing_zip: s(a.O_ZIP), situs: [a.SITEADDR, a.SITECITY].filter(Boolean).map(s).join(", "),
        use: s(a.LANDUSEDES) || "Vacant",
        acres: acres != null ? Math.round(acres * 1000) / 1000 : null, land_value: numOr(a.LAND),
        absentee: !!(st && st !== "FL"),
      };
    },
  },

  ...txCounty("tx-brewster", "Brewster", "brewster", "https://services6.arcgis.com/rQ0f7V2sPSbAKMbv/arcgis/rest/services/BrewsterCADWebService/FeatureServer/0/query"),
  ...txCounty("tx-hudspeth", "Hudspeth", "hudspeth", "https://services6.arcgis.com/TCoMB3SwAXtBwSdM/arcgis/rest/services/HudspethCADWebService/FeatureServer/0/query"),
  ...txCounty("tx-presidio", "Presidio", "presidio", "https://services3.arcgis.com/olwlVbUZZ1LTljgD/arcgis/rest/services/PresidioCADWebService/FeatureServer/0/query"),
  ...txCounty("tx-terrell", "Terrell", "terrell", "https://services3.arcgis.com/g3gXc91BCpz3M4tF/arcgis/rest/services/TerrellCADWebService/FeatureServer/0/query"),
};

// TX "BIS" CAD servisleri AYNI şemayı paylaşır (scraper/_tx-bis-core.mjs).
function txCounty(key: string, county: string, slug: string, endpoint: string): Record<string, RegistryEntry> {
  return {
    [key]: {
      label: `${county} County, TX`,
      state: "TX", county, region: `${county} County`, leadIdPrefix: `TX-${slug}`,
      endpoint,
      outFields: "prop_id_text,geo_id,file_as_name,addr_line1,addr_line2,addr_line3,addr_city,addr_state,zip,situs_num,situs_street_prefx,situs_street,situs_street_sufix,legal_acreage,land_val,imprv_val,abs_subdv_cd",
      orderBy: "legal_acreage ASC",
      hasValue: true,
      baseWhere: "imprv_val=0 AND land_val>0",
      ownerField: "file_as_name", apnField: "prop_id_text", stateField: "addr_state", valueField: "land_val",
      normalize(a) {
        const apn = s(a.prop_id_text) || s(a.geo_id);
        const owner = s(a.file_as_name);
        const mail = [a.addr_line1, a.addr_line2, a.addr_line3].filter(Boolean).map(s).join(" ").trim();
        const city = s(a.addr_city);
        if (!apn || !owner || !mail || !city) return null;
        const st = s(a.addr_state).toUpperCase();
        const situs = [a.situs_num, a.situs_street_prefx, a.situs_street, a.situs_street_sufix].map(s).filter(Boolean).join(" ").trim();
        return {
          apn, owner, mailing_address: mail, mailing_city: city, mailing_state: st,
          mailing_zip: s(a.zip), situs, use: s(a.abs_subdv_cd) || "VACANT LAND",
          acres: acresPos(a.legal_acreage), land_value: numOr(a.land_val),
          absentee: !!(st && st !== "TX"),
        };
      },
    },
  };
}

// Client dropdown için hafif, sır içermeyen liste.
export interface LiveCountyOption { key: string; label: string; state: string; county: string; hasValue: boolean; }
export const LIVE_COUNTY_OPTIONS: LiveCountyOption[] = Object.entries(LIVE_COUNTY_REGISTRY).map(
  ([key, e]) => ({ key, label: e.label, state: e.state, county: e.county, hasValue: e.hasValue }),
);

// ── Query WHERE oluşturucu ─────────────────────────────────────────────────
// baseWhere + kullanıcı arama koşulları. Girdi tek-tırnak kaçışlıdır (ArcGIS SQL).
const esc = (v: string) => v.replace(/'/g, "''");

export function buildWhere(entry: RegistryEntry, search: LiveSearch): string {
  const clauses = [entry.baseWhere];
  const owner = search.owner?.trim();
  if (owner && entry.ownerField) clauses.push(`UPPER(${entry.ownerField}) LIKE '%${esc(owner.toUpperCase())}%'`);
  const apn = search.apn?.trim();
  if (apn && entry.apnField) clauses.push(`${entry.apnField} LIKE '%${esc(apn)}%'`);
  const mst = search.mailingState?.trim();
  if (mst && entry.stateField) clauses.push(`UPPER(${entry.stateField})='${esc(mst.toUpperCase())}'`);
  if (entry.valueField) {
    if (search.minValue != null && Number.isFinite(search.minValue)) clauses.push(`${entry.valueField}>=${Math.round(search.minValue)}`);
    if (search.maxValue != null && Number.isFinite(search.maxValue)) clauses.push(`${entry.valueField}<=${Math.round(search.maxValue)}`);
  }
  return clauses.join(" AND ");
}

// Sunucu-taraflı WHERE ile ifade EDİLEMEYEN filtreler için client-side eleme
// (ör. Valencia'nın posta eyaleti OwnerAddre'den parse edilir → serverda filtrelenemez).
export function clientFilter(rows: LiveCountyResult[], search: LiveSearch): LiveCountyResult[] {
  const mst = search.mailingState?.trim().toUpperCase();
  return rows.filter((r) => {
    if (mst && r.mailing_state.toUpperCase() !== mst) return false;
    return true;
  });
}
