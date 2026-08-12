import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { OFFMARKET_STATES, OFFMARKET_STATE_META } from "@/lib/offmarket-stats";
// Canlı head-count zaman aşımına uğrarsa düşülecek gerçek sayılar
// (scraper/build-not-matrisi.mjs üretir; eyalet × not kırılımı).
import notMatrisi from "@/data/not-matrisi.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// OFF-MARKET BREAKDOWN — TEK GERÇEK KAYNAK (single source of truth).
// offmarket_leads tablosunun CANLI head-count'ları: toplam + eyalet kırılımı
// (aktif eyalet listesi lib/offmarket-stats.ts'ten gelir — burada kopya YOK).
// Tüm owner-facing ekranlar (Operasyon Özeti · Ulusal Fırsatlar · Eyalet
// Haritası · Portföy) bu uçtan beslenir → rakamlar HER YERDE tutarlı, bayatlamaz.
// Sadece okur; değerleme/fiyat mantığına dokunmaz. Eksik tabloda çökmez.
// ─────────────────────────────────────────────────────────────────────────────

// Hedef eyaletler — harita renkleri/etiketleriyle birebir (tek kaynaktan türetilir).
const STATES = OFFMARKET_STATES.map((code) => {
  const m = OFFMARKET_STATE_META[code];
  return { code: m.code as string, label: m.label, region: m.region, color: m.color };
});

function isMissing(msg?: string): boolean {
  return /schema cache|does not exist|could not find|relation|column/i.test(msg ?? "");
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const s = supabaseAdmin();

    // ── ÖNCE ÖZET TABLO (2026-08-12) ─────────────────────────────────────────
    // Aşağıdaki yol 44 paralel `count: exact` head-count atıyor; bunlardan biri
    // FİLTRESİZ toplam ve 1,27M satırda tam tarama demek. Ölçüldü: uç 16,7 sn
    // sürüyordu ve "Bugün" ekranının ilk kartı o kadar süre dönüyordu — yani
    // sunumun açılış ekranı boş başlıyordu. `offmarket_grade_summary` aynı
    // sayıları eyalet kırılımında tutuyor (notlandırma turu her gece yazar),
    // 40 küsur satır: 16,7 sn -> ~0,2 sn. Huni ve A+ vitrini de aynı kaynağı
    // okuduğu için üç ekranın rakamı artık BİREBİR aynı.
    {
      const ozet = await s.from("offmarket_grade_summary").select("state,n");
      const satirlar = (ozet.data ?? []) as { state: string; n: number }[];
      if (!ozet.error && satirlar.length) {
        const sayim = new Map<string, number>();
        for (const r of satirlar) {
          if (!r?.state) continue;
          sayim.set(r.state, (sayim.get(r.state) ?? 0) + (Number(r.n) || 0));
        }
        // VERİSİ OLMAYAN eyalet listeye girmez: `byState.length` ekranlarda
        // "kaç eyalette varız" olarak kullanılıyor, sıfırlar sayılırsa 43 yerine
        // 48 der ve ağızdan çıkan rakamla çelişirdi.
        const byState = STATES.map((st) => ({
          state: st.code, label: st.label, region: st.region, color: st.color,
          count: sayim.get(st.code) ?? 0,
        }))
          .filter((x) => x.count > 0)
          .sort((a, b) => b.count - a.count);
        // Toplam, özetin TAMAMIDIR — STATES listesinde olmayan eyalet de sayılır,
        // yoksa "43 eyalet" derken toplamdan eyalet düşerdi.
        const total = [...sayim.values()].reduce((t, n) => t + n, 0);
        return NextResponse.json({
          total, byState, states: byState.length,
          tahminiEyaletler: [], olcumTam: true, kaynak: "ozet",
        });
      }
    }

    // Toplam (state filtresiz) + eyalet başına head-count paralel.
    const totalP = s.from("offmarket_leads").select("state", { count: "exact", head: true });
    const stateP = STATES.map((st) =>
      s.from("offmarket_leads").select("state", { count: "exact", head: true }).eq("state", st.code)
    );
    const [totalRes, ...stateRes] = await Promise.all([totalP, ...stateP]);

    if (totalRes.error && isMissing(totalRes.error.message)) {
      return NextResponse.json(
        { total: null, byState: [], note: "offmarket_leads tablosu yok." },
        { status: 200 }
      );
    }

    // ── SIFIR GÖSTERME HATASI (2026-08-03 düzeltildi) ────────────────────────
    // Eskiden `count: stateRes[i]?.count ?? 0` yazıyordu. Head-count sorgusu
    // HATA alınca (veritabanı ağır yazma altında → statement timeout) count
    // null geliyor ve ekrana "CO 0", "TX 0" diye yazılıyordu. Yani ölçülemeyen
    // değer YOK gibi gösteriliyordu; başlıktaki toplam da 920.492'den
    // 165.663'e düşüyordu. Ölçülemeyen sayı, sıfır DEĞİLDİR.
    //
    // Artık başarısız eyalet için sırayla: not-matrisi snapshot'ı → sabit
    // fallback. Hangi eyaletin ölçülemediği `tahminiEyaletler`de bildirilir.
    const snapshotSayim = new Map<string, number>();
    for (const r of (notMatrisi as { matrix?: { state: string; n: number }[] }).matrix ?? []) {
      snapshotSayim.set(r.state, (snapshotSayim.get(r.state) ?? 0) + r.n);
    }

    // ── CANLI YEDEK: özet tablo (2026-08-12) ─────────────────────────────────
    // Head-count 1,27M satırda düzenli olarak zaman aşımına düşüyor ve akış
    // sabit `fallbackCount`lara kadar iniyordu. O sabitlerin bir kısmı LEAD
    // sayısı değil ERİŞİLEBİLİR PARSEL HAVUZU rakamıydı (WI 1.124.060 yazıyordu,
    // gerçek lead 32.071) → ekran toplamı 2.102.620 gösteriyordu, gerçek
    // 1.272.766. Notlandırma turunun her gece yazdığı `offmarket_grade_summary`
    // 40 küsur satır; tek ucuz sorguyla okunur ve GÜNCELDİR. Sabitlere düşmeden
    // önce buraya bakılır.
    const ozetSayim = new Map<string, number>();
    try {
      const ozet = await s.from("offmarket_grade_summary").select("state,n");
      for (const r of (ozet.data ?? []) as { state: string; n: number }[]) {
        if (!r?.state) continue;
        ozetSayim.set(r.state, (ozetSayim.get(r.state) ?? 0) + (Number(r.n) || 0));
      }
    } catch {
      /* özet de okunamadıysa eski sıraya düşülür */
    }

    const tahminiEyaletler: string[] = [];
    const byState = STATES.map((st, i) => {
      const canli = stateRes[i]?.count;
      let count = canli ?? null;
      if (count == null) {
        // Sıra: canlı özet tablo (güncel) → not matrisi snapshot'ı → sabit.
        count =
          ozetSayim.get(st.code) ??
          snapshotSayim.get(st.code) ??
          OFFMARKET_STATE_META[st.code as keyof typeof OFFMARKET_STATE_META]?.fallbackCount ??
          0;
        // Özet tablodan geldiyse bu bir TAHMİN değil, ölçülmüş sayının
        // gece yazılmış kopyasıdır — kullanıcıya "tahmini" diye işaretlenmez.
        if (!ozetSayim.has(st.code)) tahminiEyaletler.push(st.code);
      }
      return { state: st.code, label: st.label, region: st.region, color: st.color, count };
    }).sort((a, b) => b.count - a.count);

    // Toplam da aynı mantık: canlı toplam gelmediyse eyaletlerden türet.
    const total = totalRes.count ?? byState.reduce((s, x) => s + x.count, 0);

    return NextResponse.json({
      total,
      byState,
      states: byState.length,
      tahminiEyaletler,
      olcumTam: tahminiEyaletler.length === 0,
    });
  } catch (e) {
    return NextResponse.json(
      { total: null, byState: [], note: e instanceof Error ? e.message : "offmarket-breakdown failed" },
      { status: 200 }
    );
  }
}
