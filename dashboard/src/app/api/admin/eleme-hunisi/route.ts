import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import {
  birikimOzeti,
  kapsamOzeti,
  EYALET_KATMANLARI,
  EYALET_KATMANLARI_TOPLAM,
  type BirikimDosyasi,
} from "@/lib/eleme-hunisi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// ELEME HUNİSİ — "milyonlarca parselden bir avuç deal'e" ekranının veri ucu.
//
// ÜÇ AYRI ÖLÇÜ, ÜÇ AYRI KAYNAK — ve bunlar BİRBİRİNE KARIŞTIRILMAZ:
//
//   erisim    ERİŞİLEBİLİR — sorgulayabildiğimiz havuz.
//             Kaynak: public/kapsam-olcum.json (scripts/kapsam-olc.mjs, her
//             county'ye gerçek sorgu atar) + eyalet geneli katman kayıtları.
//             ⚠ Bu "taranmış" DEĞİL. Hiçbir yerde incelenen ile toplanmaz.
//
//   is        İNCELENEN → UYGUN — motorun gerçekten yaptığı iş, BİRİKİMLİ.
//             Kaynak: public/hasat-birikim.json (scraper/birikim-guncelle.mjs
//             her hasat turunda filtreli-hasat loglarından günceller).
//
//   havuz     KAYITLI → MEKTUP ATILABİLİR → A+/A — canlı DB head-count'ları.
//             Kaynak: Supabase offmarket_leads (bu istekte O AN sayılır).
//
// Dosya/DB yoksa ilgili blok null/0 + `hata` notu döner; TAHMİN ÜRETİLMEZ.
// ─────────────────────────────────────────────────────────────────────────────

/** Mektup atılabilirliğin tanımı — TEK yerde. */
const MEKTUP_ALANLARI = ["owner", "mailing_address", "mailing_city", "mailing_state", "mailing_zip"] as const;

/** Yapısal arayüz: supabase-js'in tam builder tipi zincirlendikçe TS'i patlatıyor. */
interface Filtrelenebilir {
  not(sutun: string, op: string, deger: unknown): Filtrelenebilir;
  neq(sutun: string, deger: string): Filtrelenebilir;
}

/** Mektup atılabilir = beş posta alanının BEŞİ de dolu (boş string de eksik sayılır). */
function mektupFiltresi<T>(q: T): T {
  let x = q as unknown as Filtrelenebilir;
  for (const c of MEKTUP_ALANLARI) x = x.not(c, "is", null).neq(c, "");
  return x as unknown as T;
}

async function jsonOku<T>(...parcalar: string[]): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), ...parcalar), "utf8")) as T;
  } catch {
    return null; // dosya yok → çağıran boş durumu gösterir
  }
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  // ── 1) Dosya kaynakları (erişim + birikimli iş) ───────────────────────────
  const [kapsamHam, birikimHam] = await Promise.all([
    jsonOku<{ olcumZamani?: string; sonuclar?: { state?: string; durum?: string; toplamParsel?: number | null }[] }>(
      "public",
      "kapsam-olcum.json"
    ),
    jsonOku<BirikimDosyasi>("public", "hasat-birikim.json"),
  ]);

  const kapsam = kapsamOzeti(kapsamHam);
  const birikim = birikimOzeti(birikimHam);

  // ── 2) Canlı DB ───────────────────────────────────────────────────────────
  let kayitli: number | null = null;
  let eyaletSayisi: number | null = null;
  let mektupAtilabilir: number | null = null;
  let yatirimaUygun: number | null = null;
  let geoBekleyen: number | null = null;
  let geoDogrulanmis: number | null = null;
  let dealler: { state: string; adet: number }[] = [];
  let canliHata: string | null = null;

  try {
    const s = supabaseAdmin();
    const tablo = () => s.from("offmarket_leads").select("state", { count: "exact", head: true });

    // Eyalet listesi özet tablodan gelir (585K üstünde canlı GROUP BY yavaş).
    const matris = await s.rpc("offmarket_grade_matrix");
    if (matris.error) throw new Error(matris.error.message);
    type MxRow = { state: string; grade: string | null; n: number; geo_n: number };
    const mx = (matris.data ?? []) as MxRow[];
    const eyaletKodlari = [...new Set(mx.map((r) => r.state).filter(Boolean))];
    const notluEyaletler = [
      ...new Set(mx.filter((r) => r.grade === "A+" || r.grade === "A").map((r) => r.state)),
    ];

    const [toplamRes, mektupRes, geoNullRes, ...dealRes] = await Promise.all([
      tablo(),
      mektupFiltresi(tablo()),
      tablo().is("geo_enriched_at", null),
      ...notluEyaletler.map((st) => mektupFiltresi(tablo().in("grade", ["A+", "A"])).eq("state", st)),
    ]);

    kayitli = toplamRes.count ?? null;
    eyaletSayisi = eyaletKodlari.length || null;
    mektupAtilabilir = mektupRes.count ?? null;
    geoBekleyen = geoNullRes.count ?? null;
    geoDogrulanmis = kayitli != null && geoBekleyen != null ? kayitli - geoBekleyen : null;

    dealler = notluEyaletler
      .map((state, i) => ({ state, adet: dealRes[i]?.count ?? 0 }))
      .filter((d) => d.adet > 0)
      .sort((a, b) => b.adet - a.adet);
    yatirimaUygun = dealler.reduce((s0, d) => s0 + d.adet, 0);
  } catch (e) {
    // Canlı sorgu düşerse sayılar null kalır — 0 UYDURULMAZ, UI "—" gösterir.
    canliHata = e instanceof Error ? e.message : "canlı sorgu başarısız";
  }

  return NextResponse.json({
    erisim: {
      kapsam,
      katmanlar: EYALET_KATMANLARI,
      katmanToplam: EYALET_KATMANLARI_TOPLAM,
      // FL kapsam ölçümünde atlanıyor (hasadı bitti) — dipnot olarak gösterilir.
      dipnot:
        "Kapsam ölçümü çalışan county'leri tek tek sorgular; Florida ölçüme dahil " +
        "edilmez (hasadı tamamlandı, kayıtları DB'de). Eyalet geneli katmanlar " +
        "servisin toplam kayıt sayısıdır — taranmış parsel değildir.",
    },
    is: birikim,
    havuz: {
      kayitli,
      eyaletSayisi,
      mektupAtilabilir,
      yatirimaUygun,
      dealler,
      geoBekleyen,
      geoDogrulanmis,
      hata: canliHata,
    },
    olculmeZamani: new Date().toISOString(),
  });
}
