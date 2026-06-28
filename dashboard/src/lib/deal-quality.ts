// Pure valuation-quality helpers — comp mismatch guard + at-a-glance deal grade.
// Extracted + unit-tested so the "Fırsat" logic and the absurd-offer guard
// (e.g. rural $/acre comp applied to an urban lot) can't silently drift.

/** True when comp market value and county-assessed value diverge >4× either way
 *  → comp almost certainly doesn't fit this parcel type; don't trust it. */
export function valuationMismatch(marketValue: number | null, assessed: number): boolean {
  return (
    marketValue != null && marketValue > 0 && assessed > 0 &&
    (assessed > 4 * marketValue || marketValue > 4 * assessed)
  );
}

export type DealGrade = "A" | "B" | "C" | null;

/** At-a-glance opportunity grade — ONLY when a real comp value exists and is not
 *  a mismatch. Returns null otherwise (no fabricated grade without data). */
export function dealGrade(opts: {
  marketValue: number | null;
  mismatch: boolean;
  absentee: boolean;
  acres: number;
  mailSafe: boolean;
  assessed: number;
}): DealGrade {
  const { marketValue, mismatch, absentee, acres, mailSafe, assessed } = opts;
  if (marketValue == null || mismatch) return null;
  let sc = 0;
  if (absentee) sc += 2;
  if (acres >= 0.2 && acres <= 5) sc += 2;
  if (mailSafe) sc += 1;
  if (assessed > 0 && marketValue > assessed) sc += 1;
  return sc >= 5 ? "A" : sc >= 3 ? "B" : "C";
}
