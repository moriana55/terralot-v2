import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase";
import ulusalKaynaklar from "@/data/ulusal-kaynaklar.json";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import {
  birikimOzeti,
  kapsamOzeti,
  erisilebilirKatmanlar,
  katmanToplami,
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
  // Erişilebilir eyalet katmanları: 4 Ağustos'ta canlı doğrulanmış ulusal kayıt
  // + o kayıtta olmayan elle yazılmış katmanlar (WV).
  const katmanlar = erisilebilirKatmanlar(ulusalKaynaklar as Record<string, unknown>);
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

    // Toplam ve geo sayıları AYRI SORGU İSTEMEZ: matris zaten eyalet × not
    // kırılımında n (satır) ve geo_n (koordinatı çözülmüş) taşıyor.
    //
    // Önceden bunlar filtresiz `count:"exact"` ile sayılıyordu. 1,25 milyon
    // satırda o sayım zaman aşımına düşüyor, üç değer birden null kalıyor ve
    // huni ekranı ana rakamlarını "—" gösteriyordu — yani sunumda "kaç parsel
    // taradık" sorusunun cevabı boştu. Toplama artık burada yapılıyor: sorgu
    // yok, zaman aşımı yok, üstelik ekrandaki eyalet sayısıyla aynı kaynak.
    kayitli = mx.reduce((t, r) => t + r.n, 0) || null;
    geoDogrulanmis = mx.reduce((t, r) => t + r.geo_n, 0) || null;
    geoBekleyen = kayitli != null && geoDogrulanmis != null ? kayitli - geoDogrulanmis : null;
    eyaletSayisi = eyaletKodlari.length || null;

    // Tüm envanterin mektup atılabilirliği BİLEREK sorulmuyor.
    //
    // Beş alanlı bu filtrenin indeksi yok; 1,25M satırda tam tarama ~11 sn ve
    // PostgREST üstünde zaten zaman aşımına düşüyordu (değer hep null'dı, yani
    // ekranda kimse doğru sayıyı hiç görmedi). Filtreye özel kısmi dizin de
    // denendi: planlayıcı dizin taramasını seçip süreyi 41 sn'ye ÇIKARDI —
    // dizin kaldırıldı.
    //
    // Asıl sebep: temas kanalı mektup değil SMS. Anlamlı ölçü sahibin posta
    // adresi değil TELEFONU ve o sayı şu an sıfır (skip trace hiç koşmadı).
    // Bu adım, telefon alanı dolmaya başladığında telefon üstünden yeniden
    // kurulacak. O zamana kadar null → UI "—" gösterir, 0 uydurmaz.
    mektupAtilabilir = null;

    // A+/A dağılımı da matristen. Önceden eyalet başına ayrı sayım sorgusu
    // atılıyordu ve `?? 0` ile düşen sorgu SESSİZCE SIFIR sayılıyordu: aynı
    // ekran arka arkaya 29.425 ve 38.244 gösterebiliyordu — hangisinin doğru
    // olduğu belli değildi, ikisi de değildi. Üstelik bu sayım "A+/A ve mektup
    // atılabilir" demekti, dolayısıyla Arsa Notları ve Rakip Haritası'ndaki
    // A+/A rakamıyla çelişiyordu. Artık tek kaynak: matris.
    dealler = Object.entries(
      mx.reduce<Record<string, number>>((acc, r) => {
        if ((r.grade === "A+" || r.grade === "A") && r.state) acc[r.state] = (acc[r.state] ?? 0) + r.n;
        return acc;
      }, {}),
    )
      .map(([state, adet]) => ({ state, adet }))
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
      katmanlar,
      katmanToplam: katmanToplami(katmanlar),
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
