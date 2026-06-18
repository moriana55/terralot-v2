// Shared investor-portal primitives — one polished card + status pill, so every
// investor surface looks consistent and uses the semantic token system.
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`tl-card p-5 ${className}`}>{children}</div>;
}

const STATUS: Record<string, { fg: string; bg: string }> = {
  available: { fg: "var(--status-info)", bg: "var(--status-info-soft)" },
  pending: { fg: "var(--status-pending)", bg: "var(--status-pending-soft)" },
  sold: { fg: "var(--status-paid)", bg: "var(--status-paid-soft)" },
  paid: { fg: "var(--status-paid)", bg: "var(--status-paid-soft)" },
  overdue: { fg: "var(--status-overdue)", bg: "var(--status-overdue-soft)" },
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const c = STATUS[status] ?? STATUS.available;
  return (
    <span className="tl-pill" style={{ background: c.bg, color: c.fg }}>
      {label ?? status}
    </span>
  );
}
