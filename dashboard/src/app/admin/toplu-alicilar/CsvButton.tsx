"use client";
// Toplu alıcı listesini CSV indir — Ahmet doğrudan toplu mektup/teklif listesi olarak kullanır.
import { Download } from "lucide-react";

export interface AliciRow {
  owner: string;
  parsel: number;
  donum: number | null;
  countyN: number;
  eyaletN: number;
  bolgeler: string[];
  posta: string | null;
  sonAlim: number | null;
  tazeParsel: number | null;
  ortAlimFiyat: number | null;
  kesisimAplus: number;
  kesisimTum: number;
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function CsvButton({ rows, ad }: { rows: AliciRow[]; ad: string }) {
  function download() {
    const headers = [
      "Company", "Parcels Owned", "Acres", "Counties", "States", "Regions",
      "Mailing Address", "Last Purchase Year", "Recent Parcels", "Avg Purchase $",
      "Our A+/A Inventory (same counties)", "Our Total Inventory (same counties)",
    ];
    const lines = rows.map((r) =>
      [
        r.owner, r.parsel, r.donum ?? "", r.countyN, r.eyaletN, r.bolgeler.join(" | "),
        r.posta ?? "", r.sonAlim ?? "", r.tazeParsel ?? "", r.ortAlimFiyat ?? "",
        r.kesisimAplus, r.kesisimTum,
      ].map(esc).join(",")
    );
    const csv = [headers.join(","), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toplu-alici-${ad}-${rows.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors"
      style={{ background: "var(--surface-2, #f1f5f9)", color: "var(--foreground)" }}
    >
      <Download size={15} />
      CSV indir ({rows.length})
    </button>
  );
}
