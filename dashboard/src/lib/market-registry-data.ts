import lunaData from "@/data/import-propstream-nm-luna.json";
import mohaveData from "@/data/mohave-offmarket.json";
import coloradoData from "@/data/colorado-offmarket.json";
import { buildMarketRegistry } from "@/lib/market-registry";

const snapshotOf = (data: { count?: number; rows?: unknown[]; source?: string; generatedAt?: string }) => ({
  count: Array.isArray(data.rows) ? data.rows.length : Number(data.count) || 0,
  source: data.source || "Kaynak belirtilmedi",
  generatedAt: data.generatedAt || null,
});

export const MARKETS = buildMarketRegistry({
  mohave: snapshotOf(mohaveData),
  luna: snapshotOf(lunaData),
  colorado: snapshotOf(coloradoData),
});

