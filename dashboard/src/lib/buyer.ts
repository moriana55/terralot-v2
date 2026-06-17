// Buyer-portal domain helpers — pure, deterministic, key-free.
//
// The buyer portal shows a logged-in buyer their parcels, an amortization-style
// installment schedule, and contract/document status. There is no buyer↔parcel
// table wired to a real authenticated buyer yet, so the pages render honest
// empty states until that model lands (see RLS SQL in the PR notes). The math
// below is fully code-only so the schedule view always works once a contract
// row exists, with NO external dependency.

export interface InstallmentRow {
  n: number;            // installment number (1..term)
  dueDate: string;      // ISO date
  amount: number;       // scheduled payment this period
  principal: number;    // principal portion
  interest: number;     // interest portion
  balance: number;      // remaining balance after this payment
  status: "paid" | "due" | "upcoming" | "overdue";
}

export interface ScheduleInput {
  price: number;            // sale price
  downPayment: number;      // amount paid at signing
  termMonths: number;       // number of monthly installments
  annualRatePct: number;    // APR (e.g. 9.9). 0 = simple equal split.
  startDate?: Date;         // first installment due date (default: today)
  paymentsMade?: number;    // how many installments already paid
}

export interface ScheduleResult {
  monthlyPayment: number;
  financed: number;         // price - downPayment
  totalInterest: number;
  totalPaid: number;        // downPayment + all installments
  rows: InstallmentRow[];
  paidCount: number;
  remainingBalance: number;
  nextDue: InstallmentRow | null;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + months);
  return x;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Standard amortization. When annualRatePct is 0, falls back to an even
// principal split (the owner-finance "no interest" framing many lots use).
export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const price = Math.max(0, input.price);
  const down = Math.max(0, Math.min(price, input.downPayment));
  const term = Math.max(1, Math.floor(input.termMonths));
  const ratePct = Math.max(0, input.annualRatePct);
  const financed = round2(price - down);
  const start = input.startDate ?? new Date();
  const paymentsMade = Math.max(0, Math.min(term, Math.floor(input.paymentsMade ?? 0)));

  const monthlyRate = ratePct / 100 / 12;
  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = round2(financed / term);
  } else {
    const factor = Math.pow(1 + monthlyRate, term);
    monthlyPayment = round2((financed * monthlyRate * factor) / (factor - 1));
  }

  const rows: InstallmentRow[] = [];
  let balance = financed;
  let totalInterest = 0;
  const today = new Date();

  for (let i = 1; i <= term; i++) {
    const interest = monthlyRate === 0 ? 0 : round2(balance * monthlyRate);
    let principal = round2(monthlyPayment - interest);
    // Final installment absorbs rounding drift so the balance lands at 0.
    if (i === term) {
      principal = round2(balance);
    }
    const amount = round2(principal + interest);
    balance = round2(balance - principal);
    if (balance < 0) balance = 0;
    totalInterest = round2(totalInterest + interest);

    const dueDate = addMonths(start, i - 1);
    let status: InstallmentRow["status"];
    if (i <= paymentsMade) status = "paid";
    else if (i === paymentsMade + 1) status = dueDate < today ? "overdue" : "due";
    else status = "upcoming";

    rows.push({
      n: i,
      dueDate: dueDate.toISOString().slice(0, 10),
      amount,
      principal,
      interest,
      balance,
      status,
    });
  }

  const remainingBalance = rows
    .filter((r) => r.status !== "paid")
    .reduce((s, r) => s + r.principal, 0);
  const nextDue = rows.find((r) => r.status === "due" || r.status === "overdue") ?? null;
  const totalPaid = round2(down + monthlyPayment * term);

  return {
    monthlyPayment,
    financed,
    totalInterest,
    totalPaid,
    rows,
    paidCount: paymentsMade,
    remainingBalance: round2(remainingBalance),
    nextDue,
  };
}

export const usd = (n: number | null | undefined): string =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;
