import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Database, MapPin, ShieldAlert } from "lucide-react";
import {
  READINESS_LABELS,
  STATUS_LABELS,
  type MarketStatus,
  type Readiness,
} from "@/lib/market-registry";
import { MARKETS } from "@/lib/market-registry-data";

export const metadata = { title: "Aktif Pazarlar — TerraLot" };

const STATUS_STYLE: Record<MarketStatus, { color: string; background: string }> = {
  active: { color: "#166534", background: "#dcfce7" },
  pilot: { color: "#92400e", background: "#fef3c7" },
  research: { color: "#1e40af", background: "#dbeafe" },
  watch: { color: "#475569", background: "#e2e8f0" },
  blocked: { color: "#991b1b", background: "#fee2e2" },
};

const READY_STYLE: Record<Readiness, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ready: { label: "Hazır", color: "#16a34a", icon: CheckCircle2 },
  partial: { label: "Kısmi", color: "#d97706", icon: CircleDashed },
  missing: { label: "Eksik", color: "#dc2626", icon: ShieldAlert },
};

export default function MarketsPage() {
  const active = MARKETS.filter((m) => m.status === "active").length;
  const pilots = MARKETS.filter((m) => m.status === "pilot").length;
  const sourceRows = MARKETS.reduce((sum, m) => sum + m.sourceRows, 0);

  return (
    <div className="space-y-6 p-6" style={{ color: "var(--foreground)" }}>
      <header>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#16a34a" }}>
          Market Registry · Kontrollü Ölçekleme
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <MapPin className="h-6 w-6" style={{ color: "#16a34a" }} /> Aktif Pazarlar
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          Bir eyaleti tek tuşla açmıyoruz. Veri, county doğrulaması, hukuki inceleme ve operasyon partnerleri
          hazır oldukça market <strong>izleme → araştırma → pilot → aktif</strong> aşamalarından geçer.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Aktif market" value={active.toString()} />
        <Stat label="Pilot market" value={pilots.toString()} />
        <Stat label="Registry" value={`${MARKETS.length} market`} />
        <Stat label="Hazır kaynak satırı" value={sourceRows.toLocaleString("en-US")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {MARKETS.map((market) => {
          const style = STATUS_STYLE[market.status];
          return (
            <article key={market.id} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{market.name}, {market.stateCode}</h2>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={style}>
                      {STATUS_LABELS[market.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {market.counties.length ? market.counties.join(", ") : "County seçilmedi"}
                    {market.regions.length ? ` · ${market.regions.join(" · ")}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold tabular-nums">{market.sourceRows.toLocaleString("en-US")}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>kaynak satırı</div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-low)" }}>
                <div className="flex items-center gap-1.5 font-semibold"><Database className="h-3.5 w-3.5" /> {market.source}</div>
                <div className="mt-1" style={{ color: "var(--muted)" }}>
                  {market.updatedAt ? `Snapshot: ${new Date(market.updatedAt).toLocaleDateString("tr-TR")}` : "Henüz snapshot yok"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {Object.entries(market.readiness).map(([key, value]) => {
                  const ready = READY_STYLE[value];
                  const Icon = ready.icon;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                      <span style={{ color: "var(--muted)" }}>{READINESS_LABELS[key as keyof typeof READINESS_LABELS]}</span>
                      <span className="flex items-center gap-1 font-semibold" style={{ color: ready.color }}>
                        <Icon className="h-3.5 w-3.5" /> {ready.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-high)" }}>
                <strong>Sonraki adım:</strong> {market.nextAction}
              </div>

              {(market.inventoryHref || market.campaignHref) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {market.inventoryHref && (
                    <Link href={market.inventoryHref} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold" style={{ background: "var(--primary)", color: "var(--background)" }}>
                      Veriyi aç <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {market.campaignHref && (
                    <Link href={market.campaignHref} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--outline)" }}>
                      Kampanya kurucu
                    </Link>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
