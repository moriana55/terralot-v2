import { NextRequest, NextResponse } from "next/server";
import snapshot from "@/data/istihbarat-snapshot.json";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/istihbarat — 2026-07-26'da kurulan veri katmanının tek ucu:
//   • county_valuation  → GERÇEK satışlardan türetilmiş county değerlemesi
//   • parcel_owners     → rakip sayımı (kim, kaç parsel, kaça almış)
//   • land_comps        → ham satış havuzu (sayım)
//   • offmarket_leads   → yeni teklif motorunun ürettiği fiyatlar
// Salt-okunur. Tablo yoksa o blok boş döner, ekran çökmez.

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();

  // ── 1) Değerleme: yatırıma uygun (T1/T2) county'ler
  const degerleme = await safe(async () => {
    const { data } = await s
      .from("county_valuation")
      .select("state,county_key,n_used,med_ppa,p25_ppa,med_sale,med_acres,tier")
      .eq("state", "FL")   // CO comp'ları toplandı ama envanterimizin olduğu
      // Costilla kapsam dışı + sent/dolar ölçek belirsizliği var → sunuma girmez.
      .in("tier", ["T1", "T2"])
      .order("n_used", { ascending: false })
      .limit(60);
    return (data ?? []) as Row[];
  }, [] as Row[]);

  // ── 2) Rakipler: ağır gruplama scraper/rakip-derin-analiz.mjs --write ile
  // önceden hesaplanıp competitor_profile'a yazılır; burada hafif okunur.
  const rakipler = await safe(async () => {
    const { data } = await s
      .from("competitor_profile")
      .select("owner,tip,parsel,county_n,countyler,nitelikli_alim,med_alim,med_ppa,son2yil_alim,owner_city,owner_state")
      .order("parsel", { ascending: false })
      .limit(400);
    return (data ?? []) as Row[];
  }, [] as Row[]);

  // Rakip tip sayıları: listeden türetmek YANLIŞ olur (liste en büyük 400 ile
  // sınırlı; "63 yatırımcı" görünüyordu, gerçek 198). Tam sayım ayrı sorgu.
  const rakipSayim = await safe(async () => {
    const [y, u] = await Promise.all([
      s.from("competitor_profile").select("owner", { count: "exact", head: true }).eq("tip", "arsa_yatirimcisi"),
      s.from("competitor_profile").select("owner", { count: "exact", head: true }).eq("tip", "uretici"),
    ]);
    return { yatirimci: y.count ?? 0, uretici: u.count ?? 0 };
  }, { yatirimci: 0, uretici: 0 });

  const aileler = await safe(async () => {
    const { data } = await s
      .from("competitor_family")
      .select("addr,sirket_n,parsel,sirketler")
      .order("parsel", { ascending: false })
      .limit(25);
    return (data ?? []) as Row[];
  }, [] as Row[]);

  // ── 3) Sayımlar
  const sayim = await safe(async () => {
    const [c1, c2, c3] = await Promise.all([
      s.from("land_comps").select("comp_id", { count: "exact", head: true }),
      s.from("parcel_owners").select("row_id", { count: "exact", head: true }),
      s.from("competitor_intel").select("listing_key", { count: "exact", head: true }),
    ]);
    return { comps: c1.count ?? 0, parseller: c2.count ?? 0, ilanlar: c3.count ?? 0 };
  }, { comps: 0, parseller: 0, ilanlar: 0 });

  // ── 4) Teklif motoru özeti (ağır hesap scraper/teklif-motoru.mjs'de)
  const teklifler = await safe(async () => {
    const { data } = await s
      .from("offer_summary")
      .select("county,bant,lead_n,comp_n,piyasa_p25,piyasa_med,carpan,teklif")
      .order("lead_n", { ascending: false })
      .limit(40);
    return (data ?? []) as Row[];
  }, [] as Row[]);

  // ── 5) Rakip ilan istihbaratı (DOM / satış şüphesi)
  const radar = await safe(async () => {
    const { data } = await s
      .from("competitor_intel")
      .select("competitor,status,gone_confidence,days_visible,price_changes")
      .limit(5000);
    const m = new Map<string, { competitor: string; aktif: number; gitti: number; dom: number[]; fiyatDegisen: number }>();
    for (const r of (data ?? []) as Row[]) {
      const c = String(r.competitor ?? "?");
      if (!m.has(c)) m.set(c, { competitor: c, aktif: 0, gitti: 0, dom: [], fiyatDegisen: 0 });
      const g = m.get(c)!;
      if (r.status === "AKTIF") g.aktif++; else { g.gitti++; const d = num(r.days_visible); if (d) g.dom.push(d); }
      if (Number(r.price_changes ?? 0) > 0) g.fiyatDegisen++;
    }
    const med = (a: number[]) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
    return [...m.values()].map((g) => ({
      competitor: g.competitor, aktif: g.aktif, gitti: g.gitti,
      med_dom: med(g.dom), fiyat_degisen: g.fiyatDegisen,
    })).sort((a, b) => b.aktif - a.aktif);
  }, [] as Row[]);

  // DB ERİŞİLEMEZ DURUMU (2026-07-27 disk limiti → 57P03 "not accepting
  // connections"): safe() her bloğu sessizce boşaltıyordu ve ekran BOŞ tablo
  // gösteriyordu — hata mesajından beter. Her şey boşsa son bilinen anlık
  // görüntüye düş ve bunu AÇIKÇA bayrakla (canlıymış gibi gösterme).
  const bosMu = sayim.comps === 0 && degerleme.length === 0 && rakipler.length === 0;
  if (bosMu) return NextResponse.json(snapshot);

  return NextResponse.json({ sayim, rakipSayim, degerleme, rakipler, aileler, teklifler, radar });
}
