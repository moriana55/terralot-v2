"use client";

// Canlı off-market sayıları hook'u — TEK GERÇEK KAYNAK /api/admin/offmarket-breakdown.
// Tüm lead sayısı/eyalet kırılımı gösteren client sayfalar BU hook'u kullanmalı;
// hardcoded sayı yazılmaz. Fallback tek dosyadan (offmarket-stats.ts) gelir.

import { useEffect, useState } from "react";
import { OFFMARKET_FALLBACK_COUNTS, OFFMARKET_FALLBACK_TOTAL } from "./offmarket-stats";

export type OffmarketStats = {
  /** Eyalet → canlı sayı (API gelene kadar fallback). */
  counts: Record<string, number>;
  /** Toplam lead (API gelene kadar fallback toplam). */
  total: number;
  /** true = sayılar canlı API'den doğrulandı. */
  live: boolean;
};

export function useOffmarketStats(): OffmarketStats {
  const [stats, setStats] = useState<OffmarketStats>({
    counts: { ...OFFMARKET_FALLBACK_COUNTS },
    total: OFFMARKET_FALLBACK_TOTAL,
    live: false,
  });

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/offmarket-breakdown")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !Array.isArray(d.byState) || !d.byState.length) return;
        const counts: Record<string, number> = { ...OFFMARKET_FALLBACK_COUNTS };
        for (const s of d.byState as Array<{ state: string; count: number }>) {
          if (typeof s.count === "number") counts[s.state] = s.count;
        }
        const total =
          typeof d.total === "number" && d.total > 0
            ? d.total
            : Object.values(counts).reduce((a, b) => a + b, 0);
        setStats({ counts, total, live: true });
      })
      .catch(() => {
        /* fallback kalır */
      });
    return () => {
      alive = false;
    };
  }, []);

  return stats;
}
