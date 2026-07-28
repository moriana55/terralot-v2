// ─────────────────────────────────────────────────────────────────────────────
// CANLI COUNTY — GERİYE UYUMLULUK KATMANI
//
// Bu dosya eskiden her county'nin ArcGIS uç noktasını ve elle yazılmış
// normalize() fonksiyonunu barındırıyordu (9 county / ~290 satır). 25 eyalete
// çıkarken bu yaklaşım sürdürülemez olduğu için mantık ikiye ayrıldı:
//
//   • `county-registry.ts`      → SADECE VERİ (hangi county, hangi kaynak, alan haritası)
//   • `county-providers/`       → tek generic sorgu + normalize + sağlayıcı zinciri
//
// Buradaki export'lar mevcut ekranların (admin/canli-sorgu) ve API route'unun
// kırılmaması için korunur. Yeni kod doğrudan `@/lib/county-registry` ve
// `@/lib/county-providers` kullanmalı.
// ─────────────────────────────────────────────────────────────────────────────

import { COUNTY_REGISTRY, COUNTY_OPTIONS } from "@/lib/county-registry";
import { buildArcGisWhere, clientFilter } from "@/lib/county-providers/arcgis";
import type { ArcGisSource, CountyEntry, LiveSearch } from "@/lib/county-providers/types";

export type { LiveCountyResult, LiveSearch } from "@/lib/live-county-types";
export { mailable } from "@/lib/live-county-types";
export { clientFilter };

/** @deprecated `COUNTY_REGISTRY` (county-registry.ts) kullanın. */
export const LIVE_COUNTY_REGISTRY: Record<string, CountyEntry> = COUNTY_REGISTRY;

/** Client dropdown için hafif, sır içermeyen liste. */
export interface LiveCountyOption {
  key: string; label: string; state: string; county: string; hasValue: boolean;
  durum: CountyEntry["bilinenDurum"]; not?: string;
}

export const LIVE_COUNTY_OPTIONS: LiveCountyOption[] = COUNTY_OPTIONS.map((o) => ({
  key: o.key, label: o.label, state: o.state, county: o.county,
  hasValue: o.hasValue, durum: o.durum, not: o.not,
}));

/**
 * @deprecated Sağlayıcı katmanı WHERE'i kendi üretir (`queryCounty`).
 * Yalnızca ArcGIS kaynağı olan county'ler için anlamlıdır.
 */
export function buildWhere(entry: CountyEntry, search: LiveSearch): string {
  const arc = entry.sources.find((s): s is ArcGisSource => s.kind === "arcgis");
  return arc ? buildArcGisWhere(arc, search) : "";
}
