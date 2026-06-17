// ─────────────────────────────────────────────────────────────────────────────
// FLIP / OWNER-FINANCE SIMULATOR — pure, deterministic finance math.
//
// Models the canonical land-flip play:
//   1. Buy a parcel cheap (tax-sale / struck-off) for `buyPrice`.
//   2. Carry it for `holdingMonths` paying `monthlyHolding` (taxes, mowing, etc.).
//   3. Resell at `resalePrice` on OWNER-FINANCE terms:
//        - buyer pays `downPct`% down up front,
//        - finances the rest at `apr` over `termMonths`,
//        - you collect a fixed monthly payment (standard amortization).
//
// All formulas below are textbook and documented inline. No randomness, no I/O —
// same inputs always produce the same outputs, so the result is auditable.
// Money is in whole dollars unless noted; rates are PERCENT inputs (9.9 = 9.9%).
// ─────────────────────────────────────────────────────────────────────────────

export interface FlipInputs {
  buyPrice: number;        // acquisition cost ($) — e.g. tax-sale minimum bid
  closingCost?: number;    // one-time buy-side costs (deed recording, title) ($)
  monthlyHolding: number;  // recurring carry cost while you own it ($/mo)
  holdingMonths: number;   // months held before resale closes
  resalePrice: number;     // owner-finance sale price ($)
  downPct: number;         // buyer down payment as % of resale price (0..100)
  apr: number;             // annual interest rate charged to buyer (%, e.g. 9.9)
  termMonths: number;      // amortization term (months), e.g. 60
  sellingCost?: number;    // one-time sell-side costs (marketing, doc prep) ($)
}

export interface AmortRow {
  month: number;
  payment: number;     // total monthly payment (principal + interest)
  interest: number;    // interest portion
  principal: number;   // principal portion
  balance: number;     // remaining principal after this payment
  cumCash: number;     // cumulative cash collected from buyer (down + payments so far)
}

export interface FlipResult {
  // capital
  totalInvested: number;        // buyPrice + closingCost + all holding + sellingCost
  downPayment: number;          // cash received at resale close
  financedAmount: number;       // resalePrice - downPayment
  monthlyPayment: number;       // level owner-finance installment
  // returns
  totalInterest: number;        // interest earned over the full term
  totalCollected: number;       // downPayment + sum(payments) = resale + interest
  totalProfit: number;          // totalCollected - totalInvested
  cashOnCash: number;           // first-year cash flow / cash invested (%)
  roi: number;                  // totalProfit / totalInvested (%)
  irrAnnual: number | null;     // annualized IRR over the cash-flow timeline (%) — null if not solvable
  schedule: AmortRow[];         // month-by-month income schedule
  annualIncome: number;         // 12 * monthlyPayment (steady-state owner-finance income)
  netCashAtClose: number;       // downPayment - totalBuySideCosts (cash recovered immediately)
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Standard fixed-rate amortization payment.
//   P = principal, i = monthly rate, n = months
//   pmt = P * i / (1 - (1+i)^-n)   (i=0 → P/n)
export function monthlyPayment(principal: number, aprPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const i = aprPct / 100 / 12;
  if (i === 0) return round2(principal / months);
  return round2((principal * i) / (1 - Math.pow(1 + i, -months)));
}

// Build the full amortization / income schedule.
export function amortize(principal: number, aprPct: number, months: number, downPayment = 0): AmortRow[] {
  const rows: AmortRow[] = [];
  if (months <= 0) return rows;
  const i = aprPct / 100 / 12;
  const pmt = monthlyPayment(principal, aprPct, months);
  let balance = principal;
  let cumCash = downPayment;
  for (let m = 1; m <= months; m++) {
    const interest = round2(balance * i);
    let principalPart = round2(pmt - interest);
    // last payment: sweep any rounding remainder so balance lands exactly at 0
    if (m === months || principalPart > balance) principalPart = round2(balance);
    const actualPmt = round2(principalPart + interest);
    balance = round2(balance - principalPart);
    cumCash = round2(cumCash + actualPmt);
    rows.push({ month: m, payment: actualPmt, interest, principal: principalPart, balance: Math.max(0, balance), cumCash });
    if (balance <= 0) break;
  }
  return rows;
}

// IRR via bisection on NPV. cashFlows[0] is the t=0 outflow (negative);
// each subsequent entry is one MONTHLY cash flow. Returns ANNUAL rate (%).
// Returns null if no sign change / not solvable in range.
export function irrMonthly(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const hasPos = cashFlows.some((c) => c > 0);
  const hasNeg = cashFlows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return null;

  const npv = (rate: number) =>
    cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);

  // monthly rate search range: -0.99 .. +1.0 (i.e. -99%..+100% / month)
  let lo = -0.99, hi = 1.0;
  let fLo = npv(lo), fHi = npv(hi);
  if (fLo * fHi > 0) return null; // no root bracketed
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) { lo = hi = mid; break; }
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
  }
  const monthly = (lo + hi) / 2;
  // annualize: (1 + monthly)^12 - 1
  const annual = Math.pow(1 + monthly, 12) - 1;
  if (!isFinite(annual)) return null;
  return round2(annual * 100);
}

export function simulateFlip(inp: FlipInputs): FlipResult {
  const closingCost = inp.closingCost ?? 0;
  const sellingCost = inp.sellingCost ?? 0;
  const holding = Math.max(0, inp.monthlyHolding) * Math.max(0, inp.holdingMonths);
  const totalInvested = round2(inp.buyPrice + closingCost + holding + sellingCost);

  const downPayment = round2(inp.resalePrice * (inp.downPct / 100));
  const financedAmount = round2(inp.resalePrice - downPayment);
  const pmt = monthlyPayment(financedAmount, inp.apr, inp.termMonths);
  const schedule = amortize(financedAmount, inp.apr, inp.termMonths, downPayment);

  const totalPayments = round2(schedule.reduce((a, r) => a + r.payment, 0));
  const totalInterest = round2(schedule.reduce((a, r) => a + r.interest, 0));
  const totalCollected = round2(downPayment + totalPayments);
  const totalProfit = round2(totalCollected - totalInvested);

  // Build the IRR cash-flow timeline (monthly granularity):
  //   t0           = -(buyPrice + closingCost)                  [capital out]
  //   t1..holding  = -monthlyHolding                            [carry]
  //   t(holding)   += downPayment - sellingCost                 [resale close]
  //   t(holding+k) += monthlyPayment                            [installments]
  const buySide = round2(inp.buyPrice + closingCost);
  const flows: number[] = [-buySide];
  for (let m = 1; m <= inp.holdingMonths; m++) flows[m] = (flows[m] || 0) - inp.monthlyHolding;
  // ensure array filled up to holdingMonths
  for (let m = flows.length; m <= inp.holdingMonths; m++) flows[m] = 0;
  const closeIdx = inp.holdingMonths;
  flows[closeIdx] = (flows[closeIdx] || 0) + downPayment - sellingCost;
  for (const r of schedule) {
    const idx = closeIdx + r.month;
    flows[idx] = (flows[idx] || 0) + r.payment;
  }
  for (let m = 0; m < flows.length; m++) if (flows[m] == null) flows[m] = 0;
  const irrAnnual = irrMonthly(flows);

  // cash-on-cash: net cash collected in the FIRST 12 months of ownership-to-income
  // relative to actual cash invested (buy + closing + holding actually paid).
  const cashInvested = round2(buySide + holding + sellingCost);
  const firstYearPayments = schedule.slice(0, 12).reduce((a, r) => a + r.payment, 0);
  const firstYearCash = round2(downPayment + firstYearPayments - holding);
  const cashOnCash = cashInvested > 0 ? round2((firstYearCash / cashInvested) * 100) : 0;
  const roi = totalInvested > 0 ? round2((totalProfit / totalInvested) * 100) : 0;

  return {
    totalInvested,
    downPayment,
    financedAmount,
    monthlyPayment: pmt,
    totalInterest,
    totalCollected,
    totalProfit,
    cashOnCash,
    roi,
    irrAnnual,
    schedule,
    annualIncome: round2(pmt * 12),
    netCashAtClose: round2(downPayment - buySide),
  };
}
