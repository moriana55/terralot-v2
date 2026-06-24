"use client";
// Ucuz-arsa lead listesini CSV olarak indir — Ahmet "mektup atılacak listeyi" tek tıkla alsın.
import { Download } from "lucide-react";

interface Row {
  owner: string; mailAddr: string; property: string; county: string; state: string;
  taxDebt: number; acres?: number | null; landValue?: number | null;
  grade?: string; score?: number; absentee?: boolean; estate?: boolean;
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function CsvButton({ rows }: { rows: Row[] }) {
  function download() {
    const headers = [
      "Owner", "Mailing Address", "Property", "County", "State",
      "Tax Debt", "Acres", "Land Value", "Grade", "Score", "Absentee", "Estate",
    ];
    const lines = rows.map((d) =>
      [
        d.owner, d.mailAddr, d.property, d.county, d.state,
        d.taxDebt, d.acres ?? "", d.landValue ?? "", d.grade ?? "", d.score ?? "",
        d.absentee ? "yes" : "no", d.estate ? "yes" : "no",
      ].map(esc).join(",")
    );
    const csv = [headers.join(","), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ucuz-arsa-lead-listesi-${rows.length}.csv`;
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
