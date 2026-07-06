"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

// Panoya kopyalama window.location.origin ister → küçük client adacığı.
// Sunucu sayfası sadece id listesini verir; URL burada kurulur.

const urlFor = (id: string) => `${window.location.origin}/p/${encodeURIComponent(id)}`;

export function CopyLinkButton({ id }: { id: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(urlFor(id)); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* no-op */ }
      }}
      title="Satış linkini kopyala (WhatsApp'a yapıştır)"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-[var(--surface-high)]"
      style={{ color: ok ? "var(--grade-a)" : "var(--accent-ink)" }}>
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {ok ? "kopyalandı" : "link"}
    </button>
  );
}

export function OpenLinkButton({ id }: { id: string }) {
  return (
    <a href={`/p/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-[var(--surface-high)]"
      style={{ color: "var(--muted)" }}>
      <ExternalLink className="h-3 w-3" /> aç
    </a>
  );
}

export function CopyAllButton({ ids }: { ids: string[] }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(ids.map(urlFor).join("\n"));
          setOk(true); setTimeout(() => setOk(false), 2000);
        } catch { /* no-op */ }
      }}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
      style={{ background: "var(--surface-high)", color: ok ? "var(--grade-a)" : "var(--foreground)" }}
      title="Listedeki tüm satış linklerini alt alta panoya kopyala">
      {ok ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {ok ? "Kopyalandı" : `Görünen ${ids.length} linki kopyala`}
    </button>
  );
}
