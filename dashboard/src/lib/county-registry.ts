// ─────────────────────────────────────────────────────────────────────────────
// COUNTY KAYIT DEFTERİ — SADECE VERİ.
//
// Burada normalize fonksiyonu YAZILMAZ. Her county, sağlayıcı katmanının
// (`county-providers/`) anlayacağı bir kayıt olarak tanımlanır. Yeni county
// eklemek = yeni satır eklemek.
//
// Aynı şemayı paylaşan county aileleri için ÜRETİCİ fonksiyonlar var
// (txBis, flStatewide, coStatewide, ncOneMap) — bunlar kod değil, kayıt üretir.
//
// `bilinenDurum` alanı GERÇEK ölçüme dayanır (`scripts/kapsam-olc.mjs`).
// Ölçülmemiş/çalışmayan county "calisiyor" işaretlenmez.
// ─────────────────────────────────────────────────────────────────────────────

import type { ArcGisSource, CountyEntry, RegridSource } from "./county-providers/types";

// ── Ortak şema üreticileri ──────────────────────────────────────────────────

/**
 * TEXAS "BIS" CAD servisleri — ~155 county AYNI şemayı paylaşır.
 * Tek fark: host numarası + organizasyon kimliği.
 */
function txBis(host: string, org: string, county: string): ArcGisSource {
  const h = host === "-" ? "services" : `services${host}`;
  return {
    kind: "arcgis",
    endpoint: `https://${h}.arcgis.com/${org}/arcgis/rest/services/${county}CADWebService/FeatureServer/0/query`,
    outFields: "prop_id_text,geo_id,file_as_name,addr_line1,addr_line2,addr_line3,addr_city,addr_state,zip,situs_num,situs_street_prefx,situs_street,situs_street_sufix,legal_acreage,land_val,imprv_val,abs_subdv_cd",
    orderBy: "legal_acreage ASC",
    baseWhere: "imprv_val=0 AND land_val>0",
    fields: {
      apn: ["prop_id_text", "geo_id"],
      owner: ["file_as_name"],
      mailAddress: ["addr_line1", "addr_line2", "addr_line3"],
      mailCity: "addr_city", mailState: "addr_state", mailZip: "zip",
      situs: ["situs_num", "situs_street_prefx", "situs_street", "situs_street_sufix"],
      use: ["abs_subdv_cd"], useConst: "VACANT LAND",
      acres: "legal_acreage",
      value: "land_val",
    },
    searchFields: { owner: "file_as_name", apn: "prop_id_text", mailState: "addr_state", value: "land_val" },
  };
}

/** FLORIDA eyalet geneli parsel centroid katmanı — county DOR koduyla filtrelenir. */
function flStatewide(coNo: number): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Parcel_Centroid_Version/FeatureServer/0/query",
    outFields: "CO_NO,PARCEL_ID,OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,PHY_CITY,DOR_UC,LND_VAL,LND_SQFOOT",
    // ⚠ LND_VAL üzerinde sıralama bu katmanda zaman aşımına yol açıyor (ölçüldü).
    // OBJECTID indeksli → hızlı. Ucuzdan sıralama yerine kullanıcı maxValue ile filtreler.
    orderBy: "OBJECTID ASC",
    baseWhere: `CO_NO=${coNo} AND DOR_UC='000' AND LND_VAL>0 AND OWN_STATE IS NOT NULL AND OWN_STATE<>''`,
    fields: {
      apn: ["PARCEL_ID"],
      owner: ["OWN_NAME"],
      mailAddress: ["OWN_ADDR1", "OWN_ADDR2"],
      mailCity: "OWN_CITY", mailState: "OWN_STATE", mailZip: "OWN_ZIPCD",
      situs: ["PHY_ADDR1", "PHY_CITY"], situsJoin: ", ",
      useConst: "VACANT RESIDENTIAL",
      acres: "LND_SQFOOT", acresFrom: "shapeAreaSqft", acresPrecision: 3,
      value: "LND_VAL",
    },
    searchFields: { owner: "OWN_NAME", apn: "PARCEL_ID", mailState: "OWN_STATE", value: "LND_VAL" },
  };
}

/** COLORADO eyalet geneli halka açık parsel katmanı — county adıyla filtrelenir. */
function coStatewide(countyName: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint: "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query",
    outFields: "parcel_id,account,owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,situsAdd,sitAddCty,landAcres,landUseDsc,apprValTot,countyName",
    orderBy: "apprValTot ASC",
    baseWhere: `countyName='${countyName}' AND landUseDsc LIKE '%VACANT%' AND ownAddStt IS NOT NULL AND ownAddStt<>''`,
    fields: {
      apn: ["parcel_id", "account"],
      owner: ["owner", "owner2"],
      mailAddress: ["ownerAdd"],
      mailCity: "ownAddCty", mailState: "ownAddStt", mailZip: "ownAddZip",
      situs: ["situsAdd", "sitAddCty"], situsJoin: ", ",
      use: ["landUseDsc"], useConst: "VACANT",
      acres: "landAcres",
      value: "apprValTot",
    },
    searchFields: { owner: "owner", apn: "parcel_id", mailState: "ownAddStt", value: "apprValTot" },
  };
}

/** NORTH CAROLINA OneMap eyalet geneli parsel katmanı. Uzun WHERE → POST. */
function ncOneMap(countyName: string): ArcGisSource {
  return {
    kind: "arcgis",
    method: "POST",
    endpoint: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1/query",
    outFields: "parno,ownname,mailadd,mcity,mstate,mzip,siteadd,scity,gisacres,landval,improvval,parusedesc,cntyname",
    orderBy: "landval ASC",
    baseWhere: `cntyname='${countyName}' AND improvval=0 AND landval>0 AND mailadd IS NOT NULL AND mailadd<>''`,
    fields: {
      apn: ["parno"],
      owner: ["ownname"],
      mailAddress: ["mailadd"],
      mailCity: "mcity", mailState: "mstate", mailZip: "mzip",
      // NC'de bazı county'ler (Northampton) şehir/eyalet/zip alanlarını BOŞ
      // bırakıp tam adresi `mailadd` içine paketliyor → ayrıştırmaya düş.
      mailCombinedFallback: true,
      situs: ["siteadd", "scity"], situsJoin: ", ",
      use: ["parusedesc"], useConst: "VACANT",
      acres: "gisacres",
      value: "landval",
    },
    searchFields: { owner: "ownname", apn: "parno", mailState: "mstate", value: "landval" },
  };
}

/**
 * MONTANA eyalet geneli MSDI parsel katmanı — 56 county'nin TAMAMI tek serviste,
 * `PropType` standart ("Vacant Land"), posta alanları ayrı ve dolu.
 * 25 eyalet hedefinin en temiz kaynağı.
 */
function mtStatewide(countyName: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint: "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0/query",
    outFields: "PARCELID,AssessmentCode,OwnerName,CareOfTaxpayer,OwnerAddress1,OwnerAddress2,OwnerCity,OwnerState,OwnerZipCode,AddressLine1,CityStateZip,TotalAcres,GISAcres,TotalLandValue,PropType,CountyName",
    orderBy: "TotalLandValue ASC",
    baseWhere: `CountyName='${countyName}' AND PropType='Vacant Land'`,
    fields: {
      apn: ["PARCELID", "AssessmentCode"],
      owner: ["OwnerName", "CareOfTaxpayer"],
      mailAddress: ["OwnerAddress1", "OwnerAddress2"],
      mailCity: "OwnerCity", mailState: "OwnerState", mailZip: "OwnerZipCode",
      situs: ["AddressLine1", "CityStateZip"], situsJoin: ", ",
      use: ["PropType"], useConst: "VACANT",
      acres: "TotalAcres",
      value: "TotalLandValue",
    },
    searchFields: { owner: "OwnerName", apn: "PARCELID", mailState: "OwnerState", value: "TotalLandValue" },
  };
}

/**
 * IDAHO ISTC proxy'si arkasındaki county servisleri (Elmore/Lemhi ortak şema).
 * ⚠ Doğru `Referer` olmadan yanıt VERMEZ — ISTC uygulamayı değiştirirse ölür.
 * ⚠ `OWNERSHIP` alanı sahip adı DEĞİL (tenür); `PM_MAIL_NM` kullanılır.
 */
function idIstc(endpoint: string, referer: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint,
    headers: { Referer: referer },
    outFields: "PM_PAR_NUM,PARCEL_ID,PM_MAIL_NM,PM_MAIL_A1,PM_MAIL_A2,PM_MAIL_CT,PM_MAIL_ST,PM_MAIL_ZP,PM_PROP_AD,Acres,PM_LND_VAL,PM_IMP_VAL,PM_CATS",
    orderBy: "PM_LND_VAL ASC",
    baseWhere: "PM_IMP_VAL=0 AND PM_LND_VAL>0",
    fields: {
      apn: ["PM_PAR_NUM", "PARCEL_ID"],
      owner: ["PM_MAIL_NM"],
      mailAddress: ["PM_MAIL_A1", "PM_MAIL_A2"],
      mailCity: "PM_MAIL_CT", mailState: "PM_MAIL_ST", mailZip: "PM_MAIL_ZP",
      situs: ["PM_PROP_AD"],
      use: ["PM_CATS"], useConst: "VACANT",
      acres: "Acres",
      value: "PM_LND_VAL",
    },
    searchFields: { owner: "PM_MAIL_NM", apn: "PM_PAR_NUM", mailState: "PM_MAIL_ST", value: "PM_LND_VAL" },
  };
}

/**
 * MISSISSIPPI eyalet geneli MARIS katmanı — 82 county, 1.994.839 parsel.
 * İki sunucuya bölünmüş: "West" ve "East". Sahip + tam posta + arsa değeri dolu.
 * ⚠ Boş alanlar NULL değil TEK BOŞLUK (' ') — filtre buna göre.
 * ⚠ CNTYNAME boşluksuz yazılır (ör. 'PEARLRIVER').
 */
function msStatewide(yarim: "West" | "East", countyName: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint: `https://gis.mississippi.edu/server/rest/services/Cadastral/MS_${yarim}_Parcels/MapServer/0/query`,
    // ⚠ Bu servis resultRecordCount kabul etmiyor ("Pagination is not supported").
    noPagination: true,
    outFields: "PARNO,OWNNAME,MAILADD1,MAILADD2,MCITY1,MSTATE1,MZIP1,SITEADD,TAXACRES,GISACRES,LANDVAL,IMPVAL1,IMPVAL2,ZONING,CNTYNAME",
    orderBy: "LANDVAL ASC",
    baseWhere: `CNTYNAME='${countyName}' AND IMPVAL1=0 AND IMPVAL2=0 AND LANDVAL>0 AND OWNNAME<>' ' AND MAILADD1<>' '`,
    fields: {
      apn: ["PARNO"],
      owner: ["OWNNAME"],
      mailAddress: ["MAILADD1", "MAILADD2"],
      mailCity: "MCITY1", mailState: "MSTATE1", mailZip: "MZIP1",
      situs: ["SITEADD"],
      use: ["ZONING"], useConst: "VACANT",
      acres: "TAXACRES",
      value: "LANDVAL",
    },
    searchFields: { owner: "OWNNAME", apn: "PARNO", mailState: "MSTATE1", value: "LANDVAL" },
  };
}

/**
 * WEST VIRGINIA eyalet geneli WVU GIS katmanı — 1.389.855 parsel, %98,8'inde sahip adı.
 * ⚠ Ayrı şehir/eyalet/zip alanı YOK: `FullOwnerAddress` tek string
 *   ("612 18TH ST, VIENNA, WV 26105") → birleşik adres ayrıştırıcısı kullanılır.
 * ⚠ Arazi DEĞERİ yok. Boş arsa sinyali: fiziksel adres boş + Acres_C eşiği.
 */
function wvStatewide(countyId: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint: "https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0/query",
    outFields: "CleanParcelID,Label,GISPID,FullOwnerName,FullOwnerAddress,FullPhysicalAddress,Acres_C,FullLegalDescription,CountyID",
    orderBy: "Acres_C DESC",
    baseWhere: `CountyID='${countyId}' AND FullOwnerName IS NOT NULL AND FullOwnerAddress IS NOT NULL AND FullPhysicalAddress='' AND Acres_C>=0.5`,
    fields: {
      apn: ["CleanParcelID", "Label", "GISPID"],
      owner: ["FullOwnerName"],
      mailCombined: "FullOwnerAddress",
      situs: ["FullLegalDescription"],
      useConst: "VACANT",
      acres: "Acres_C",
    },
    searchFields: { owner: "FullOwnerName", apn: "CleanParcelID" },
  };
}

/** ALABAMA "KCS GIS" ağı — onlarca county AYNI şemayı paylaşır. */
function alKcs(endpoint: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint,
    outFields: "PARCELID,Owner,MailAdd1,MailAdd2,MailCity,MailState,MailZip1,SitusAddName,CalcAcres,CLandValue,CImpValue",
    orderBy: "CLandValue ASC",
    baseWhere: "CImpValue=0 AND Owner IS NOT NULL AND Owner<>''",
    fields: {
      apn: ["PARCELID"],
      owner: ["Owner"],
      mailAddress: ["MailAdd1", "MailAdd2"],
      mailCity: "MailCity", mailState: "MailState", mailZip: "MailZip1",
      situs: ["SitusAddName"],
      useConst: "VACANT",
      acres: "CalcAcres",
      value: "CLandValue",
    },
    searchFields: { owner: "Owner", apn: "PARCELID", mailState: "MailState", value: "CLandValue" },
  };
}

/** ALABAMA Greene — kendi ArcGIS Online şeması (şema canlı servisten doğrulandı). */
function alGreene(endpoint: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint,
    outFields: "PARCEL_ID,PPIN,ACCOUNTNO,FULLNAME,CONAME,FULLADDRES,CITY,STATE,ZIPCODE,LEGAL,TOTAL_ACRE,LAND_APPR,IMP_APPR",
    orderBy: "LAND_APPR ASC",
    baseWhere: "IMP_APPR=0 AND LAND_APPR>0 AND FULLNAME IS NOT NULL AND FULLNAME<>''",
    fields: {
      apn: ["PARCEL_ID", "PPIN", "ACCOUNTNO"],
      owner: ["FULLNAME", "CONAME"],
      mailAddress: ["FULLADDRES"],
      mailCity: "CITY", mailState: "STATE", mailZip: "ZIPCODE",
      situs: ["LEGAL"],
      useConst: "VACANT",
      acres: "TOTAL_ACRE",
      value: "LAND_APPR",
    },
    searchFields: { owner: "FULLNAME", apn: "PARCEL_ID", mailState: "STATE", value: "LAND_APPR" },
  };
}

/** ALABAMA Macon — Greene'den FARKLI şema (canlı servisten doğrulandı). */
function alMacon(endpoint: string): ArcGisSource {
  return {
    kind: "arcgis",
    endpoint,
    outFields: "PARCEL_ID,PPIN,ACCOUNT,OWNERNAME,CONAME,ADDRESS1,ADDRESS2,CITY,STATE,ZIP,SITUS_ADDR,PROPADDR1,TOTAL_AC,LAND_VAL,IMP_VAL",
    orderBy: "LAND_VAL ASC",
    baseWhere: "IMP_VAL=0 AND LAND_VAL>0 AND OWNERNAME IS NOT NULL AND OWNERNAME<>''",
    fields: {
      apn: ["PARCEL_ID", "PPIN", "ACCOUNT"],
      owner: ["OWNERNAME", "CONAME"],
      mailAddress: ["ADDRESS1", "ADDRESS2"],
      mailCity: "CITY", mailState: "STATE", mailZip: "ZIP",
      situs: ["SITUS_ADDR", "PROPADDR1"], situsJoin: ", ",
      useConst: "VACANT",
      acres: "TOTAL_AC",
      value: "LAND_VAL",
    },
    searchFields: { owner: "OWNERNAME", apn: "PARCEL_ID", mailState: "STATE", value: "LAND_VAL" },
  };
}

/** Regrid ülke geneli yedek kaynağı (ücretli — kota + önbellek korumalı). */
function regrid(state: string, county: string): RegridSource {
  return {
    kind: "regrid",
    path: `/us/${state.toLowerCase()}/${county.toLowerCase().replace(/[^a-z]/g, "")}`,
    vacantKeywords: ["VACANT", "UNIMPROVED", "RAW LAND"],
  };
}

// ── Kayıt yardımcısı ────────────────────────────────────────────────────────
interface Girdi {
  key: string;
  label?: string;
  state: string;
  county: string;
  region?: string;
  leadIdPrefix?: string;
  sources: CountyEntry["sources"];
  hasValue: boolean;
  bilinenDurum: CountyEntry["bilinenDurum"];
  not?: string;
}

function kayit(g: Girdi): [string, CountyEntry] {
  return [g.key, {
    label: g.label ?? `${g.county} County, ${g.state}`,
    state: g.state,
    county: g.county,
    region: g.region ?? `${g.county} County`,
    leadIdPrefix: g.leadIdPrefix ?? `${g.state}-${g.county.replace(/\s+/g, "")}`,
    sources: g.sources,
    hasValue: g.hasValue,
    bilinenDurum: g.bilinenDurum,
    not: g.not,
  }];
}

// ═══════════════════════════════════════════════════════════════════════════
// KAYIT DEFTERİ
// ═══════════════════════════════════════════════════════════════════════════

const GIRDILER: Girdi[] = [
  // ── COLORADO ──────────────────────────────────────────────────────────────
  {
    key: "co-costilla", state: "CO", county: "Costilla", leadIdPrefix: "CO-Costilla",
    hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services7.arcgis.com/qznFlX1g8SfaPebZ/arcgis/rest/services/Costilla_County_FGDB_May_Update/FeatureServer/8/query",
      outFields: "ParcelNum,Parcel,Owner_Name,Additional_Owners,Mailing_Address,Mailing_City,Mailing_State,Mailing_Zip,Total_Value,Total_Area,Location_Street_Number,Location_Street",
      orderBy: "Total_Value ASC",
      baseWhere: "Total_Value>0 AND Mailing_State IS NOT NULL AND Mailing_State<>''",
      fields: {
        apn: ["ParcelNum", "Parcel"],
        owner: ["Owner_Name", "Additional_Owners"],
        mailAddress: ["Mailing_Address"],
        mailCity: "Mailing_City", mailState: "Mailing_State", mailZip: "Mailing_Zip",
        situs: ["Location_Street_Number", "Location_Street"],
        useConst: "VACANT",
        acres: "Total_Area",
        value: "Total_Value",
      },
      searchFields: { owner: "Owner_Name", apn: "ParcelNum", mailState: "Mailing_State", value: "Total_Value" },
    }],
  },
  {
    key: "co-lasanimas", state: "CO", county: "Las Animas", leadIdPrefix: "CO-LasAnimas",
    hasValue: false, bilinenDurum: "calisiyor", not: "Değer alanı yok — fiyat filtresi çalışmaz.",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services7.arcgis.com/NWWOCaXnjdetEWUz/arcgis/rest/services/LasAnimasParcels/FeatureServer/2/query",
      outFields: "ACCOUNTNO,ParcelNum,NAME,CAREOF,ADDRESS1,ADDRESS2,CITY,STATE,ZIPCODEM,SitusWhole,FullAddres,ACRES,ACCTTYPE",
      orderBy: "OBJECTID ASC",
      baseWhere: "ACCTTYPE LIKE '%VACANT%' AND STATE IS NOT NULL AND STATE<>''",
      fields: {
        apn: ["ACCOUNTNO", "ParcelNum"],
        owner: ["NAME"],
        mailAddress: ["ADDRESS1", "ADDRESS2"],
        mailCity: "CITY", mailState: "STATE", mailZip: "ZIPCODEM",
        situs: ["SitusWhole", "FullAddres"],
        use: ["ACCTTYPE"], useConst: "VACANT_LAND",
        acres: "ACRES",
      },
      searchFields: { owner: "NAME", apn: "ACCOUNTNO", mailState: "STATE" },
    }],
  },
  // ⚠ CO eyalet katmanında `landUseDsc` STANDART DEĞİL: bazı county'ler
  // açıklama ("VACANT LAND"), bazıları county'ye özel opak kod yazıyor
  // (Pueblo="70E"/"04AB", Saguache benzeri). Kod yazan county'lerde boş-arsa
  // filtresi kurulamıyor; iyileştirme alan alan kod eşlemesi gerektirir.
  { key: "co-pueblo", state: "CO", county: "Pueblo", hasValue: true, bilinenDurum: "veri-yok", not: "CO eyalet katmanı Pueblo için arazi kullanımını opak kod olarak veriyor (70E/04AB) — boş-arsa filtresi kurulamıyor. 101.146 parsel var ama ayıklanamıyor.", sources: [coStatewide("Pueblo")] },
  { key: "co-saguache", state: "CO", county: "Saguache", hasValue: true, bilinenDurum: "veri-yok", not: "Aynı sorun: arazi kullanımı kodla verilmiş. 14.388 parsel var, boş arsa ayıklanamıyor.", sources: [coStatewide("Saguache")] },
  { key: "co-conejos", state: "CO", county: "Conejos", hasValue: true, bilinenDurum: "veri-yok", not: "CO eyalet katmanında Conejos HİÇ YOK (0 parsel). County kendi servisini yayınlamıyor.", sources: [coStatewide("Conejos")] },
  { key: "co-park", state: "CO", county: "Park", hasValue: true, bilinenDurum: "calisiyor", sources: [coStatewide("Park")] },

  // ── NEW MEXICO ────────────────────────────────────────────────────────────
  {
    key: "nm-valencia", state: "NM", county: "Valencia", leadIdPrefix: "NM-Valencia",
    hasValue: true, bilinenDurum: "calisiyor",
    not: "Ayrı posta-eyaleti alanı yok; adres tek alandan (OwnerAddre) ayrıştırılır.",
    sources: [{
      kind: "arcgis",
      endpoint: "https://arcgisce2.co.valencia.nm.us/arcgis/rest/services/GIS_OnlineMap/MapServer/14/query",
      outFields: "UPC,AccountNum,Owner,OwnerAddre,Situs,LANDACT,ActualValu,LANDASD,Shape_Area",
      orderBy: "UPC ASC",
      baseWhere: "IMPASD=0 AND LANDACT>0",
      fields: {
        apn: ["UPC", "AccountNum"],
        owner: ["Owner"],
        mailCombined: "OwnerAddre",
        situs: ["Situs"],
        useConst: "VACANT",
        acres: "Shape_Area", acresFrom: "shapeAreaSqft",
        value: "LANDACT",
      },
      searchFields: { owner: "Owner", apn: "UPC", value: "LANDACT" },
    }],
  },
  {
    key: "nm-luna", state: "NM", county: "Luna", hasValue: false, bilinenDurum: "servis-kapali",
    not: "Ücretsiz ArcGIS bulunamadı — yalnızca Regrid yedeği tanımlı.",
    sources: [regrid("NM", "Luna")],
  },

  // ── ARIZONA ───────────────────────────────────────────────────────────────
  {
    key: "az-mohave", state: "AZ", county: "Mohave", leadIdPrefix: "AZ-Mohave",
    hasValue: true, bilinenDurum: "servis-kapali",
    not: "mcgis.mohave.gov TCP bağlantısı kurulmuyor (2026-07-28 ölçümü). Regrid yedeği tanımlı ama anahtar süresi dolmuş.",
    sources: [
      {
        kind: "arcgis",
        endpoint: "https://mcgis.mohave.gov/arcgis/rest/services/Mohave/MapServer/38/query",
        outFields: "PARCEL,OWNER,OWNER_2,MAILING_ADDRESS,CITY,STATE,ZIP,SITE_ADDRESS,PROPUSE,USE_CODE,PARCEL_SIZE,LANDVALUE,FULL_CASH_VALUE",
        orderBy: "LANDVALUE ASC",
        baseWhere: "IMPVALUE=0 AND LANDVALUE>0 AND STATE<>''",
        fields: {
          apn: ["PARCEL"],
          owner: ["OWNER", "OWNER_2"],
          mailAddress: ["MAILING_ADDRESS"],
          mailCity: "CITY", mailState: "STATE", mailZip: "ZIP",
          situs: ["SITE_ADDRESS"],
          use: ["PROPUSE", "USE_CODE"], useConst: "VACANT",
          acres: "PARCEL_SIZE",
          value: "LANDVALUE",
        },
        searchFields: { owner: "OWNER", apn: "PARCEL", mailState: "STATE", value: "LANDVALUE" },
      },
      regrid("AZ", "Mohave"),
    ],
  },
  { key: "az-apache", state: "AZ", county: "Apache", hasValue: false, bilinenDurum: "servis-kapali", not: "Ücretsiz ArcGIS bulunamadı.", sources: [regrid("AZ", "Apache")] },
  { key: "az-navajo", state: "AZ", county: "Navajo", hasValue: false, bilinenDurum: "servis-kapali", not: "Ücretsiz ArcGIS bulunamadı.", sources: [regrid("AZ", "Navajo")] },
  { key: "az-cochise", state: "AZ", county: "Cochise", hasValue: false, bilinenDurum: "servis-kapali", not: "Ücretsiz ArcGIS bulunamadı.", sources: [regrid("AZ", "Cochise")] },

  // ── FLORIDA ───────────────────────────────────────────────────────────────
  {
    key: "fl-lee", state: "FL", county: "Lee", leadIdPrefix: "FL-Lee",
    hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/arcgis/rest/services/Lee_County_Parcels/FeatureServer/0/query",
      outFields: "STRAP,O_NAME,O_OTHERS,O_ADDR1,O_ADDR2,O_CITY,O_STATE,O_ZIP,LAND,JUST,GISACRES,SITEADDR,SITECITY,LANDUSEDES,DORCODE",
      orderBy: "LAND ASC",
      baseWhere: "DORCODE LIKE '00%' AND O_STATE IS NOT NULL AND O_STATE<>''",
      fields: {
        apn: ["STRAP"],
        owner: ["O_NAME", "O_OTHERS"],
        mailAddress: ["O_ADDR1", "O_ADDR2"],
        mailCity: "O_CITY", mailState: "O_STATE", mailZip: "O_ZIP",
        situs: ["SITEADDR", "SITECITY"], situsJoin: ", ",
        use: ["LANDUSEDES"], useConst: "Vacant",
        acres: "GISACRES", acresPrecision: 3, acresAllowZero: true,
        value: "LAND",
      },
      searchFields: { owner: "O_NAME", apn: "STRAP", mailState: "O_STATE", value: "LAND" },
    }],
  },
  { key: "fl-charlotte", state: "FL", county: "Charlotte", hasValue: true, bilinenDurum: "calisiyor", sources: [flStatewide(18)] },
  { key: "fl-putnam", state: "FL", county: "Putnam", hasValue: true, bilinenDurum: "calisiyor", sources: [flStatewide(64)] },
  { key: "fl-highlands", state: "FL", county: "Highlands", hasValue: true, bilinenDurum: "calisiyor", sources: [flStatewide(38)] },
  { key: "fl-citrus", state: "FL", county: "Citrus", hasValue: true, bilinenDurum: "calisiyor", sources: [flStatewide(19)] },
  { key: "fl-marion", state: "FL", county: "Marion", hasValue: true, bilinenDurum: "calisiyor", sources: [flStatewide(52)] },
  { key: "fl-brevard", state: "FL", county: "Brevard", hasValue: true, bilinenDurum: "calisiyor", sources: [flStatewide(15)] },
  { key: "fl-levy", state: "FL", county: "Levy", hasValue: true, bilinenDurum: "calisiyor", sources: [flStatewide(48)] },
  { key: "fl-polk", state: "FL", county: "Polk", hasValue: true, bilinenDurum: "servis-kapali", sources: [flStatewide(63)] },

  // ── TEXAS ─────────────────────────────────────────────────────────────────
  { key: "tx-brewster", state: "TX", county: "Brewster", leadIdPrefix: "TX-brewster", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("6", "rQ0f7V2sPSbAKMbv", "Brewster")] },
  { key: "tx-hudspeth", state: "TX", county: "Hudspeth", leadIdPrefix: "TX-hudspeth", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("6", "TCoMB3SwAXtBwSdM", "Hudspeth")] },
  { key: "tx-presidio", state: "TX", county: "Presidio", leadIdPrefix: "TX-presidio", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("3", "olwlVbUZZ1LTljgD", "Presidio")] },
  { key: "tx-terrell", state: "TX", county: "Terrell", leadIdPrefix: "TX-terrell", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("3", "g3gXc91BCpz3M4tF", "Terrell")] },
  { key: "tx-liberty", state: "TX", county: "Liberty", leadIdPrefix: "TX-libertytx", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("3", "LbQai106UcFy2LlR", "Liberty")] },
  { key: "tx-cherokee", state: "TX", county: "Cherokee", leadIdPrefix: "TX-cherokee", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("5", "tyTfZP6fpe41IyyO", "Cherokee")] },
  { key: "tx-harrison", state: "TX", county: "Harrison", leadIdPrefix: "TX-harrison", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("5", "9EzFuq4pvjRgSIO3", "Harrison")] },
  { key: "tx-brazoria", state: "TX", county: "Brazoria", leadIdPrefix: "TX-brazoria", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("6", "j94FvPaik4etwHFk", "Brazoria")] },
  { key: "tx-cochran", state: "TX", county: "Cochran", leadIdPrefix: "TX-cochran", hasValue: true, bilinenDurum: "calisiyor", sources: [txBis("2", "d7f5jhAosYNYotdL", "Cochran")] },

  // ── NEVADA ────────────────────────────────────────────────────────────────
  {
    key: "nv-nye", state: "NV", county: "Nye", hasValue: true, bilinenDurum: "calisiyor",
    not: "Posta eyaleti ayrı alan değil — mcity 'CITY, ST' biçiminde.",
    sources: [{
      kind: "arcgis", method: "POST",
      endpoint: "https://services7.arcgis.com/AvZJsNr6HZ4v00zd/arcgis/rest/services/Nye_County_Planning_Department_WFL1/FeatureServer/4/query",
      outFields: "PARCELID,parcel_num,assess_nam,legal_name,address1,address2,mcity,mzip,SITEADDRES,phys_addr,USEDSCRP,STATEDAREA,land_value,improv_val",
      orderBy: "land_value ASC",
      baseWhere: "improv_val=0 AND land_value>0 AND assess_nam<>' ' AND address1<>' '",
      fields: {
        apn: ["parcel_num", "PARCELID"],
        owner: ["assess_nam", "legal_name"],
        mailAddress: ["address1", "address2"],
        mailCity: "mcity", mailCityHasState: true, mailZip: "mzip",
        situs: ["SITEADDRES", "phys_addr"],
        use: ["USEDSCRP"], useConst: "VACANT",
        acres: "STATEDAREA",
        value: "land_value",
      },
      searchFields: { owner: "assess_nam", apn: "parcel_num", value: "land_value" },
    }],
  },

  // ── OREGON ────────────────────────────────────────────────────────────────
  {
    key: "or-klamath", state: "OR", county: "Klamath", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/KC_Taxlots/FeatureServer/1/query",
      outFields: "PROP_ID,MAP_TAXLOT,OWNER_NAME,MAIL1,MAIL2,MAILCITY,MAILST,ZIP,GIS_Acres,ACREAGE,LND_APPR,IMP_APPR,PROP_CLASS,SITUS_ADDRESS,SITUSCITY",
      orderBy: "LND_APPR ASC",
      baseWhere: "IMP_APPR=0 AND LND_APPR>0 AND OWNER_NAME IS NOT NULL AND MAIL1 IS NOT NULL",
      fields: {
        apn: ["MAP_TAXLOT", "PROP_ID"],
        owner: ["OWNER_NAME"],
        mailAddress: ["MAIL1", "MAIL2"],
        mailCity: "MAILCITY", mailState: "MAILST", mailZip: "ZIP",
        situs: ["SITUS_ADDRESS", "SITUSCITY"], situsJoin: ", ",
        use: ["PROP_CLASS"], useConst: "VACANT",
        acres: "GIS_Acres",
        value: "LND_APPR",
      },
      searchFields: { owner: "OWNER_NAME", apn: "MAP_TAXLOT", mailState: "MAILST", value: "LND_APPR" },
    }],
  },
  {
    key: "or-lake", state: "OR", county: "Lake", hasValue: false, bilinenDurum: "calisiyor",
    not: "Değer alanı yok — fiyat ayrı 2020 katmanından backfill ediliyor.",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/LakeCoTaxlots/FeatureServer/0/query",
      outFields: "MapTaxlot,ORTaxlot,OwnerLine1,OwnerLine2,MailAdd1,MailAdd2,MailCity,MailState,MailZip,TaxlotAcre,PrpClass,SiteAddNam,SiteAddCty",
      orderBy: "MapTaxlot ASC",
      baseWhere: "PrpClass IN ('100','109','400','409') AND MailAdd1 IS NOT NULL AND MailAdd1<>''",
      fields: {
        apn: ["MapTaxlot", "ORTaxlot"],
        owner: ["OwnerLine1", "OwnerLine2"],
        mailAddress: ["MailAdd1", "MailAdd2"],
        mailCity: "MailCity", mailState: "MailState", mailZip: "MailZip",
        situs: ["SiteAddNam", "SiteAddCty"], situsJoin: ", ",
        use: ["PrpClass"], useConst: "VACANT",
        acres: "TaxlotAcre",
      },
      searchFields: { owner: "OwnerLine1", apn: "MapTaxlot", mailState: "MailState" },
    }],
  },

  // ── SOUTH CAROLINA ────────────────────────────────────────────────────────
  {
    key: "sc-colleton", state: "SC", county: "Colleton", hasValue: false, bilinenDurum: "calisiyor",
    not: "Değer alanı yok — fiyat filtresi çalışmaz.",
    sources: [{
      kind: "arcgis", method: "POST",
      endpoint: "https://services1.arcgis.com/m0cnLGKdhwao8WvM/arcgis/rest/services/Public_Data/FeatureServer/2/query",
      outFields: "PIN,OwnerName1,OwnerName2,OwnerAddress1,OwnerCity,OwnerState,OwnerZip,PropertyClass,LegalAcres,Acreage,PropertyAddress,PropertyCity",
      orderBy: "PIN ASC",
      baseWhere: "PropertyClass LIKE 'VACANT%' AND OwnerAddress1 IS NOT NULL AND OwnerAddress1<>''",
      fields: {
        apn: ["PIN"],
        owner: ["OwnerName1", "OwnerName2"],
        mailAddress: ["OwnerAddress1"],
        mailCity: "OwnerCity", mailState: "OwnerState", mailZip: "OwnerZip",
        situs: ["PropertyAddress", "PropertyCity"], situsJoin: ", ",
        use: ["PropertyClass"], useConst: "VACANT",
        acres: "LegalAcres",
      },
      searchFields: { owner: "OwnerName1", apn: "PIN", mailState: "OwnerState" },
    }],
  },

  // ── MISSOURI ──────────────────────────────────────────────────────────────
  {
    key: "mo-camden", state: "MO", county: "Camden", hasValue: false, bilinenDurum: "servis-kapali",
    not: "Değer alanı yok (7/8/86 katmanlarının hiçbirinde).",
    sources: [{
      kind: "arcgis", method: "POST",
      endpoint: "https://services8.integritygis.com/arcgis/rest/services/MO/Camden_Assessor_Data/MapServer/7/query",
      outFields: "PID,PARCEL_NUMBER,DEEDHOLDER,DEEDHOLDER_NAME2,MAILING_ADDRESS_LINE1,MAILING_ADDRESS_CITY,MAILING_ADDRESS_STATE,MAILING_ADDRESS_POSTAL_CODE,GIS_ACRES,DEED_ACRES,PARCEL_LOCATION",
      orderBy: "PID ASC",
      baseWhere: "LAND_USE=0 AND MAIN_YEAR_BUILT IS NULL AND PARCEL_CLASS='01 RESIDENTIAL'",
      fields: {
        apn: ["PARCEL_NUMBER", "PID"],
        owner: ["DEEDHOLDER", "DEEDHOLDER_NAME2"],
        mailAddress: ["MAILING_ADDRESS_LINE1"],
        mailCity: "MAILING_ADDRESS_CITY", mailState: "MAILING_ADDRESS_STATE", mailZip: "MAILING_ADDRESS_POSTAL_CODE",
        situs: ["PARCEL_LOCATION"],
        useConst: "VACANT RESIDENTIAL",
        acres: "GIS_ACRES",
      },
      searchFields: { owner: "DEEDHOLDER", apn: "PARCEL_NUMBER", mailState: "MAILING_ADDRESS_STATE" },
    }],
  },

  // ── GEORGIA ───────────────────────────────────────────────────────────────
  {
    key: "ga-bibb", state: "GA", county: "Bibb", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services2.arcgis.com/zPFLSOZ5HzUzzTQb/arcgis/rest/services/Parcel_CAMA2022/FeatureServer/0/query",
      outFields: "PARCEL_NO,LASTNAME,ADDRESS1,ADDRESS2,ADDRESS3,CITY,STATE,ZIP,SITEADDRES,LANDVAL,TOTALACRES,CALC_ACRE",
      orderBy: "LANDVAL ASC",
      baseWhere: "LANDVAL>0 AND FMVRES=0 AND FMVCOM=0 AND FMVACC=0",
      fields: {
        apn: ["PARCEL_NO"],
        owner: ["LASTNAME"],
        mailAddress: ["ADDRESS1", "ADDRESS2", "ADDRESS3"],
        mailCity: "CITY", mailState: "STATE", mailZip: "ZIP",
        situs: ["SITEADDRES"],
        useConst: "VACANT",
        acres: "TOTALACRES",
        value: "LANDVAL",
      },
      searchFields: { owner: "LASTNAME", apn: "PARCEL_NO", mailState: "STATE", value: "LANDVAL" },
    }],
  },
  {
    key: "ga-chatham", state: "GA", county: "Chatham", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://pub.sagis.org/arcgis/rest/services/Pictometry/ParcelDigest/MapServer/0/query",
      outFields: "PIN,Owner,Owner2,Mailing_Address,Mailing_City,Mailing_State,Mailing_Zip,PropAddress_Full,PropAddress_City,FMV_Land,FMV_Building,Acres,Property_Use",
      orderBy: "FMV_Land ASC",
      baseWhere: "FMV_Building=0 AND FMV_Land>0",
      fields: {
        apn: ["PIN"],
        owner: ["Owner", "Owner2"],
        mailAddress: ["Mailing_Address"],
        mailCity: "Mailing_City", mailState: "Mailing_State", mailZip: "Mailing_Zip",
        situs: ["PropAddress_Full", "PropAddress_City"], situsJoin: ", ",
        use: ["Property_Use"], useConst: "VACANT",
        acres: "Acres",
        value: "FMV_Land",
      },
      searchFields: { owner: "Owner", apn: "PIN", mailState: "Mailing_State", value: "FMV_Land" },
    }],
  },

  // ── MICHIGAN ──────────────────────────────────────────────────────────────
  {
    key: "mi-roscommon", state: "MI", county: "Roscommon", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis", method: "POST",
      endpoint: "https://services3.arcgis.com/rAGekBpQuVeYptc1/arcgis/rest/services/Parcel62923_2/FeatureServer/146/query",
      outFields: "PIN,ownername1,ownername2,ownerstreetaddr,ownercity,ownerstate,ownerzip,propclass,mborsev,Acres,propstreetcombined",
      orderBy: "mborsev ASC",
      baseWhere: "propclass IN (102,202,302,402) AND mborsev>0",
      fields: {
        apn: ["PIN"],
        owner: ["ownername1", "ownername2"],
        mailAddress: ["ownerstreetaddr"],
        mailCity: "ownercity", mailState: "ownerstate", mailZip: "ownerzip",
        situs: ["propstreetcombined"],
        useConst: "VACANT",
        acres: "Acres",
        value: "mborsev",
      },
      searchFields: { owner: "ownername1", apn: "PIN", mailState: "ownerstate", value: "mborsev" },
    }],
  },

  // ── NORTH CAROLINA ────────────────────────────────────────────────────────
  { key: "nc-brunswick", state: "NC", county: "Brunswick", hasValue: true, bilinenDurum: "calisiyor", sources: [ncOneMap("Brunswick")] },
  { key: "nc-rutherford", state: "NC", county: "Rutherford", hasValue: true, bilinenDurum: "calisiyor", sources: [ncOneMap("Rutherford")] },
  { key: "nc-northampton", state: "NC", county: "Northampton", hasValue: true, bilinenDurum: "calisiyor", sources: [ncOneMap("Northampton")] },

  // ── ARKANSAS ──────────────────────────────────────────────────────────────
  // ⚠ AR eyalet geneli katmanında POSTA ADRESİ YOK (adrlabel = parselin kendi
  // adresi, sahibin posta adresi değil). Mektup atılamaz → kaynak tanımlanmadı.
  { key: "ar-sharp", state: "AR", county: "Sharp", hasValue: false, bilinenDurum: "servis-kapali", not: "AR eyalet katmanında sahibin POSTA ADRESİ yok — mektup atılamaz. Regrid yedeği anahtar yenilenince denenmeli.", sources: [regrid("AR", "Sharp")] },
  { key: "ar-izard", state: "AR", county: "Izard", hasValue: false, bilinenDurum: "servis-kapali", not: "AR eyalet katmanında posta adresi yok.", sources: [regrid("AR", "Izard")] },
  { key: "ar-vanburen", state: "AR", county: "Van Buren", hasValue: false, bilinenDurum: "servis-kapali", not: "AR eyalet katmanında posta adresi yok.", sources: [regrid("AR", "VanBuren")] },

  // ── MISSISSIPPI ───────────────────────────────────────────────────────────
  // ⭐ Eyalet geneli MARIS: 82 county, 1.994.839 parsel, iki sunucuya bölünmüş.
  // Sahip + tam posta + arsa değeri + acreage hepsi dolu (%96-99 kapsama).
  // ⚠ Kullanma: Hinds (0 sahip), Hancock %4, Marshall %10, Lauderdale %8.
  { key: "ms-amite", state: "MS", county: "Amite", hasValue: true, bilinenDurum: "calisiyor", sources: [msStatewide("West", "AMITE")] },
  { key: "ms-wilkinson", state: "MS", county: "Wilkinson", hasValue: true, bilinenDurum: "calisiyor", sources: [msStatewide("West", "WILKINSON")] },
  { key: "ms-jefferson", state: "MS", county: "Jefferson", hasValue: true, bilinenDurum: "calisiyor", sources: [msStatewide("West", "JEFFERSON")] },
  { key: "ms-claiborne", state: "MS", county: "Claiborne", hasValue: true, bilinenDurum: "calisiyor", sources: [msStatewide("West", "CLAIBORNE")] },
  { key: "ms-kemper", state: "MS", county: "Kemper", hasValue: true, bilinenDurum: "calisiyor", sources: [msStatewide("East", "KEMPER")] },

  // ── WEST VIRGINIA ─────────────────────────────────────────────────────────
  // ⭐ Eyalet geneli WVU GIS: 1.389.855 parsel. CountyID alfabetik sıra (01-55).
  // ⚠ Arazi DEĞERİ yok; posta adresi tek birleşik string.
  { key: "wv-wirt", state: "WV", county: "Wirt", hasValue: false, bilinenDurum: "calisiyor", not: "Değer alanı yok. Posta adresi tek string, ayrıştırılıyor.", sources: [wvStatewide("53")] },
  { key: "wv-clay", state: "WV", county: "Clay", hasValue: false, bilinenDurum: "calisiyor", not: "Değer alanı yok.", sources: [wvStatewide("08")] },
  { key: "wv-calhoun", state: "WV", county: "Calhoun", hasValue: false, bilinenDurum: "calisiyor", not: "Değer alanı yok.", sources: [wvStatewide("07")] },
  { key: "wv-webster", state: "WV", county: "Webster", hasValue: false, bilinenDurum: "calisiyor", not: "Değer alanı yok.", sources: [wvStatewide("51")] },
  { key: "wv-mcdowell", state: "WV", county: "McDowell", hasValue: false, bilinenDurum: "calisiyor", not: "Değer alanı yok; boş arsa sayısı düşük (~120).", sources: [wvStatewide("24")] },

  // ── ALABAMA ───────────────────────────────────────────────────────────────
  // ⚠ Eyalet geneli servis YOK. Hedeflenen 5 ucuz county (Wilcox, Perry, Lowndes,
  // Choctaw, Clarke) KULLANILAMAZ: Flagship GIS üzerindeler veya sahip alanı boş.
  // Yerlerine doğrulanmış kırsal alternatifler alındı.
  { key: "al-greene", state: "AL", county: "Greene", hasValue: true, bilinenDurum: "calisiyor", sources: [alGreene("https://services8.arcgis.com/XI1FxP9uZwSBSNV8/arcgis/rest/services/GreeneAL_Service/FeatureServer/5/query")] },
  { key: "al-macon", state: "AL", county: "Macon", hasValue: true, bilinenDurum: "calisiyor", sources: [alMacon("https://services7.arcgis.com/THz1mnjmEtkl0fFw/arcgis/rest/services/MaconAL_Service/FeatureServer/13/query")] },
  { key: "al-cullman", state: "AL", county: "Cullman", hasValue: true, bilinenDurum: "calisiyor", sources: [alKcs("https://al25portal.kcsgis.com/al25server/rest/services/Cullman_Public_ISV/MapServer/107/query")] },
  { key: "al-dekalb", state: "AL", county: "DeKalb", hasValue: true, bilinenDurum: "calisiyor", sources: [alKcs("https://al28portal.kcsgis.com/al28server/rest/services/Dekalb_Public_ISV/MapServer/48/query")] },
  { key: "al-talladega", state: "AL", county: "Talladega", hasValue: true, bilinenDurum: "calisiyor", sources: [alKcs("https://al61portal.kcsgis.com/al61server/rest/services/Talladega_Public_ISV/MapServer/51/query")] },

  // ── KENTUCKY ──────────────────────────────────────────────────────────────
  // ⚠ EN ZAYIF EYALET. Eyalet geneli parsel servisi YOK. Hedeflenen Doğu KY
  // county'lerinin (Harlan, Bell, Leslie, Elliott, Wolfe) HİÇBİRİNDE ArcGIS yok —
  // hepsi qPublic/Mapping Solutions'ta. Ancak PVA'dan CSV satın alarak gelir.
  // ⚠ kygisserver.ky.gov ve linkgis TÜRKİYE IP'sinden TCP timeout veriyor →
  // hasat ABD bölgeli sunucudan koşmalı.
  {
    key: "ky-pulaski", state: "KY", county: "Pulaski", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services5.arcgis.com/cnJiyVVCFyUslPPa/arcgis/rest/services/ParcelUpdate_2026/FeatureServer/2/query",
      outFields: "parcel_id,owner1,owner2,own_street,own_city,own_state,own_zip,prop_stree,legal_acre,current_la,current_im",
      orderBy: "current_la ASC",
      baseWhere: "current_im=0 AND owner1 IS NOT NULL AND owner1<>''",
      fields: {
        apn: ["parcel_id"],
        owner: ["owner1", "owner2"],
        mailAddress: ["own_street"],
        mailCity: "own_city", mailState: "own_state", mailZip: "own_zip",
        situs: ["prop_stree"],
        useConst: "VACANT",
        acres: "legal_acre",
        value: "current_la",
      },
      searchFields: { owner: "owner1", apn: "parcel_id", mailState: "own_state", value: "current_la" },
    }],
  },
  {
    key: "ky-campbell", state: "KY", county: "Campbell", hasValue: false, bilinenDurum: "calisiyor",
    not: "LinkGIS sunucusu Türkiye IP'sinden erişilemeyebilir — hasat ABD'den koşmalı.",
    sources: [{
      kind: "arcgis",
      endpoint: "https://maps.linkgis.org/server/rest/services/Parcel_QueryOnly/MapServer/0/query",
      outFields: "PIDN,OWNER_NAME_1,OWNER_NAME_2,OWNER_ADDRESS_1,OWNER_ADDRESS_2,OWNER_CITY,OWNER_STATE,OWNER_ZIP_CODE,LOC_ADD,LOT_ACRE,LAND_USE,LAND_VALUE,IMPROVEMENT_VALUE",
      orderBy: "LAND_VALUE ASC",
      baseWhere: "IMPROVEMENT_VALUE=0 AND LAND_VALUE>0 AND OWNER_NAME_1 IS NOT NULL AND OWNER_NAME_1<>''",
      fields: {
        apn: ["PIDN"],
        owner: ["OWNER_NAME_1", "OWNER_NAME_2"],
        mailAddress: ["OWNER_ADDRESS_1", "OWNER_ADDRESS_2"],
        mailCity: "OWNER_CITY", mailState: "OWNER_STATE", mailZip: "OWNER_ZIP_CODE",
        situs: ["LOC_ADD"],
        use: ["LAND_USE"], useConst: "VACANT",
        acres: "LOT_ACRE",
        value: "LAND_VALUE",
      },
      searchFields: { owner: "OWNER_NAME_1", apn: "PIDN", mailState: "OWNER_STATE", value: "LAND_VALUE" },
    }],
  },

  // ── MONTANA ───────────────────────────────────────────────────────────────
  // Eyalet geneli MSDI: 920.897 parsel, 286.441'i "Vacant Land". Tek endpoint.
  { key: "mt-hill", state: "MT", county: "Hill", hasValue: true, bilinenDurum: "calisiyor", sources: [mtStatewide("Hill")] },
  { key: "mt-blaine", state: "MT", county: "Blaine", hasValue: true, bilinenDurum: "calisiyor", sources: [mtStatewide("Blaine")] },
  { key: "mt-phillips", state: "MT", county: "Phillips", hasValue: true, bilinenDurum: "calisiyor", sources: [mtStatewide("Phillips")] },
  { key: "mt-garfield", state: "MT", county: "Garfield", hasValue: true, bilinenDurum: "calisiyor", sources: [mtStatewide("Garfield")] },
  { key: "mt-sanders", state: "MT", county: "Sanders", hasValue: true, bilinenDurum: "calisiyor", sources: [mtStatewide("Sanders")] },

  // ── WYOMING ───────────────────────────────────────────────────────────────
  // ⚠ WY eyalet geneli katmanında (373.666 parsel) sahip+posta VAR ama
  // arazi/yapı değeri ve sınıf alanı YOK → boş arsa ayırt edilemiyor.
  // Bu yüzden county servisleri kullanılıyor.
  {
    key: "wy-carbon", state: "WY", county: "Carbon", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services1.arcgis.com/qEJ3hgR2R81AFChw/arcgis/rest/services/Parcels/FeatureServer/0/query",
      outFields: "pidn,name,address,addresscsz,zip,st_address,acres_tax,acres_calc,total_land,total_imps,accttype",
      orderBy: "total_land ASC",
      baseWhere: "accttype LIKE '%Vacant Land'",
      fields: {
        apn: ["pidn"],
        owner: ["name"],
        mailAddress: ["address"],
        // "EUREKA, KS 67045-4609" → şehir/eyalet/zip tek alanda birleşik
        mailCity: "addresscsz", mailCityHasState: true, mailZip: "zip",
        situs: ["st_address"],
        use: ["accttype"], useConst: "VACANT",
        acres: "acres_tax",
        value: "total_land",
      },
      searchFields: { owner: "name", apn: "pidn", value: "total_land" },
    }],
  },
  {
    key: "wy-fremont", state: "WY", county: "Fremont", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services8.arcgis.com/rlGvD2ZEQWYJHMZp/arcgis/rest/services/OWNERSHIP_FINAL_2026/FeatureServer/0/query",
      outFields: "pidn,ownername,address,addresscsz,st_address,grossacres,netacres,land_val,accttype",
      orderBy: "land_val ASC",
      baseWhere: "accttype LIKE '%Vacant Land'",
      fields: {
        apn: ["pidn"],
        owner: ["ownername"],
        mailAddress: ["address"],
        mailCity: "addresscsz", mailCityHasState: true, // ayrı zip alanı YOK
        situs: ["st_address"],
        use: ["accttype"], useConst: "VACANT",
        acres: "grossacres",
        value: "land_val",
      },
      searchFields: { owner: "ownername", apn: "pidn", value: "land_val" },
    }],
  },
  {
    key: "wy-lincoln", state: "WY", county: "Lincoln", hasValue: false, bilinenDurum: "calisiyor",
    not: "Değer alanı yok. Posta adresi tek birleşik alanda (MAIL_ADD) — ayrıştırılıyor.",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services1.arcgis.com/mAJPyaZkZWzjRIy7/arcgis/rest/services/Public_Download_Parcels/FeatureServer/0/query",
      outFields: "PIN,OWNERSHIP,MAIL_ADD,LOCATION,GR_ACRE,LANDUSE,IMPCNT",
      orderBy: "PIN ASC",
      baseWhere: "LANDUSE LIKE '%Vacant Land%' AND IMPCNT=0",
      fields: {
        apn: ["PIN"],
        owner: ["OWNERSHIP"],
        mailCombined: "MAIL_ADD",
        situs: ["LOCATION"],
        use: ["LANDUSE"], useConst: "VACANT",
        acres: "GR_ACRE",
      },
      searchFields: { owner: "OWNERSHIP", apn: "PIN" },
    }],
  },

  // ── IDAHO ─────────────────────────────────────────────────────────────────
  // ⚠ Idaho Code §74-120: bu veri ÜÇÜNCÜ TARAFA posta listesi olarak SATILAMAZ.
  // Kendi kampanyamızda kullanım ayrı konudur; liste ticareti YAPILMAMALI.
  {
    key: "id-owyhee", state: "ID", county: "Owyhee", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services3.arcgis.com/R0j09uv8w0ny0iXP/arcgis/rest/services/Parcels/FeatureServer/0/query",
      outFields: "RP_NUMBER,PrimaryOwn,MailToName,MailToAddr,MailToAd_1,MailToCity,MailToStat,MailToPost,Situs,Acreage,LandValue,Improvemen,PropClsDes",
      orderBy: "LandValue ASC",
      baseWhere: "Improvemen=0 AND LandValue>0",
      fields: {
        apn: ["RP_NUMBER"],
        owner: ["PrimaryOwn", "MailToName"],
        mailAddress: ["MailToAddr", "MailToAd_1"],
        mailCity: "MailToCity", mailState: "MailToStat", mailZip: "MailToPost",
        situs: ["Situs"],
        use: ["PropClsDes"], useConst: "VACANT",
        acres: "Acreage",
        value: "LandValue",
      },
      searchFields: { owner: "PrimaryOwn", apn: "RP_NUMBER", mailState: "MailToStat", value: "LandValue" },
    }],
  },
  {
    key: "id-cassia", state: "ID", county: "Cassia", hasValue: true, bilinenDurum: "calisiyor",
    not: "ISTC proxy'si arkasında — Referer başlığı zorunlu.",
    sources: [{
      kind: "arcgis",
      endpoint: "https://utility.arcgis.com/usrsvcs/servers/487363dddc414e069ac1717917c70c79/rest/services/Cassia_County_Parcels/FeatureServer/0/query",
      headers: { Referer: "https://experience.arcgis.com/experience/16fa7ed83156466b97b80bd3f7420df7/" },
      outFields: "PIN,Parcel_Num,PrimaryOwnerName,MailToAddress,MailToAddress2,MailToCity,MailToState,MailToPostalCode,Situs,Acreage,LandValue,ImprovementsValue,PropClsDescr",
      orderBy: "LandValue ASC",
      baseWhere: "ImprovementsValue=0 AND LandValue>0",
      fields: {
        apn: ["PIN", "Parcel_Num"],
        owner: ["PrimaryOwnerName"],
        mailAddress: ["MailToAddress", "MailToAddress2"],
        mailCity: "MailToCity", mailState: "MailToState", mailZip: "MailToPostalCode",
        situs: ["Situs"],
        use: ["PropClsDescr"], useConst: "VACANT",
        acres: "Acreage",
        value: "LandValue",
      },
      searchFields: { owner: "PrimaryOwnerName", apn: "PIN", mailState: "MailToState", value: "LandValue" },
    }],
  },
  {
    key: "id-elmore", state: "ID", county: "Elmore", hasValue: true, bilinenDurum: "calisiyor",
    not: "ISTC proxy'si — Referer zorunlu. Sahip adı `PM_MAIL_NM` (posta adı) alanından.",
    sources: [idIstc(
      "https://utility.arcgis.com/usrsvcs/servers/a5adcc0e0f3942e695f803c28bf9e820/rest/services/Elmore_Parcels_Jan_2_2025/FeatureServer/830/query",
      "https://experience.arcgis.com/experience/6ee0ae6fb7184ceea3c640f0345f0392/",
    )],
  },
  {
    key: "id-lemhi", state: "ID", county: "Lemhi", hasValue: true, bilinenDurum: "calisiyor",
    not: "ISTC proxy'si — Referer zorunlu.",
    sources: [idIstc(
      "https://utility.arcgis.com/usrsvcs/servers/3d729df364bc43d3bb2d4da0e9180c6d/rest/services/LemhiParcels_81623/FeatureServer/0/query",
      "https://experience.arcgis.com/experience/f5d22beb6e904b75823847ff4b545c02/",
    )],
  },

  // ── SOUTH DAKOTA ──────────────────────────────────────────────────────────
  // ⚠ SD'nin eyalet geneli parsel servisi YOK (arcgis.sd.gov tarandı — cadastral
  // katman yayınlanmıyor). Hedeflenen ucuz county'lerin (Harding, Ziebach,
  // Corson, Perkins, Bennett) hiçbirinin halka açık servisi yok.
  {
    key: "sd-pennington", state: "SD", county: "Pennington", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://gis.rcgov.org/server/rest/services/OpenData/TaxParcels/FeatureServer/0/query",
      outFields: "PIN,TaxID,GranteeLastName,Grantee1stName,Grantee2ndName,GranteeStreetAddr,GranteeStreetAddr2,GranteeCity,GranteeState,GranteeZip,PropAddress,Acres,ValueLand,ValueTotal,LandUse",
      orderBy: "ValueLand ASC",
      baseWhere: "ValueNAStructure=0 AND ValueAgStructure=0 AND GranteeStreetAddr IS NOT NULL AND GranteeStreetAddr<>''",
      fields: {
        apn: ["PIN", "TaxID"],
        owner: ["GranteeLastName", "Grantee1stName", "Grantee2ndName"],
        mailAddress: ["GranteeStreetAddr", "GranteeStreetAddr2"],
        mailCity: "GranteeCity", mailState: "GranteeState", mailZip: "GranteeZip",
        situs: ["PropAddress"],
        use: ["LandUse"], useConst: "VACANT",
        acres: "Acres",
        value: "ValueLand",
      },
      searchFields: { owner: "GranteeLastName", apn: "PIN", mailState: "GranteeState", value: "ValueLand" },
    }],
  },

  // ── NEBRASKA ──────────────────────────────────────────────────────────────
  // ⚠ NE eyalet geneli katmanı (1,15M parsel) var ama SAHİP ADI ve POSTA ADRESİ
  // İÇERMİYOR → mektup atılamaz, yalnızca hedefleme için kullanılabilir.
  {
    key: "ne-cass", state: "NE", county: "Cass", hasValue: true, bilinenDurum: "calisiyor",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services3.arcgis.com/oIhWXTph9P1clNT3/arcgis/rest/services/Tax_Parcel/FeatureServer/0/query",
      outFields: "PID,OwnerName1,OwnerName2,OwnerAddress1,OwnerAddress2,OwnerCity,OwnerState,OwnerZip,FullSitusAddress,LegalAcres,GISAcres,LandValue,ImprovementValue,BuildingValue,ClassCode",
      orderBy: "LandValue ASC",
      baseWhere: "ImprovementValue=0 AND BuildingValue=0 AND LandValue>0",
      fields: {
        apn: ["PID"],
        owner: ["OwnerName1", "OwnerName2"],
        mailAddress: ["OwnerAddress1", "OwnerAddress2"],
        mailCity: "OwnerCity", mailState: "OwnerState", mailZip: "OwnerZip",
        situs: ["FullSitusAddress"],
        use: ["ClassCode"], useConst: "VACANT",
        acres: "LegalAcres",
        value: "LandValue",
      },
      searchFields: { owner: "OwnerName1", apn: "PID", mailState: "OwnerState", value: "LandValue" },
    }],
  },

  // ── KANSAS ────────────────────────────────────────────────────────────────
  // ⚠ KS eyalet geneli ORKA servisi CAMA (sahip/değer) verisini REST'te
  // YAYINLAMIYOR — yalnızca KSPID + geometri. Douglas tek doğrulanmış kaynak.
  {
    key: "ks-douglas", state: "KS", county: "Douglas", hasValue: false, bilinenDurum: "calisiyor",
    not: "Değer ve arazi-kullanımı alanı YOK — boş arsa ayıklanamıyor, tüm sahipli parseller döner.",
    sources: [{
      kind: "arcgis",
      endpoint: "https://services.arcgis.com/8O9UlSTnqjKptoda/arcgis/rest/services/Parcel/FeatureServer/0/query",
      outFields: "JOINPIN,PARCELNUMBER,Quickrefid,owner1,owner2,owner3,address,city,state,zip,situs,SYSCALACRES",
      orderBy: "SYSCALACRES ASC",
      baseWhere: "owner1 IS NOT NULL AND owner1<>'' AND address IS NOT NULL AND address<>''",
      fields: {
        apn: ["JOINPIN", "PARCELNUMBER", "Quickrefid"],
        owner: ["owner1", "owner2", "owner3"],
        mailAddress: ["address"],
        mailCity: "city", mailState: "state", mailZip: "zip",
        situs: ["situs"],
        useConst: "BELİRSİZ",
        acres: "SYSCALACRES",
      },
      searchFields: { owner: "owner1", apn: "JOINPIN", mailState: "state" },
    }],
  },

  // ── TENNESSEE ─────────────────────────────────────────────────────────────
  { key: "tn-sullivan", state: "TN", county: "Sullivan", hasValue: false, bilinenDurum: "servis-kapali", not: "TN eyalet parsel katmanında sahip adı/posta adresi YOK (sadece GISLINK + geometri).", sources: [regrid("TN", "Sullivan")] },

  // ── OKLAHOMA ──────────────────────────────────────────────────────────────
  { key: "ok-pittsburg", state: "OK", county: "Pittsburg", hasValue: false, bilinenDurum: "servis-kapali", not: "Mevcut OK katmanlarında sahip/posta alanı yok (yalnızca parcel_id + geometri).", sources: [regrid("OK", "Pittsburg")] },
  { key: "ok-atoka", state: "OK", county: "Atoka", hasValue: false, bilinenDurum: "servis-kapali", not: "Sahip/posta alanı yok.", sources: [regrid("OK", "Atoka")] },
  { key: "ok-beckham", state: "OK", county: "Beckham", hasValue: false, bilinenDurum: "servis-kapali", not: "Sahip/posta alanı yok.", sources: [regrid("OK", "Beckham")] },
];

export const COUNTY_REGISTRY: Record<string, CountyEntry> = Object.fromEntries(
  GIRDILER.map(kayit),
);

// ── Client için hafif liste (sır içermez) ───────────────────────────────────
export interface CountyOption {
  key: string; label: string; state: string; county: string;
  hasValue: boolean; durum: CountyEntry["bilinenDurum"]; not?: string;
  /** Sağlayıcı zinciri özeti (ör. "arcgis → regrid"). */
  kaynaklar: string;
}

export const COUNTY_OPTIONS: CountyOption[] = Object.entries(COUNTY_REGISTRY).map(([key, e]) => ({
  key, label: e.label, state: e.state, county: e.county,
  hasValue: e.hasValue, durum: e.bilinenDurum, not: e.not,
  kaynaklar: e.sources.map((s) => s.kind).join(" → ") || "yok",
}));

/** Kayıtta temsil edilen eyalet kodları (tekil, sıralı). */
export const REGISTRY_STATES: string[] = [...new Set(COUNTY_OPTIONS.map((o) => o.state))].sort();
