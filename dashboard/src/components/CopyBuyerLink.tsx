"use client";

// "🔗 Müşteri linkini kopyala" — herkese açık /p/<id> alıcı sayfası linkini
// panoya kopyalar (Ahmet'in WhatsApp'tan alıcıya attığı link). Harita popup'ları
// (inline-style dünyası) ve tailwind sayfaları aynı bileşeni kullanır.

import { useState } from "react";

export function buyerLinkFor(dealId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/p/${encodeURIComponent(dealId)}`;
}

export default function CopyBuyerLink({
  dealId,
  style,
  className,
}: {
  dealId: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = buyerLinkFor(dealId);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API yoksa (http vb.) son çare: prompt ile elle kopyalat.
      window.prompt("Linki kopyala:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Herkese açık alıcı sayfası linkini kopyala (WhatsApp'tan gönder)"
      className={className}
      style={
        style ?? (className ? undefined : {
          border: "none",
          background: copied ? "#059669" : "#7c3aed",
          color: "#fff",
          borderRadius: 5,
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        })
      }
    >
      {copied ? "✓ Kopyalandı" : "🔗 Müşteri linki"}
    </button>
  );
}
