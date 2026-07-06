import type { Metadata } from "next";

// Sayfa client component olduğu için metadata burada (layout) tanımlanır.
export const metadata: Metadata = {
  title: "Owner Financed Land — Low Down, Monthly Payments",
  description:
    "Owner-financed vacant land across the US. No banks, no credit checks — put a little down and pay monthly. Terms from 12 to 72 months, pay off early anytime.",
};

export default function OwnerFinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
