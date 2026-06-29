// ─────────────────────────────────────────────────────────────────────────────
// SATILIK İLAN METNİ ÜRETECİ — LANDiO / Discount Lots tarzı, region-aware,
// SAF + DETERMINISTIK + null-safe.
//
// Bir parselin gerçek sinyallerini (acres / county / state / situs / marketValue
// + opsiyonel owner-finance şartı) alır ve satışa-hazır İngilizce ilan metni
// üretir: { title, description (~100-130 kelime), bullets[] }.
//
// FELSEFE (pricing.ts / region-playbook.ts ile aynı):
//   • UYDURMA YOK — sadece verilen gerçek sinyaller metne dökülür. Acres yoksa
//     "X acres" cümlesi kurulmaz; finans yoksa "$X down / $Y/mo" satırı çıkmaz.
//   • DÜRÜST — her metin region-playbook'un zoning/izin şerhini taşır
//     (CONFIRM_TAIL): kullanım/izin alıcı tarafından county'den doğrulatılır.
//   • ASLA blanket hukuki vaat verme ("RV yasaldır" gibi). Bölgeye göre dürüst
//     kullanım açısı + uyarı.
//
// Bu modül AI'sız ÇALIŞIR (deterministik şablon). OPENAI_API_KEY varsa route
// bu çıktıyı AI ile cilalar; yoksa bu şablon doğrudan kullanılır.
// ─────────────────────────────────────────────────────────────────────────────

import type { AllowedUse, Playbook } from "@/lib/region-playbook";

export interface ListingSignals {
  acres?: number | null;
  /** county / bölge etiketi (ör. "Mohave"). */
  county?: string | null;
  state?: string | null;
  /** situs / property address (serbest metin). */
  situs?: string | null;
  /** parselin gerçek piyasa/land değeri ($). */
  marketValue?: number | null;
  /** en yakın şehir (varsa). */
  nearestCity?: string | null;
  /** en yakın yol/erişim (varsa). */
  nearestRoad?: string | null;
}

/** Owner-finance şartı — owner-finance.ts buildFinancePlan çıktısından beslenir. */
export interface ListingFinance {
  /** peşinat ($). */
  down?: number | null;
  /** aylık taksit ($). */
  monthly?: number | null;
  /** vade (ay). */
  termMonths?: number | null;
  /** nakit fiyat ($) — varsa "cash price" satırı. */
  cashPrice?: number | null;
}

export interface ListingCopy {
  title: string;
  description: string;
  bullets: string[];
}

// AllowedUse → İngilizce kullanım ifadesi (USE_LABELS Türkçe; ilan İngilizce).
const USE_PHRASE: Record<AllowedUse, string> = {
  "off-grid": "off-grid living",
  rv: "RV use",
  camping: "camping",
  homestead: "homesteading",
  "mobile-home": "mobile homes",
  modular: "modular homes",
  "site-built": "site-built homes",
  agricultural: "agricultural use",
  recreational: "recreational getaways",
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function acresStr(acres: number | null | undefined): string | null {
  if (acres == null || !Number.isFinite(acres) || acres <= 0) return null;
  // 0.50, 1.25, 10 Acres … tam sayıysa ondalık gösterme.
  const a = Number.isInteger(acres) ? String(acres) : acres.toFixed(2);
  return `${a} Acre${acres === 1 ? "" : "s"}`;
}

function locationLabel(s: ListingSignals): string {
  const st = (s.state || "").trim();
  if (s.nearestCity && s.nearestCity.trim()) {
    return st ? `${s.nearestCity.trim()}, ${st}` : s.nearestCity.trim();
  }
  if (s.county && s.county.trim()) {
    const c = /county/i.test(s.county) ? s.county.trim() : `${s.county.trim()} County`;
    return st ? `${c}, ${st}` : c;
  }
  return st || "the United States";
}

// İngilizce, dürüst zoning/izin şerhi — region-playbook sinyallerinden türetilir.
// Türkçe zoningNote'u ilan metnine dökmeyiz; ama AYNI dürüst kısıtı İngilizce verir.
function honestUseNote(pb: Playbook): string {
  const uses = pb.allowedUses;
  const has = (u: AllowedUse) => uses.includes(u);
  const TAIL = "Confirm zoning, permitted use, and any POA/deed restrictions with the county before buying — no legal guarantees are made.";
  if (uses.length === 0) {
    return `Zoning and permitted use are not yet verified for this parcel. ${TAIL}`;
  }
  // FL-tarzı platted lot: RV'de sürekli oturma çoğu county'de yasak.
  if ((has("mobile-home") || has("modular") || has("site-built")) && !has("rv") && !has("off-grid")) {
    return `This lot suits mobile, modular, or site-built homes; continuous RV living is restricted in most counties here. ${TAIL}`;
  }
  // AZ çöl-tarzı: off-grid genelde uygun ama RV süreli oturma parsele göre değişir.
  if (has("off-grid") || has("rv")) {
    return `This area is relatively permissive for off-grid use, but continuous RV occupancy limits vary by parcel zoning. ${TAIL}`;
  }
  return `Permitted use depends on parcel zoning. ${TAIL}`;
}

// İlk 2-3 kullanımdan İngilizce "great for A, B, and C" ifadesi.
function usesPhrase(uses: AllowedUse[]): string | null {
  const list = uses.slice(0, 3).map((u) => USE_PHRASE[u]);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]}, and ${list[2]}`;
}

function hasFinance(f: ListingFinance | null | undefined): f is ListingFinance {
  return !!f && (f.down != null || f.monthly != null);
}

/**
 * Parsel sinyalleri + region-playbook (+ opsiyonel owner-finance şartı) → satışa
 * hazır ilan metni. Saf + deterministik. AI'sız çalışır; route isterse cilalar.
 */
export function buildListingCopy(
  signals: ListingSignals,
  pb: Playbook,
  finance?: ListingFinance | null,
): ListingCopy {
  const loc = locationLabel(signals);
  const ac = acresStr(signals.acres);
  const acLead = ac ? `${ac} in ` : "";
  const fin = hasFinance(finance) ? finance : null;

  // ── TITLE ────────────────────────────────────────────────────────────────
  let title: string;
  if (fin && fin.down != null) {
    title = `${acLead}${loc} — Owner Financing, ${usd(fin.down)} Down`;
  } else if (fin && fin.monthly != null) {
    title = `${acLead}${loc} — Owner Financing, ${usd(fin.monthly)}/mo`;
  } else {
    title = `${acLead}${loc} — Land for Sale`;
  }

  // ── DESCRIPTION (~100-130 kelime hedef) ───────────────────────────────────
  const sentences: string[] = [];
  const acreWord = ac ? `this ${ac.toLowerCase()} parcel` : "this parcel";
  sentences.push(
    `Own a piece of ${loc} with ${acreWord} of raw land${signals.situs ? ` near ${String(signals.situs).split(",")[0].trim()}` : ""}.`,
  );

  const up = usesPhrase(pb.allowedUses);
  if (up) {
    sentences.push(`It's well suited for ${up} — a low-cost entry into land ownership${signals.state ? ` in ${signals.state}` : ""}.`);
  } else {
    sentences.push("It's a low-cost entry into land ownership with potential to match your plans.");
  }

  if (signals.nearestRoad && signals.nearestRoad.trim()) {
    sentences.push(`Access is off ${signals.nearestRoad.trim()}; verify road frontage on the parcel map.`);
  }
  if (signals.nearestCity && signals.nearestCity.trim() && !title.includes(signals.nearestCity.trim())) {
    sentences.push(`The nearest town is ${signals.nearestCity.trim()}.`);
  }

  if (fin) {
    const parts: string[] = [];
    if (fin.down != null) parts.push(`${usd(fin.down)} down`);
    if (fin.monthly != null) parts.push(`${usd(fin.monthly)}/month`);
    if (fin.termMonths != null) parts.push(`${fin.termMonths}-month term`);
    sentences.push(`Owner financing is available — ${parts.join(", ")}, with no credit check.`);
    if (fin.cashPrice != null) sentences.push(`Prefer to pay cash? It's ${usd(fin.cashPrice)}.`);
  }

  sentences.push(honestUseNote(pb));

  const description = sentences.join(" ").replace(/\s+/g, " ").trim();

  // ── BULLETS ───────────────────────────────────────────────────────────────
  const bullets: string[] = [];
  if (ac) bullets.push(`${ac} of raw land`);
  bullets.push(`Located in ${loc}`);
  if (signals.marketValue != null && Number.isFinite(signals.marketValue) && signals.marketValue > 0) {
    bullets.push(`Assessed/market value ~${usd(signals.marketValue)}`);
  }
  if (up) bullets.push(`Great for ${up}`);
  if (fin && fin.down != null && fin.monthly != null) {
    bullets.push(`Owner financing: ${usd(fin.down)} down, ${usd(fin.monthly)}/mo — no credit check`);
  } else if (fin && fin.monthly != null) {
    bullets.push(`Owner financing: ${usd(fin.monthly)}/mo — no credit check`);
  }
  if (signals.nearestRoad && signals.nearestRoad.trim()) bullets.push(`Access off ${signals.nearestRoad.trim()}`);
  // DÜRÜSTLÜK rozeti — her ilan zoning teyit şartını taşır.
  bullets.push("Buyer to confirm zoning, access & permitted use with the county");

  return { title, description, bullets };
}
