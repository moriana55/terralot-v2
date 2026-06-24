"use client";
// Gerçek deal lead listesini CSV indir — Ahmet "mektup atılacak Dallas listesini" tek tıkla alsın.
import { Download } from "lucide-react";

interface Row {
  owner: string; mailAddr: string | null; address: string; apn: string | null;
  acres: number | null; use: string; landValue: number | null;
  totalAssessed: number | null; taxDebt: number; suggestedOffer: number; estSpread: number;
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function CsvButton({ rows }: { rows: Row[] }) {
  function download() {
    const headers = [
      "Owner", "Mailing Address", "Property Address", "APN", "Acres", "Use",
      "Land Value", "Total Assessed", "Tax Debt", "Suggested Offer", "Est Spread",
    ];
    const lines = rows.map((d) =>
      [
        d.owner, d.mailAddr ?? "", d.address, d.apn ?? "", d.acres ?? "", d.use,
        d.landValue ?? "", d.totalAssessed ?? "", d.taxDebt, d.suggestedOffer, d.estSpread,
      ].map(esc).join(",")
    );
    const csv = [headers.join(","), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dallas-gercek-deal-listesi-${rows.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors hover:bg-white/[0.04]"
      style={{ borderColor: "var(--outline)", color: "var(--foreground)" }}
      title="Mektup için lead listesini CSV indir"
    >
      <Download className="w-3.5 h-3.5" /> Lead listesi (CSV)
    </button>
  );
}
