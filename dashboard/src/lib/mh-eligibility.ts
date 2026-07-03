// ─────────────────────────────────────────────────────────────────────────────
// MH (MANUFACTURED HOME) UYGUNLUK — ROAD Act satış açısı.
//
// NEDEN: ROAD to Housing Act manufactured housing'in önünü açıyor (finansman +
// HUD-code esnekliği) → "MH koyulabilir ucuz lot" ABD'de ayrı bir alıcı segmenti.
// Bu modül her parsele DÜRÜST bir MH-uygunluk sinyali üretir; filtre + rozet
// olarak kullanılır (mektup/satış dilinde "MH-friendly lot" kozu).
//
// KIRMIZI ÇİZGİ (region-playbook ile aynı):
//   • Bu bir ZONING KARARI DEĞİL — assessor kullanım kodu + bölge playbook'undan
//     türetilmiş sinyal. "likely" bile "county'den teyit" şerhi taşır.
//   • Blanket "MH yasaldır" vaadi ASLA verilmez; belirsizse "verify".
//
// Sinyal kaynakları (öncelik sırası):
//   1. Assessor kullanım kodu (Mohave use / Dallas DCAD use) — en güçlü sinyal.
//      Ör. "0083-VL-MH-RURAL-SUBDIVI" → MH lotu; "COMMERCIAL - VACANT" → değil.
//   2. Region playbook allowedUses ("mobile-home" var mı) + eşleşme seviyesi
//      (city/county eşleşmesi güvenilir, state/default genelleme → verify).
//   3. Acre — çok küçük lotta min-lot/septik riski → likely'yi verify'a düşürür.
//
// Saf + deterministik + null-safe. Değerleme/fiyat mantığına dokunmaz.
// ─────────────────────────────────────────────────────────────────────────────

import { regionPlaybook, type PlaybookQuery } from "./region-playbook";

export type MhStatus = "likely" | "verify" | "unlikely";

export interface MhResult {
  /** null = sinyal yok (kullanım kodu da bölge bilgisi de yetersiz). */
  status: MhStatus | null;
  /** İnsan-okur Türkçe gerekçe — UI rozet tooltip'i / popup satırı. */
  reason: string;
}

/** Ortak dürüstlük kuyruğu — her "likely" gerekçesinde bulunur. */
export const MH_CONFIRM_TAIL =
  "kesin izin alıcı tarafından county zoning'den teyit edilmeli.";

// Kullanım kodu MH lotunu doğrudan söylüyor (assessor sınıfı).
const MH_CODE = /\bMH\b|MOBILE\s*HOME|MANUFACTURED/i;

// Yapı kurulamayacak / konut-dışı sınıflar → MH koyulamaz.
// (Mohave: PUD ortak alanları, kuyu/kule, maden, devlet arazisi, golf, depo;
//  Dallas DCAD: commercial/industrial vacant.)
const NON_RESIDENTIAL =
  /COMMERCIAL|INDUSTR|WRHS|WAREHOUS|MINE\b|WELL|TWR|TOWER|STATE VACANT|FEDERAL VACANT|OPEN SPACE|PRIV ROAD|PUD CA|ASSOC|HOLE\b|GOLF|CEMETER/i;

// Kırsal boş arsa sınıfları (Mohave VL-*-RURAL-*, ranch, generic rural vacant).
const RURAL_VACANT = /RURAL|RANCH|\bAG\b|AGRICULT/i;

// Şehir-içi subdivision boş arsa (Mohave VL-*-URB*, Dallas SFR vacant) —
// belediye bölgelemesi MH'yi sık yasaklar → asla "likely" değil.
const URBAN_VACANT = /URB|SFR|CITY/i;

// Boş arsa olduğunu söyleyen genel işaretler.
const VACANT = /\bVL\b|VL-|VACANT/i;

export interface MhQuery extends PlaybookQuery {
  /** Assessor kullanım kodu/açıklaması (ör. "0003-VL-UNDET-RURAL-SUBD"). */
  useCode?: string | null;
  acres?: number | null;
}

/**
 * Parsel → MH-uygunluk sinyali.
 *   likely   = kullanım kodu + bölge MH lehine (yine de teyit şerhli)
 *   verify   = sinyal karışık/genelleme — county teyidi ŞART
 *   unlikely = konut-dışı sınıf (ortak alan/ticari/devlet…) — MH koyulamaz
 *   null     = hiç sinyal yok (kod yok + bölge tanınmıyor)
 */
export function mhEligibility(q: MhQuery): MhResult {
  const code = (q.useCode ?? "").trim();
  const acres = typeof q.acres === "number" && Number.isFinite(q.acres) ? q.acres : null;

  // 1) Kod doğrudan MH diyor → en güçlü sinyal (acre'den bağımsız likely).
  if (code && MH_CODE.test(code)) {
    return {
      status: "likely",
      reason: `Assessor kullanım kodu MH/mobil-ev lotu (${code}) — ${MH_CONFIRM_TAIL}`,
    };
  }

  // 2) Konut-dışı sınıf → MH koyulamaz.
  if (code && NON_RESIDENTIAL.test(code)) {
    return {
      status: "unlikely",
      reason: `Konut-dışı kullanım sınıfı (${code}) — MH yerleşimi için uygun değil.`,
    };
  }

  // 3) Bölge playbook'u: bu bölgede mobil ev satılabilir kullanım mı?
  const pb = regionPlaybook(q);
  const regionMh = pb.allowedUses.includes("mobile-home");
  const strongMatch = pb.matchBasis === "city" || pb.matchBasis === "county";

  const smallLot = acres != null && acres < 0.5; // min-lot/septik riski

  if (regionMh && strongMatch) {
    // Bölge MH-dostu (ör. Mohave AR zonu, FL platted MH lotları).
    if (code && URBAN_VACANT.test(code) && !RURAL_VACANT.test(code)) {
      return {
        status: "verify",
        reason: `Şehir-içi subdivision sınıfı (${code}) — belediye bölgelemesi MH'yi kısıtlayabilir; county teyidi şart.`,
      };
    }
    if (smallLot) {
      return {
        status: "verify",
        reason: `Bölge MH-dostu (${pb.region}) ama lot küçük (${acres} acre) — min lot/septik kuralı için county teyidi şart.`,
      };
    }
    if (!code || VACANT.test(code) || RURAL_VACANT.test(code)) {
      return {
        status: "likely",
        reason: `Bölge MH-dostu (${pb.region}${code ? ` · ${code}` : ""}) — ROAD Act sonrası MH-lot satış kozu; ${MH_CONFIRM_TAIL}`,
      };
    }
    // Tanınmayan kod ama MH-dostu bölge → temkinli.
    return {
      status: "verify",
      reason: `Bölge MH-dostu (${pb.region}) ama kullanım sınıfı belirsiz (${code}) — county teyidi şart.`,
    };
  }

  if (regionMh && !strongMatch) {
    // Eyalet-geneli genelleme (ör. FL fallback) → asla "likely" deme.
    return {
      status: "verify",
      reason: `${pb.region} genelinde MH satılabilir kullanım ama parsel bazında değişir — county teyidi şart.`,
    };
  }

  // 4) Bölge MH-dostu DEĞİL (playbook'ta mobile-home yok) ya da bölge bilinmiyor.
  if (pb.matchBasis !== "default") {
    return {
      status: "verify",
      reason: `${pb.region} playbook'unda MH satılabilir kullanım olarak geçmiyor — MH açısıyla satmadan önce county zoning teyidi şart.`,
    };
  }

  // 5) Hiç sinyal yok.
  if (!code) return { status: null, reason: "MH sinyali yok — kullanım kodu ve bölge bilgisi yetersiz." };
  return {
    status: "verify",
    reason: `Kullanım sınıfı (${code}) MH açısından sınıflandırılamadı — county teyidi şart.`,
  };
}

// ── Mektup / deal-sheet satış kozu satırı ────────────────────────────────────
// SADECE status === "likely" iken üretilir; "verify"/"unlikely"/null için ASLA
// satır dönmez (dürüstlük kırmızı çizgisi: teyitsiz parselde MH kozu YOK).
// İngilizce (Lob mektubu ABD'li sahibe/alıcıya gider) ve blanket yasallık vaadi
// içermez — "buyer to verify with the county" şerhi cümlenin PARÇASI, ayrı
// dipnot değil, ki şablon satırı kırpsa bile şerh kozdan kopamasın.
export const MH_MAIL_LINE =
  "MH-friendly signal: county land-use records suggest this lot may accommodate a manufactured home — an increasingly popular option after the ROAD Act. Not a zoning determination; buyer to verify current zoning and permits with the county.";

/**
 * MH satış kozu → mektup/deal-sheet satırı.
 *   "likely" → sabit dürüst satır; diğer HER durum → null (satır eklenmez).
 */
export function mhMailLine(status: MhStatus | null | undefined): string | null {
  return status === "likely" ? MH_MAIL_LINE : null;
}

/** UI rozet etiketi. */
export const MH_LABELS: Record<MhStatus, string> = {
  likely: "🏠 MH-uygun",
  verify: "MH teyit",
  unlikely: "MH değil",
};
