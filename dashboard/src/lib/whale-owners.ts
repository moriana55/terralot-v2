// ─────────────────────────────────────────────────────────────────────────────
// KURUMSAL / GİZLİ-AĞ SAHİP TESPİTİ — Mohave mektup kampanyasından ve
// "En İyi 750" seçiminden ELENMESİ gereken sahipler.
//
// Neden: 20K off-market lead havuzuna balina/kurumsal parseller karışmış (ör.
// APN 329-07-086, owner "REDPOINT HOLDINGS LLC", mailing "3141 BEACH VIEW CT,
// LAS VEGAS NV" — keşif ajanının bulduğu Aileron Investments ağı adresi). Bunlara
// mektup atmak boşa para VE "En İyi 750" sıralamasını (yüksek marj/boyut skoru
// alıp gerçek bireysel adayların yerini kapıyorlar) bozuyor.
//
// Kaynak (SADECE OKUNDU — bu dosyalar başka bir ajanın paket-tapu çalışma alanı,
// değiştirilmedi): scraper/buyuk-oyuncular-uret.mjs (🐋 OYUNCULAR tanımları) +
// scraper/rakip-tapu-dogrula.mjs (Discount Lots/WP RE ailesi — 450 Anthony Trl).
// Liste senkron tutulmalı; kaynak dosyalar değişirse burası da güncellenmeli.
// ─────────────────────────────────────────────────────────────────────────────

// Genel kurumsal/kamu anahtar kelimeleri (isim bazlı). Not: gerçek kamu-sahip
// elemesi zaten mohave-campaign.ts#isGovOwner'da var — burası ONA EK, ticari/
// kurumsal isimler için (LLC/TRUST/vb.).
const CORP_KEYWORD_RE =
  /\b(LLC|L\.L\.C|INC|INCORPORATED|TRUST|CORP|CORPORATION|COMPANY|LP|LTD|PROPERTIES|HOLDINGS|INVESTMENT|RANCH|BANK|COUNTY|STATE OF|CITY OF|USA|UNITED STATES|DEPARTMENT)\b/;

// Bilinen "balina"/gizli-ağ shell-LLC posta kutuları — owner adı alakasız
// görünse de aynı kutuyu paylaşıyorsa kurumsal/gizli-ağ sayılır.
export const WHALE_ADDRESS_SNIPPETS = ["806 BUCHANAN", "3141 BEACH VIEW", "450 ANTHONY TRL"];

// Bilinen balina/gizli-ağ owner ön-ekleri (keşif ajanı raporu, buyuk-oyuncular-uret.mjs
// OYUNCULAR listesindeki ownerOnekleri ile birebir aynı).
export const WHALE_OWNER_PREFIXES = [
  "SIMPLE FOODS", "TEN SLEEP TECH", "M8TRIX", "WYOMING INVESTMENT", "WYOMING INVESTMENTS",
  "BEAUTIFUL PLAINS", "BEAUFIFUL PLAINS", "PREMIUM CAPITAL PARTNERS", "UNIX FINANCIAL",
  "FOURTH HOUSE", "WYOMING CORE", "GRAND FINALE", "ROSS QUINTERO",
  "1D LLC", "I E PROPERTIES", "COPPERWOOD 5", "AN TIARNA LEIBH", "WESTERN LAND & RANCHES", "CTR TRUST",
];

const clean = (s: unknown): string => String(s ?? "").trim().toUpperCase();

/** Owner adı VEYA posta adresi kurumsal/balina/gizli-ağ örüntüsüne uyuyor mu. */
export function isCorporateOrWhaleOwner(owner: unknown, mailingAddress?: unknown): boolean {
  const o = clean(owner);
  if (!o) return false;
  if (CORP_KEYWORD_RE.test(o)) return true;
  if (WHALE_OWNER_PREFIXES.some((p) => o.startsWith(p))) return true;
  const a = clean(mailingAddress);
  if (a && WHALE_ADDRESS_SNIPPETS.some((s) => a.includes(s))) return true;
  return false;
}
