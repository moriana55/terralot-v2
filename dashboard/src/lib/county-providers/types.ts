// ─────────────────────────────────────────────────────────────────────────────
// COUNTY SAĞLAYICI KATMANI — ORTAK TİPLER
//
// Amaç: bir county eklemek YENİ KOD yazmayı değil, KAYIT (config) girmeyi
// gerektirsin. Her county için "hangi sağlayıcı, hangi alan hangi anlama gelir"
// bilgisi veriyle ifade edilir; sorgu/normalize mantığı tek yerde durur.
//
// Sağlayıcı sırası (county kaydında tanımlı):
//   1) ArcGIS (ücretsiz, county'nin kendi servisi)  → alan haritasıyla
//   2) Regrid (ücretli, ülke geneli yedek)          → kota + önbellek korumalı
//   3) yok                                          → dürüstçe "kaynak tanımlı değil"
//
// SAHTE VERİ YASAK: hiçbir sağlayıcı örnek/tahmini satır üretmez. Veri yoksa
// `bos`, servis çöktüyse `servis-hatasi` döner — ikisi ASLA karıştırılmaz.
// ─────────────────────────────────────────────────────────────────────────────

import type { LiveCountyResult, LiveSearch } from "@/lib/live-county-types";

export type { LiveCountyResult, LiveSearch };

/** Bir sağlayıcı denemesinin sonucu — "veri yok" ile "servis çöktü" ayrı durumlar. */
export type ProviderStatus =
  /** Sorgu başarılı, en az 1 satır döndü. */
  | "ok"
  /** Sorgu başarılı, filtreye uyan kayıt YOK. Bu bir hata değildir. */
  | "bos"
  /** Servis yanıt vermedi / HTTP hata / zaman aşımı / bozuk JSON. */
  | "servis-hatasi"
  /** API anahtarı yok, geçersiz veya süresi dolmuş. */
  | "kimlik-hatasi"
  /** Günlük ücretli çağrı tavanı doldu — çağrı YAPILMADI. */
  | "kota-doldu"
  /** Bu county için bu sağlayıcı yapılandırılmamış. */
  | "yapilandirilmamis";

export type ProviderName = "arcgis" | "regrid";

export interface ProviderOutcome {
  provider: ProviderName;
  status: ProviderStatus;
  rows: LiveCountyResult[];
  /** Sağlayıcıdan dönen HAM kayıt sayısı (normalize öncesi). */
  rawCount: number;
  /** Sonuç tavanına dayandı mı (daha fazla kayıt olabilir). */
  capped: boolean;
  /** Hata veya bilgilendirme mesajı (Türkçe, kullanıcıya gösterilebilir). */
  message?: string;
  /** ArcGIS için üretilen WHERE — hata ayıklama şeffaflığı. */
  where?: string;
  durationMs: number;
  /** Önbellekten mi geldi (ücretli sağlayıcılar için önemli). */
  cached: boolean;
  /** Bu denemede harcanan ÜCRETLİ API çağrısı sayısı (ArcGIS = 0). */
  apiCalls: number;
}

/** Zincirin tamamının sonucu. */
export interface CountyQueryResult {
  countyKey: string;
  label: string;
  state: string;
  county: string;
  /** Sonucu üreten sağlayıcı (hiçbiri başaramadıysa null). */
  provider: ProviderName | null;
  status: ProviderStatus;
  rows: LiveCountyResult[];
  rawCount: number;
  capped: boolean;
  message?: string;
  where?: string;
  fetchedAt: string;
  /** Denenen her sağlayıcının sonucu — şeffaflık için hepsi döner. */
  attempts: ProviderOutcome[];
  /** Bu sorguda harcanan toplam ücretli API çağrısı. */
  apiCalls: number;
}

// ── ArcGIS alan haritası (veriyle ifade edilen normalize) ───────────────────
export interface ArcGisFieldMap {
  /** APN adayları — ilk DOLU olan kullanılır. */
  apn: string[];
  /** Sahip adı adayları — dolu olanlar " & " ile birleştirilir. */
  owner: string[];
  /** Posta sokak adresi adayları — dolu olanlar boşlukla birleştirilir. */
  mailAddress?: string[];
  mailCity?: string;
  /**
   * `mailCity` alanı "CITY, ST" biçiminde birleşikse true.
   * (ör. NV Nye `mcity` = "PAHRUMP, NV") — şehir/eyalet ayrıştırılır.
   */
  mailCityHasState?: boolean;
  mailState?: string;
  mailZip?: string;
  /**
   * Posta adresinin tek alanda birleşik olduğu county'ler için
   * (ör. NM Valencia `OwnerAddre` = "STREET \nCITY, ST ZIP").
   * Tanımlıysa mailAddress/mailCity/... yerine bu parse edilir.
   */
  mailCombined?: string;
  /**
   * Bazı kaynaklarda ayrı şehir/eyalet alanları county'den county'ye BOŞ gelir
   * ve tam adres `mailAddress` içine paketlenmiştir
   * (ör. NC OneMap Northampton: mailadd = "304 W SUNSET ST     AHOSKIE, NC  27910").
   * Bu bayrak açıkken şehir boşsa adres alanı birleşik kabul edilip ayrıştırılır.
   */
  mailCombinedFallback?: boolean;
  /** Parselin fiziksel adresi adayları — boşluk/virgülle birleştirilir. */
  situs?: string[];
  situsJoin?: string;
  /** Kullanım tipi adayları — ilk dolu olan. */
  use?: string[];
  /** Hiçbiri yoksa yazılacak sabit kullanım etiketi. */
  useConst?: string;
  /** Dönüm alanı. */
  acres?: string;
  /** `field` = alanı doğrudan acre kabul et; `shapeAreaSqft` = ft² → acre. */
  acresFrom?: "field" | "shapeAreaSqft";
  /** Ondalık basamak (varsayılan 2). */
  acresPrecision?: number;
  /** 0 acre geçerli sayılsın mı (varsayılan hayır → null). */
  acresAllowZero?: boolean;
  /** Arazi değeri alanı. Yoksa land_value = null (hasValue=false). */
  value?: string;
}

export interface ArcGisSource {
  kind: "arcgis";
  /** `.../query` ile biten tam uç nokta. */
  endpoint: string;
  /**
   * Uzun WHERE ifadeleri URL sınırını aşan servisler POST ister
   * (ör. NC OneMap, NV Nye, SC Colleton, MO Camden, MI Roscommon).
   */
  method?: "GET" | "POST";
  /**
   * Ek HTTP başlıkları. Bazı servisler proxy arkasında olup doğru `Referer`
   * olmadan 403/boş döner (ör. Idaho ISTC `utility.arcgis.com` uçları).
   * ⚠ SADECE ASCII değer — başlıklar ByteString'dir.
   */
  headers?: Record<string, string>;
  /**
   * Bazı servisler `resultRecordCount` kabul etmez ve
   * `400 "Pagination is not supported"` döner (ör. MS MARIS).
   * Bu bayrak açıkken tavan sunucuya gönderilmez, sonuç istemcide kırpılır.
   */
  noPagination?: boolean;
  /** Sunucudan istenecek alanlar (virgülle). */
  outFields: string;
  /** Sıralama alanı (ör. "land_val ASC"). */
  orderBy: string;
  /** Boş-arsa / temel filtre. Değer üst sınırı KULLANICIYA bırakılır. */
  baseWhere: string;
  fields: ArcGisFieldMap;
  /** Sunucu-taraflı arama için alan adları (yoksa client filtre). */
  searchFields?: {
    owner?: string;
    apn?: string;
    /** Posta eyaleti alanı. Yoksa eyalet filtresi client tarafında yapılır. */
    mailState?: string;
    value?: string;
  };
}

export interface RegridSource {
  kind: "regrid";
  /** Regrid yol biçimi: `/us/tx/hudspeth` (küçük harf, boşluksuz). */
  path: string;
  /**
   * Regrid `usedesc`/`zoning` üzerinde boş-arsa eşleşmesi için anahtar kelimeler.
   * Boşsa tüm parseller döner (pahalı — tavsiye edilmez).
   */
  vacantKeywords?: string[];
}

export type CountySource = ArcGisSource | RegridSource;

/** Kayıt defterindeki bir county — TAMAMEN VERİ, kod içermez. */
export interface CountyEntry {
  label: string;
  /** Parselin bulunduğu eyalet (absentee karşılaştırması + lead_id öneki). */
  state: string;
  county: string;
  region: string;
  /** offmarket_leads.lead_id öneki — scraper ile AYNI olmalı (dedupe). */
  leadIdPrefix: string;
  /**
   * Sağlayıcı zinciri, SIRAYLA denenir. İlk `ok` dönen kazanır.
   * Sert hata (servis-hatasi/yapilandirilmamis) durumunda sonrakine geçilir;
   * "bos" (veri yok) dürüst bir cevaptır, zincir orada durur.
   */
  sources: CountySource[];
  /** Değer alanı var mı — UI'da min/max fiyat filtresini açar. */
  hasValue: boolean;
  /**
   * Kapsam tablosundaki insan-eliyle-doğrulanmış durum.
   * Otomatik ölçüm bunu ezmez; bu "en son ne biliyoruz" kaydıdır.
   */
  bilinenDurum: "calisiyor" | "deneniyor" | "veri-yok" | "servis-kapali";
  /** Durum hakkında kısa not (ör. "değer alanı yok", "host çöktü"). */
  not?: string;
}
