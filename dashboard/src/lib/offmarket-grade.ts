// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET HARF NOTU — UI görüntü yardımcıları (tek kaynak).
// Puanlama motoru: scraper/lib/grade-core.mjs (percentile eşikli A+..F).
// Buradaki kod yalnız GÖSTERİM: renk, etiket, bayrak ayrıştırma. Sayı üretmez.
// ─────────────────────────────────────────────────────────────────────────────

export const GRADES = ["A+", "A", "B", "C", "D", "F"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_COLORS: Record<string, string> = {
  "A+": "#059669", // zümrüt — en iyi %1
  A: "#16a34a",
  B: "#0891b2",
  C: "#d97706",
  D: "#9a3412",
  F: "#dc2626",
};

export const GRADE_LABELS: Record<string, string> = {
  "A+": "County'sinde en iyi %1 — geo-doğrulanmış vitrin",
  A: "Sonraki %4 — güçlü aday",
  B: "İyi — takipte",
  C: "Orta — koşullu",
  D: "Zayıf",
  F: "Elenen (landlocked / dip skor)",
  "N/A": "Derecelendirilemedi (kamu sahipli / sahip-acre verisi geçersiz)",
};

// grade=null → N/A: not verilemedi (garbage-in koruması). F ile karıştırma —
// F "kötü arsa", N/A "değerlendirilemeyen kayıt". grade_reason sebebi taşır.
export const GRADE_REASON_LABELS: Record<string, string> = {
  gov_owner: "kamu/kurum sahipli — satın alınamaz",
  owner_missing: "sahip adı boş/template",
  acres_invalid: "acreage 0 veya >640ac (veri hatası şüphesi)",
};

export function gradeColor(grade: string | null | undefined): string {
  return GRADE_COLORS[grade ?? ""] ?? "#64748b";
}

/** grade_breakdown jsonb → UI kırılım satırları (yalnız gösterim). */
export const BREAKDOWN_LABELS: [key: string, label: string][] = [
  ["appeal", "Cazibe (acre+geo)"],
  ["liquidity", "Pazar likiditesi"],
  ["margin", "Marj/spread"],
  ["motivation", "Satıcı motivasyonu"],
  ["risk", "Kapanış riski"],
];
export function breakdownRows(v: unknown): { label: string; pts: number }[] {
  if (v == null || typeof v !== "object") return [];
  const o = v as Record<string, unknown>;
  return BREAKDOWN_LABELS.filter(([k]) => typeof o[k] === "number").map(([k, label]) => ({
    label,
    pts: o[k] as number,
  }));
}
export function breakdownTitle(v: unknown, score?: number | null): string | undefined {
  const rows = breakdownRows(v);
  if (!rows.length) return score != null ? `not motoru skoru ${score}` : undefined;
  const parts = rows.map((r) => `${r.label}: ${r.pts > 0 ? "+" : ""}${r.pts}`);
  return `${score != null ? `Skor ${score} · ` : ""}${parts.join(" · ")}`;
}

/** grade_flags jsonb → güvenli string dizisi. */
export function parseFlags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Cazibe rozetleri (geo/fiziksel — emoji ile başlar) ↔ diğer gerekçeler. */
export function splitFlags(flags: string[]): { appeal: string[]; other: string[] } {
  const appeal: string[] = [];
  const other: string[] = [];
  for (const f of flags) (/^[⛔🛣⚡🌊🏘]/u.test(f) ? appeal : other).push(f);
  return { appeal, other };
}
