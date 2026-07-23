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
  "A+": "En iyi %1 — geo-doğrulanmış vitrin",
  A: "Sonraki %4 — güçlü aday",
  B: "İyi — takipte",
  C: "Orta — koşullu",
  D: "Zayıf",
  F: "Elenen (kamu sahipli / landlocked / dip skor)",
};

export function gradeColor(grade: string | null | undefined): string {
  return GRADE_COLORS[grade ?? ""] ?? "#64748b";
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
