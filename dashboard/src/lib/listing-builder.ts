// ─────────────────────────────────────────────────────────────────────────────
// İLAN ÜRETECİ — COMPOSER (LANDiO tarzı). SAF + DETERMINISTIK + null-safe.
//
// Tek bir BuyerParcel'den (buyer-safe whitelist projeksiyonu) YAYINA-HAZIR bir
// ilan objesi kurar:
//   { title, description, bullets, locationSummary, cashPrice,
//     financing[] (owner-finance preset senaryoları), region, salesAngle }.
//
// Mevcut parçaları ÇAĞIRIR, yeniden yazmaz:
//   • buildListingCopy   (lib/listing-copy)   → title/description/bullets
//   • buildFinancingOptions (lib/owner-finance) → taksit senaryo tablosu (kanonik
//       amortisman; yeni sayı UYDURULMAZ)
//   • regionPlaybook     (lib/region-playbook) → bölge satış açısı + dürüst şerh
//
// ── SPREAD SIZINTISI İNVARYANTI ──────────────────────────────────────────────
// GİRDİ SADECE BuyerParcel'dir. BuyerParcel zaten toBuyerParcel() beyaz-liste
// süzgecinden geçmiştir: owner/marj/teklif/comp/assessed/grade gibi İÇ alanlar
// bu tipte YOKTUR. Dolayısıyla composer bu alanları YAPISAL OLARAK göremez →
// üretilen ilana marj/alış-maliyeti/kâr sızması İMKÂNSIZ. (listing-builder.test
// bunu kanıtlar.)
// ─────────────────────────────────────────────────────────────────────────────

import type { BuyerParcel } from "@/lib/buyer-parcel";
import { buildListingCopy, type ListingFinance } from "@/lib/listing-copy";
import { regionPlaybook } from "@/lib/region-playbook";
import {
  buildFinancePlan,
  buildFinancingOptions,
  COMPASS_DEFAULT,
  type FinancePlan,
} from "@/lib/owner-finance";

export interface BuyerListing {
  /** satışa-hazır başlık. */
  title: string;
  /** ~100-130 kelime ikna edici açıklama (dürüst zoning şerhi dahil). */
  description: string;
  /** öne çıkanlar listesi. */
  bullets: string[];
  /** konum / komşuluk / GIS özeti (dürüst, uydurmasız). */
  locationSummary: string;
  /** nakit satış fiyatı ($) — 0/None ise "fiyat sorulur". BUYER-FACING (sızıntı değil). */
  cashPrice: number | null;
  /** owner-finance taksit senaryoları (preset amortisman tablosu). Fiyat yoksa boş. */
  financing: FinancePlan[];
  /** insan-okur bölge etiketi. */
  region: string;
  /** bölge satış açısı (ton için). */
  salesAngle: string;
  /** yayın öncesi dürüstlük şerhi. */
  disclaimer: string;
}

const DISCLAIMER =
  "Taslak — yayınlamadan gözden geçir. Zoning/izin/POA kuralları alıcı tarafından county'den doğrulatılır; hukuki garanti verilmez.";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function acresPhrase(acres: number | null | undefined): string | null {
  if (acres == null || !Number.isFinite(acres) || acres <= 0) return null;
  const a = Number.isInteger(acres) ? String(acres) : acres.toFixed(2);
  return `${a} acre${acres === 1 ? "" : "s"}`;
}

/**
 * Konum / komşuluk / GIS özeti — SADECE buyer-safe sinyallerden, uydurmasız.
 * acres/county/region/state/koordinat ne verildiyse dürüstçe cümleye dökülür.
 */
export function buildLocationSummary(p: BuyerParcel): string {
  const st = (p.state || "").trim();
  const county = (p.county || "").trim();
  const region = (p.region || "").trim();
  const sentences: string[] = [];

  const locLabel =
    county && st ? `${county} County, ${st}` : county ? `${county} County` : st || "the United States";
  const ac = acresPhrase(p.acres);
  sentences.push(ac ? `This parcel is ${ac} in ${locLabel}.` : `This parcel is located in ${locLabel}.`);

  if (region && region !== county && region !== st) {
    sentences.push(`It sits in the ${region} area.`);
  }
  if (p.address && p.address.trim()) {
    sentences.push(`Nearest situs reference: ${p.address.trim()}.`);
  }
  if (p.lat != null && p.lng != null) {
    sentences.push(
      `GPS center is approximately ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} — drop the coordinates into any map app to scout the neighborhood, roads, and terrain.`,
    );
  } else {
    sentences.push("Exact coordinates and a parcel map are available on request.");
  }
  sentences.push("Boundaries shown are approximate; the final legal description comes from the county record.");

  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * BuyerParcel → yayına-hazır BuyerListing. Saf + deterministik. AI'sız çalışır.
 *
 * @param parcel  buyer-safe projeksiyon (toBuyerParcel çıktısı). Tek girdi budur;
 *                iç deal-ekonomisi buraya YAPISAL olarak giremez → sızıntı yok.
 */
export function buildBuyerListing(parcel: BuyerParcel): BuyerListing {
  const pb = regionPlaybook({
    state: parcel.state || null,
    county: parcel.county || null,
    region: parcel.region || parcel.county || null,
    address: parcel.address || null,
  });

  const price =
    parcel.price != null && Number.isFinite(parcel.price) && parcel.price > 0
      ? Math.round(parcel.price)
      : null;

  // Owner-finance senaryoları — kanonik preset amortisman (yeni sayı uydurma yok).
  // cashPrice = satış fiyatı (buyer-facing); iç maliyet DEĞİL.
  const financing = price != null ? buildFinancingOptions(price, { cashPrice: price }) : [];

  // Başlık/açıklama için "manşet" finans satırı — Compass varsayılanı (route ile aynı).
  let headlineFinance: ListingFinance | null = null;
  if (price != null) {
    const plan = buildFinancePlan({
      salePrice: price,
      annualRatePct: COMPASS_DEFAULT.ratePct,
      termMonths: COMPASS_DEFAULT.months,
      downPaymentPct: COMPASS_DEFAULT.downPaymentPct,
      cashPrice: price,
    });
    if (plan) {
      headlineFinance = {
        down: plan.downPayment,
        monthly: plan.monthlyPayment,
        termMonths: plan.termMonths,
        cashPrice: price,
      };
    }
  }

  // DÜRÜSTLÜK: marketValue GEÇMEZ — BuyerParcel assessed değer taşımaz ve
  // taşımamalı. Sadece buyer-safe sinyaller listing-copy'ye gider.
  const copy = buildListingCopy(
    {
      acres: parcel.acres || null,
      county: parcel.county || null,
      state: parcel.state || null,
      situs: parcel.address || null,
      marketValue: null,
      // region → "en yakın kasaba" sinyali (county'den farklıysa).
      nearestCity:
        parcel.region && parcel.region !== parcel.county ? parcel.region : null,
      nearestRoad: null,
    },
    pb,
    headlineFinance,
  );

  return {
    title: copy.title,
    description: copy.description,
    bullets: copy.bullets,
    locationSummary: buildLocationSummary(parcel),
    cashPrice: price,
    financing,
    region: pb.region,
    salesAngle: pb.salesAngle,
    disclaimer: DISCLAIMER,
  };
}

/** Manşet finans etiketi ("from $199/mo with $500 down") — UI kısayolu. */
export function financeHeadline(financing: FinancePlan[]): string | null {
  if (financing.length === 0) return null;
  // En düşük aylık → en cazip "from $X/mo".
  const cheapest = financing.reduce((a, b) => (b.monthlyPayment < a.monthlyPayment ? b : a));
  return `from ${usd(cheapest.monthlyPayment)}/mo with ${usd(cheapest.downPayment)} down`;
}
