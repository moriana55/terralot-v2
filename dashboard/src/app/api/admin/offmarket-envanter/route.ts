import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { scoreAllRowsBreakdown, type ScoreRow } from "@/lib/offmarket-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// TEK OFF-MARKET ENVANTERİ (ADIM 1) — TEK GERÇEK KAYNAK: `offmarket_leads`.
//
// Eskiden her county'nin kendi statik-JSON ekranı vardı (`/admin/mohave`,
// `/admin/luna`). Artık TEK ekran var ve o ekran DOĞRUDAN VERİTABANINI okur.
// Statik JSON'lar silinmedi; ama kanıtlandı ki içlerindeki 345.969 satırın
// TAMAMI zaten bu tabloda (bkz. scripts/kayip-veri-avi.mjs) — kayıp yok.
//
// İki tür istek:
//   ?ozet=1                → eyalet/county sayaçları (materyalize görünümden)
//   ?state=..&county=..    → o county'nin satırları, 0-100 skorla sıralanmış
//
// SKOR: lib/offmarket-score.ts — Mohave'ye özel motorun county'den bağımsız
// hale getirilmiş hâli. Mohave'nin bölge-talep katsayıları kaybolmadı, county
// bazlı ayar tablosunda duruyor.
//
// DÜRÜSTLÜK: skorun marj bileşeni "bölge medyanı"na göre hesaplanır; medyan
// çekilen satır kümesinden çıkarılır. County çok büyükse (ör. NM Valencia 69K)
// örnek tavanı uygulanır ve cevapta `kapsam` alanıyla AÇIKÇA bildirilir —
// ekran bunu kullanıcıya yazar. Uydurma sayı yok.
// Sadece okur; hiçbir satır yazmaz/silmez.
// ─────────────────────────────────────────────────────────────────────────────

/** Skorlanacak azami satır (bellek + süre freni). Aşılırsa cevapta bildirilir. */
const ORNEK_TAVANI = 20000;
/** Supabase tek istekte 1000 satır döndürür; sayfalama adımı. */
const SAYFA = 1000;
/** Ekrana dönen azami satır. */
const VARSAYILAN_LIMIT = 300;
const AZAMI_LIMIT = 2000;

type EnvanterSatiri = ScoreRow & {
  lead_id: string;
  apn: string | null;
  owner: string | null;
  situs: string | null;
  use: string | null;
  land_value: number | null;
  est_offer: number | null;
  est_retail: number | null;
  est_margin: number | null;
  absentee: boolean | null;
  lat: number | null;
  lng: number | null;
  grade: string | null;
  grade_score: number | null;
  source: string | null;
  county_normalized: string | null;
};

const SUTUNLAR =
  "lead_id,state,county,county_normalized,region,apn,owner,mailing_address,mailing_city," +
  "mailing_state,mailing_zip,situs,use,acres,land_value,est_offer,est_retail,est_margin," +
  "absentee,lat,lng,grade,grade_score,source";

function eksikTablo(msg?: string): boolean {
  return /schema cache|does not exist|could not find|relation/i.test(msg ?? "");
}

const sayi = (v: string | null, varsayilan: number, azami: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), azami) : varsayilan;
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const state = (sp.get("state") ?? "").trim().toUpperCase();
  const county = (sp.get("county") ?? "").trim();
  const q = (sp.get("q") ?? "").trim();
  const limit = sayi(sp.get("limit"), VARSAYILAN_LIMIT, AZAMI_LIMIT);
  const sadeceOzet = sp.get("ozet") === "1";

  const s = supabaseAdmin();

  // ── Her istekte eyalet/county kırılımı (açılır listeler + sayaçlar) ─────────
  const { data: ozetSatir, error: ozetHata } = await s
    .from("offmarket_envanter_ozet_mv")
    .select("state,county,lead_sayisi,koordinatli,postalanabilir,absentee,acre_bilinen,ort_acre,bolge_sayisi")
    .order("lead_sayisi", { ascending: false });

  if (ozetHata && eksikTablo(ozetHata.message)) {
    return NextResponse.json(
      {
        ozet: [], toplam: 0, satirlar: [],
        not: "offmarket_envanter_ozet_mv görünümü yok — önce sql/offmarket_envanter_ozet.sql uygula.",
      },
      { status: 200 }
    );
  }
  const ozet = ozetSatir ?? [];
  const toplam = ozet.reduce((t, x) => t + (x.lead_sayisi ?? 0), 0);

  if (sadeceOzet || !state) {
    return NextResponse.json({ ozet, toplam, satirlar: [], secim: { state: state || null, county: county || null } });
  }

  // ── Seçili eyalet/county'nin satırlarını çek (sayfalayarak) ────────────────
  const hedef = ozet.find((o) => o.state === state && (!county || o.county === county));
  const countyToplam = county
    ? (hedef?.lead_sayisi ?? 0)
    : ozet.filter((o) => o.state === state).reduce((t, x) => t + x.lead_sayisi, 0);

  const satirlar: EnvanterSatiri[] = [];
  let imlec = "";
  let hata: string | null = null;

  while (satirlar.length < ORNEK_TAVANI) {
    let sorgu = s.from("offmarket_leads").select(SUTUNLAR).eq("state", state);
    // Normalize sütun üzerinden filtrele — ham `county` AZ'de bölge adı taşıyor.
    if (county) sorgu = sorgu.eq("county_normalized", county);
    if (q) sorgu = sorgu.or(`owner.ilike.%${q}%,apn.ilike.%${q}%,situs.ilike.%${q}%`);
    if (imlec) sorgu = sorgu.gt("lead_id", imlec);
    const { data, error } = await sorgu.order("lead_id", { ascending: true }).limit(SAYFA);
    if (error) { hata = error.message; break; }
    const sayfa = (data ?? []) as unknown as EnvanterSatiri[];
    if (!sayfa.length) break;
    satirlar.push(...sayfa);
    imlec = sayfa[sayfa.length - 1].lead_id;
    if (sayfa.length < SAYFA) break;
  }

  // ── Skorla (marj bileşeni bu kümenin bölge medyanına göre) ─────────────────
  const baglam = { state, county: county || null };
  const skorlu = scoreAllRowsBreakdown(satirlar, baglam);
  skorlu.sort(
    (a, b) =>
      b.offmarket_score - a.offmarket_score ||
      String(a.apn ?? "").localeCompare(String(b.apn ?? ""))
  );

  // ── Sahibe göre grupla: aynı sahip+adres = tek mektupla çok parsel ─────────
  const sahipler = new Map<string, { owner: string; mail: string; adet: number; acres: number; landValue: number }>();
  for (const r of satirlar) {
    const anahtar = `${r.owner}|${r.mailing_address}|${r.mailing_city}|${r.mailing_state}`;
    let g = sahipler.get(anahtar);
    if (!g) {
      g = {
        owner: r.owner ?? "—",
        mail: [r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip].filter(Boolean).join(" "),
        adet: 0, acres: 0, landValue: 0,
      };
      sahipler.set(anahtar, g);
    }
    g.adet++; g.acres += r.acres ?? 0; g.landValue += r.land_value ?? 0;
  }
  const cokParselli = [...sahipler.values()].filter((g) => g.adet >= 2).sort((a, b) => b.adet - a.adet);

  // ── Bölge ve sahip-eyaleti dağılımı ────────────────────────────────────────
  const bolgeler: Record<string, number> = {};
  const sahipEyaleti: Record<string, number> = {};
  for (const r of satirlar) {
    if (r.region) bolgeler[r.region] = (bolgeler[r.region] ?? 0) + 1;
    if (r.mailing_state) sahipEyaleti[r.mailing_state] = (sahipEyaleti[r.mailing_state] ?? 0) + 1;
  }

  return NextResponse.json({
    ozet,
    toplam,
    secim: { state, county: county || null, q: q || null },
    // DÜRÜSTLÜK: skorun neyin üzerinden hesaplandığı açıkça bildirilir.
    kapsam: {
      countyToplam,
      cekilen: satirlar.length,
      tamKapsam: satirlar.length >= countyToplam || satirlar.length < ORNEK_TAVANI,
      ornekTavani: ORNEK_TAVANI,
    },
    istatistik: {
      postalanabilir: satirlar.filter((r) => r.mailing_address).length,
      koordinatli: satirlar.filter((r) => r.lat != null && r.lng != null).length,
      absentee: satirlar.filter((r) => r.absentee).length,
      ortAcre: satirlar.length
        ? Number((satirlar.reduce((t, r) => t + (r.acres ?? 0), 0) / satirlar.length).toFixed(2))
        : 0,
      cokParselliSahip: cokParselli.length,
      cokParselliParsel: cokParselli.reduce((t, g) => t + g.adet, 0),
      bolgeler: Object.entries(bolgeler).sort((a, b) => b[1] - a[1]),
      sahipEyaleti: Object.entries(sahipEyaleti).sort((a, b) => b[1] - a[1]).slice(0, 10),
    },
    cokParselli: cokParselli.slice(0, 80),
    satirlar: skorlu.slice(0, limit),
    hata,
  });
}
