import lunaData from "@/data/import-propstream-nm-luna.json";
import mohaveData from "@/data/mohave-offmarket.json";
// CO satır-dumpları (Costilla 14MB / Valencia 32MB gibi) bundle'a alınmaz; yalnız
// hafif sayaç meta dosyası import edilir. Ham veri Supabase offmarket_leads'te.
import coMeta from "@/data/co-offmarket-meta.json";
import { buildMarketRegistry } from "@/lib/market-registry";

type Snapshot = { count?: number; rows?: unknown[]; source?: string; generatedAt?: string };
const rowCount = (data: Snapshot) => (Array.isArray(data.rows) ? data.rows.length : Number(data.count) || 0);
const snapshotOf = (data: Snapshot) => ({
  count: rowCount(data),
  source: data.source || "Kaynak belirtilmedi",
  generatedAt: data.generatedAt || null,
});

// Colorado artık üç açık ArcGIS kaynağından birleşik: statewide + Costilla + Las Animas
// (hepsi sahip + POSTA adresi taşır). Meta dosyasındaki toplam gerçek CO lead sayısını yansıtır.
const coloradoCombined = {
  count: coMeta.coloradoTotal || 0,
  source: "CO açık ArcGIS: statewide + Costilla + Las Animas (sahip + posta adresi)",
  generatedAt: coMeta.sources?.["co-costilla"]?.generatedAt || coMeta.generatedAt || null,
};

export const MARKETS = buildMarketRegistry({
  mohave: snapshotOf(mohaveData),
  luna: snapshotOf(lunaData),
  colorado: coloradoCombined,
});

