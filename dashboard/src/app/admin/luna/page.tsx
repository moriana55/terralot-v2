// ─────────────────────────────────────────────────────────────────────────────
// LUNA COUNTY (NM) OFF-MARKET — Terralot'un ikinci gerçek off-market envanteri.
// KAYNAK: PropStream export (import-propstream-nm-luna.json, 157 kayıt) → Supabase
//   offmarket_leads tablosuna yüklendi (county='Luna', source='PROPSTREAM:NM-Luna').
// Her satırda GERÇEK sahip adı + POSTA adresi → blind-offer mektubu atılır (Lob).
// Değerleme (est_offer/retail/margin) henüz boş — bir sonraki adım. Renkler var(--*).
// ─────────────────────────────────────────────────────────────────────────────
import data from "@/data/import-propstream-nm-luna.json";
import { MapPin, ExternalLink, TrendingUp, Home, Globe, Mail } from "lucide-react";

export const metadata = { title: "Luna Off-Market — Terralot" };

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const GREEN = "#16a34a";

interface Row {
  lead_id: string; apn: string; owner: string;
  mailing_address: string; mailing_city: string; mailing_state: string; mailing_zip: string;
  situs: string; use: string; acres: number | null; land_value: number | null;
  region: string; county: string; state: string; absentee: boolean;
  lat: number | null; lng: number | null;
}

const rows = (data.rows as Row[]) ?? [];
const mailable = rows.filter((r) => r.owner && r.mailing_address).length;

const byRegion: Record<string, number> = {};
const byState: Record<string, number> = {};
for (const r of rows) {
  byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  byState[r.mailing_state] = (byState[r.mailing_state] || 0) + 1;
}
const avgAcres = rows.length ? rows.reduce((a, r) => a + (r.acres ?? 0), 0) / rows.length : 0;
const withValue = rows.filter((r) => r.land_value != null);
const avgLandValue = withValue.length
  ? withValue.reduce((a, r) => a + (r.land_value ?? 0), 0) / withValue.length : 0;
const absenteeCount = rows.filter((r) => r.absentee).length;
const topStates = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 8);
const regions = Object.entries(byRegion).sort((a, b) => b[1] - a[1]);

// ── Sahibe göre grupla: aynı sahip+adres → tek mektupla toplu teklif hedefi ──
interface OwnerGroup { owner: string; mail: string; count: number; acres: number; landValue: number; }
const ownerMap = new Map<string, OwnerGroup>();
for (const r of rows) {
  const key = `${r.owner}|${r.mailing_address}|${r.mailing_city}|${r.mailing_state}`;
  let g = ownerMap.get(key);
  if (!g) { g = { owner: r.owner, mail: `${r.mailing_address}, ${r.mailing_city} ${r.mailing_state} ${r.mailing_zip}`, count: 0, acres: 0, landValue: 0 }; ownerMap.set(key, g); }
  g.count++; g.acres += r.acres ?? 0; g.landValue += r.land_value ?? 0;
}
const multiOwners = [...ownerMap.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count);
const reachableParcels = multiOwners.reduce((a, g) => a + g.count, 0);

// Land value azalan sıralı liste (değeri olanlar önde), tamamı gösterilir (157).
const sorted = [...rows].sort((a, b) => (b.land_value ?? 0) - (a.land_value ?? 0));

export default function LunaPage() {
  return (
    <div className="space-y-6 p-6" style={{ color: "var(--foreground)" }}>
      <header>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GREEN }}>
          ✅ Gerçek Veri · Off-Market · İkinci Pazar
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <MapPin className="h-6 w-6" style={{ color: GREEN }} /> Luna Off-Market Envanteri
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          New Mexico · Luna County (Deming çevresi). Açık artırma <strong>değil</strong> — doğrudan
          absentee sahipten. PropStream export&apos;undan çekilen{" "}
          <strong style={{ color: GREEN }}>{data.count.toLocaleString("en-US")}</strong> kayıt;
          her satırda gerçek sahip adı + posta adresi → blind-offer mektubu atılır.
          Kayıtlar Supabase <code className="rounded px-1 py-0.5" style={{ background: "var(--surface-high)" }}>offmarket_leads</code>
          {" "}tablosunda (county=&apos;Luna&apos;). Değerleme (est_offer / retail) bir sonraki adım.
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Kaynak: {data.source} · Snapshot: {new Date(data.generatedAt).toLocaleString("tr-TR")}
        </p>
      </header>

      {/* Özet kartlar — yalnız gerçek veri */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<Home className="h-4 w-4" />} label="Toplam lead" value={data.count.toLocaleString("en-US")} accent />
        <Stat icon={<Mail className="h-4 w-4" />} label="Mektup-atılır" value={mailable.toLocaleString("en-US")} accent />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Ort. land value" value={fmt(avgLandValue)} />
        <Stat icon={<MapPin className="h-4 w-4" />} label="Ort. acre" value={`${avgAcres.toFixed(2)} acre`} />
        <Stat icon={<Globe className="h-4 w-4" />} label="Absentee sahip" value={absenteeCount.toLocaleString("en-US")} />
        <Stat icon={<Globe className="h-4 w-4" />} label="Sahip eyaleti" value={`${Object.keys(byState).length} eyalet`} />
      </div>

      {/* Bölge + eyalet dağılımı */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h3 className="mb-2 text-sm font-semibold">Bölge dağılımı</h3>
          <div className="space-y-1.5">
            {regions.map(([reg, n]) => (
              <div key={reg} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--muted)" }}>{reg}</span>
                <span className="font-semibold tabular-nums">{n.toLocaleString("en-US")}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h3 className="mb-2 text-sm font-semibold">En çok sahip posta eyaleti</h3>
          <div className="flex flex-wrap gap-2">
            {topStates.map(([st, n]) => (
              <span key={st} className="rounded-md px-2 py-1 text-xs font-medium" style={{ background: "var(--surface-high)" }}>
                {st} <span className="font-bold" style={{ color: GREEN }}>{n}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 🎯 Çok parselli sahipler — toplu teklif hedefi */}
      {multiOwners.length > 0 && (
        <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="flex items-center gap-2 text-base font-bold">🎯 Çok parselli sahipler — toplu teklif hedefi</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              <strong style={{ color: GREEN }}>{multiOwners.length.toLocaleString("en-US")}</strong> sahip 2+ parsel tutuyor →
              bunlara tek mektupla <strong style={{ color: GREEN }}>{reachableParcels.toLocaleString("en-US")}</strong> parsele
              ulaşılır ({Math.round((reachableParcels / (rows.length || 1)) * 100)}% envanter).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                  <th className="px-3 py-2.5 font-bold">Sahip</th>
                  <th className="px-3 py-2.5 font-bold">Posta adresi</th>
                  <th className="px-3 py-2.5 text-right font-bold">Parsel</th>
                  <th className="px-3 py-2.5 text-right font-bold">Toplam acre</th>
                  <th className="px-3 py-2.5 text-right font-bold">Toplam land value</th>
                </tr>
              </thead>
              <tbody>
                {multiOwners.slice(0, 40).map((g, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 font-medium">{g.owner}</td>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{g.mail}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: GREEN }}>{g.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.acres.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{fmt(g.landValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tüm parsel listesi (land value azalan sıralı, tamamı) */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
              <th className="px-3 py-2.5 font-bold">Sahip</th>
              <th className="px-3 py-2.5 font-bold">Posta adresi (mektup)</th>
              <th className="px-3 py-2.5 font-bold">Situs</th>
              <th className="px-3 py-2.5 font-bold">Bölge</th>
              <th className="px-3 py-2.5 text-right font-bold">Acre</th>
              <th className="px-3 py-2.5 text-right font-bold">Land value</th>
              <th className="px-3 py-2.5 text-center font-bold">Absentee</th>
              <th className="px-3 py-2.5 font-bold">Harita</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.lead_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-medium">{r.owner}</td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {r.mailing_address}, {r.mailing_city} {r.mailing_state} {r.mailing_zip}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{r.situs || "—"}</td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{r.region}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.acres ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.land_value)}</td>
                <td className="px-3 py-2 text-center">
                  {r.absentee ? <span style={{ color: GREEN }}>✓</span> : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                <td className="px-3 py-2">
                  {r.lat && r.lng ? (
                    <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: GREEN }}>
                      <ExternalLink className="h-3 w-3" /> aç
                    </a>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Land value azalan sıralı, {data.count.toLocaleString("en-US")} satırın tamamı gösteriliyor. Hepsi
        gerçek sahip + posta adresi içerir (mektup-atılır). Sonraki adım: est_offer / retail değerlemesi ekle,
        25 APN&apos;yi Luna County kaydıyla örneklem doğrula, sonra kampanya kur.
      </p>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>{icon} {label}</div>
      <div className="mt-1 text-xl font-bold" style={accent ? { color: GREEN } : undefined}>{value}</div>
    </div>
  );
}
