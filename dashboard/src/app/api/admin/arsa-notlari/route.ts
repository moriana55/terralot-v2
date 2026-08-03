import { NextRequest, NextResponse } from "next/server";
// Canlı RPC zaman aşımına uğrarsa düşülecek yedek (scraper/build-not-matrisi.mjs üretir).
import notMatrisiSnapshot from "@/data/not-matrisi.json";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// ARSA NOTLARI (A+ VİTRİN) — not motoru özet + vitrin kartları.
// • Huni + eyalet×not matrisi: offmarket_grade_matrix() RPC (tek istek).
// • Kartlar: A+/A lead'leri grade_score sırasıyla — grade_flags gerekçeleriyle.
// • Rakip comp'u SADECE pazar-var-mı kanıtı olarak eklenir (kartın ana mesajı
//   arsanın cazibesidir, fiyat farkı değil). Rakip aynı county'de yoksa comp
//   alanı hiç gönderilmez (sahte comp üretilmez — dürüstlük kuralı).
// Şema yoksa (scraper/sql/offmarket_grades.sql çalıştırılmadıysa) UI'ya
// schemaReady:false döner; sayfa owner-aksiyonunu gösterir, çökmez.
// ─────────────────────────────────────────────────────────────────────────────

const CARD_COLS =
  "lead_id, state, county, region, apn, owner, situs, use, acres, land_value, est_offer, est_retail, est_margin, absentee, mailing_city, mailing_state, grade, grade_score, grade_flags, grade_breakdown, dist_road_m, dist_power_m, dist_water_m, dist_town_m, geo_enriched_at, lat, lng";

const normC = (c: unknown) =>
  String(c ?? "").toUpperCase().replace(/,\s*[A-Z]{2}$/, "").replace(/\s+COUNTY$/, "").trim();
const STATE_ABBR: Record<string, string> = {
  ALABAMA: "AL", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO",
  FLORIDA: "FL", GEORGIA: "GA", MICHIGAN: "MI", MISSOURI: "MO", NEVADA: "NV",
  "NEW MEXICO": "NM", "NORTH CAROLINA": "NC", OKLAHOMA: "OK", OREGON: "OR",
  "SOUTH CAROLINA": "SC", TENNESSEE: "TN", TEXAS: "TX",
};
function normSt(s: unknown): string | null {
  const t = String(s ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(t)) return t;
  for (const [name, ab] of Object.entries(STATE_ABBR)) if (t.startsWith(name)) return ab;
  return null;
}
const median = (a: number[]) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();

  // 1) Eyalet × not matrisi + geo ilerleme (RPC — sql/offmarket_grades.sql kurar).
  type MxRow = { state: string; grade: string | null; n: number; geo_n: number };
  const SNAP = notMatrisiSnapshot as { uretildi: string; matrix: MxRow[] };

  const mx = await s.rpc("offmarket_grade_matrix");
  let matrix: MxRow[];
  let matrisKaynagi: "canli" | "snapshot" = "canli";
  let snapshotAni: string | null = null;

  if (mx.error) {
    const msg = mx.error.message ?? "";
    if (/function|does not exist|schema cache|column/i.test(msg)) {
      return NextResponse.json({ schemaReady: false, note: msg });
    }
    // 921K satırlık tam tarama; veritabanı ağır yazma altındayken (geo turu,
    // hasat) statement timeout veriyor ve sayfa TAMAMEN boş kalıyordu.
    // Sayı göstermemektense biraz eski ama gerçek sayıyı göster — kaynağı da
    // dürüstçe söyle. Snapshot: node scraper/build-not-matrisi.mjs
    if (SNAP?.matrix?.length) {
      matrix = SNAP.matrix;
      matrisKaynagi = "snapshot";
      snapshotAni = SNAP.uretildi;
    } else {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } else {
    matrix = (mx.data ?? []) as MxRow[];
  }
  const funnel = { total: 0, graded: 0, geoDone: 0, aPlus: 0, a: 0, b: 0 };
  for (const r of matrix) {
    funnel.total += r.n;
    if (r.grade) funnel.graded += r.n;
    funnel.geoDone += r.geo_n;
    if (r.grade === "A+") funnel.aPlus += r.n;
    else if (r.grade === "A") funnel.a += r.n;
    else if (r.grade === "B") funnel.b += r.n;
  }

  // 2) Vitrin kartları — A+ önce, sonra A; skor sırasıyla.
  //
  // ⚠ Bu sorgu 921K satırda grade filtresi + grade_score sıralaması yapıyor.
  // Veritabanı ağır yazma altındayken (geo turu / hasat) statement timeout
  // veriyordu ve TÜM sayfa 500'e düşüyordu — huni ve matris hazır olmasına
  // rağmen ekran boş kalıyordu. Artık kart hatası sayfayı düşürmez: sayılar
  // gösterilir, kart bölümü kendi durumunu dürüstçe söyler.
  type Kart = Record<string, unknown> & { state?: unknown; county?: unknown; region?: unknown };
  let cards: Kart[] = [];
  let kartHatasi: string | null = null;
  let kartKaynagi: "canli" | "snapshot" = "canli";
  {
    const { data, error } = await s
      .from("offmarket_leads")
      .select(CARD_COLS)
      .in("grade", ["A+", "A"])
      .order("grade_score", { ascending: false })
      .limit(30);
    if (error) {
      kartHatasi = error.message;
      // Canlı sorgu düştü → snapshot kartlarına düş. Sayfanın görsel kısmı
      // boş kalmasın; kaynak ekranda dürüstçe belirtilir.
      const yedek = (SNAP as unknown as { cards?: Kart[] }).cards;
      if (yedek?.length) {
        cards = yedek;
        kartKaynagi = "snapshot";
      }
    } else cards = (data ?? []) as Kart[];
  }

  // 3) Pazar kanıtı: rakip aynı county'de ilan taşıyor mu (323 satır — lokal hesap).
  const comp = await s.from("competitor_listings").select("competitor, state, county, price, acres");
  const byCounty = new Map<string, { n: number; ppas: number[]; names: Set<string> }>();
  for (const r of comp.data ?? []) {
    const st = normSt(r.state);
    if (!st) continue;
    const key = `${st}|${normC(r.county)}`;
    let e = byCounty.get(key);
    if (!e) byCounty.set(key, (e = { n: 0, ppas: [], names: new Set() }));
    e.n++;
    if (r.competitor) e.names.add(r.competitor);
    const a = Number(r.acres);
    if (Number(r.price) > 0 && a > 0) e.ppas.push(Number(r.price) / a);
  }
  const withComp = (cards ?? []).map((c) => {
    const key = `${String(c.state).toUpperCase()}|${String(c.state).toUpperCase() === "AZ" ? "MOHAVE" : normC(c.county ?? c.region)}`;
    const e = byCounty.get(key);
    return {
      ...c,
      comp: e
        ? { n: e.n, competitors: [...e.names], medPpa: e.ppas.length >= 2 ? Math.round(median(e.ppas)!) : null }
        : null,
    };
  });

  return NextResponse.json({ schemaReady: true, funnel, matrix, cards: withComp, matrisKaynagi, snapshotAni, kartHatasi, kartKaynagi });
}
