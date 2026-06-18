"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, Calculator } from "lucide-react";
import { buildSchedule, usd, type InstallmentRow } from "@/lib/buyer";

// ─────────────────────────────────────────────────────────────────────────────
// BUYER PAYMENT SCHEDULE
//
// When a buyer has a signed contract, this view renders THAT contract's
// amortization schedule (price/down/term/APR + paymentsMade) from the buyer's
// own row. There is no buyer↔contract table wired yet, so the page ships an
// interactive estimator using the SAME deterministic math (lib/buyer.ts) so the
// tool is live and accurate today; it's clearly labeled as an estimate.
// ─────────────────────────────────────────────────────────────────────────────

const statusMeta: Record<InstallmentRow["status"], { label: string; color: string; icon: typeof Clock }> = {
  paid: { label: "Paid", color: "var(--status-paid)", icon: CheckCircle2 },
  due: { label: "Due", color: "var(--primary)", icon: Clock },
  overdue: { label: "Overdue", color: "var(--status-overdue)", icon: AlertTriangle },
  upcoming: { label: "Upcoming", color: "var(--muted)", icon: Clock },
};

export default function BuyerPayments() {
  const [price, setPrice] = useState(12999);
  const [down, setDown] = useState(299);
  const [term, setTerm] = useState(48);
  const [apr, setApr] = useState(9.9);
  const [paid, setPaid] = useState(8);

  const schedule = useMemo(
    () =>
      buildSchedule({
        price,
        downPayment: down,
        termMonths: term,
        annualRatePct: apr,
        paymentsMade: paid,
      }),
    [price, down, term, apr, paid]
  );

  const progressPct = Math.round((schedule.paidCount / Math.max(1, term)) * 100);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Payment Schedule</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Your owner-finance installments, due dates, and remaining balance.
        </p>
      </div>

      <div
        className="mb-6 flex items-start gap-3 rounded-xl border p-4 text-xs"
        style={{ background: "var(--status-info-soft)", borderColor: "var(--border-strong)", color: "var(--muted)" }}
      >
        <Calculator className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
        <span>
          Estimate preview — once your contract is linked, these numbers come
          straight from your signed agreement. Adjust the terms below to see how a
          schedule is calculated.
        </span>
      </div>

      {/* Term controls */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Price", val: price, set: setPrice, step: 500, suffix: "$" },
          { label: "Down", val: down, set: setDown, step: 50, suffix: "$" },
          { label: "Term (mo)", val: term, set: setTerm, step: 6, suffix: "" },
          { label: "APR %", val: apr, set: setApr, step: 0.5, suffix: "" },
          { label: "Paid", val: paid, set: setPaid, step: 1, suffix: "" },
        ].map((f) => (
          <div key={f.label}>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>{f.label}</label>
            <input
              type="number"
              value={f.val}
              min={0}
              step={f.step}
              onChange={(e) => f.set(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-[var(--surface-low)] border rounded-lg px-3 py-2 text-sm outline-none tabular-nums"
              style={{ borderColor: "var(--outline)" }}
            />
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Monthly", value: usd(schedule.monthlyPayment), color: "var(--primary)" },
          { label: "Financed", value: usd(schedule.financed), color: "var(--foreground)" },
          { label: "Remaining", value: usd(schedule.remainingBalance), color: "var(--warn)" },
          { label: "Total interest", value: usd(schedule.totalInterest), color: "var(--muted)" },
        ].map((s) => (
          <div key={s.label} className="tl-card p-4">
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="tl-card p-5 mb-6">
        <div className="flex items-center justify-between text-xs mb-2">
          <span style={{ color: "var(--muted)" }}>Payoff progress</span>
          <span className="font-bold tabular-nums">{schedule.paidCount}/{term} · {progressPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-high)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: "var(--success)" }} />
        </div>
        {schedule.nextDue && (
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            Next payment {usd(schedule.nextDue.amount)} on {schedule.nextDue.dueDate}
          </p>
        )}
      </div>

      {/* Schedule table */}
      <div className="tl-card overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_90px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b" style={{ color: "var(--muted)", borderColor: "var(--border)", background: "var(--surface-low)" }}>
          <span>#</span><span>Due</span><span className="text-right">Payment</span><span className="text-right">Principal</span><span className="text-right">Balance</span><span className="text-right">Status</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {schedule.rows.map((r) => {
            const m = statusMeta[r.status];
            const Icon = m.icon;
            return (
              <div key={r.n} className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_90px] gap-2 px-4 py-2.5 text-xs border-b last:border-0 tabular-nums items-center transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--muted)" }}>{r.n}</span>
                <span>{r.dueDate}</span>
                <span className="text-right font-semibold">{usd(r.amount)}</span>
                <span className="text-right" style={{ color: "var(--muted)" }}>{usd(r.principal)}</span>
                <span className="text-right" style={{ color: "var(--muted)" }}>{usd(r.balance)}</span>
                <span className="flex items-center justify-end gap-1 font-semibold" style={{ color: m.color }}>
                  <Icon className="w-3 h-3" /> {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] mt-4 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
        <CalendarClock className="w-3 h-3" /> Schedule computed locally from your terms — no payment data leaves the page in this preview.
      </p>
    </div>
  );
}
