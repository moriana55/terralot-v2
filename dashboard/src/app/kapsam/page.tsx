import KAYNAKLAR from "@/data/ulusal-kaynaklar.json";
import { Database, CheckCircle2, AlertTriangle, Globe } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ULUSAL VERİ KAPSAMI — "nasıl taradınız?" sorusunun ekrandaki cevabı.
//
// Bu sayfadaki parsel sayıları KAYITLI DEĞİL. Sayfa her açıldığında (en fazla
// 10 dakikada bir) eyaletlerin resmî GIS sunucularına canlı `returnCountOnly`
// sorgusu atılır ve dönen cevap yazılır. Yanıt vermeyen kaynak "ulaşılamadı"
// olarak gösterilir — sıfır yazılmaz, gizlenmez.
//
// Amaç: müşteriye tabloyu gösterirken "bu sayılar nereden?" denince cevabın
// sayfanın kendisi olması. Her satır tıklanabilir; doğrudan kaynağın REST
// ucuna gider, isteyen kendi tarayıcısında doğrular.
// ─────────────────────────────────────────────────────────────────────────────

export const revalidate = 600;

type Kaynak = {
  eyalet: string;
  ad: string;
  url: string;
  parsel: number | null;
  posta: boolean;
  durum?: string;
  not?: string;
};

type Olcum = Kaynak & { canli: number | null; ms: number | null };

const DURUM_ETIKET: Record<string, { yazi: string; ton: "iyi" | "orta" | "kotu" }> = {
  hazir: { yazi: "sahip adı + posta adresi", ton: "iyi" },
  "sahip-adi-yok": { yazi: "posta var, sahip adı yok", ton: "orta" },
  "posta-yok": { yazi: "sahip var, posta adresi yok", ton: "orta" },
  "yanlis-pozitif": { yazi: "kullanılabilir alan yok", ton: "kotu" },
};

async function olc(k: Kaynak): Promise<Olcum> {
  const t0 = Date.now();
  try {
    const r = await fetch(`${k.url}/query?where=1%3D1&returnCountOnly=true&f=json`, {
      headers: { "User-Agent": "VegaLand/1.0" },
      signal: AbortSignal.timeout(20_000),
      next: { revalidate: 600 },
    });
    const j = await r.json();
    return { ...k, canli: typeof j.count === "number" ? j.count : null, ms: Date.now() - t0 };
  } catch {
    return { ...k, canli: null, ms: null };
  }
}

const bin = (n: number) => n.toLocaleString("tr-TR");

export default async function KapsamPage() {
  const kaynaklar = Object.entries(KAYNAKLAR as Record<string, unknown>)
    .filter(([k]) => !k.startsWith("_"))
    .map(([, v]) => v as Kaynak)
    .filter((k) => k.durum !== "yanlis-pozitif");

  const olcumler = await Promise.all(kaynaklar.map(olc));
  olcumler.sort((a, b) => (b.canli ?? -1) - (a.canli ?? -1));

  const canliSayi = olcumler.filter((o) => o.canli != null).length;
  const toplam = olcumler.reduce((a, o) => a + (o.canli ?? 0), 0);
  const kampanyaHazir = olcumler.filter((o) => (o.durum ?? "hazir") === "hazir");
  const kampanyaToplam = kampanyaHazir.reduce((a, o) => a + (o.canli ?? 0), 0);

  return (
    <main className="px-6 py-10 max-w-5xl mx-auto" style={{ background: "var(--surface)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5" style={{ color: "var(--primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
          Ulusal Veri Kapsamı
        </h1>
      </div>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--muted)" }}>
        Aşağıdaki parsel sayıları kayıtlı değil — bu sayfa her açıldığında eyaletlerin
        resmî GIS sunucularına canlı sorgu atılır ve dönen cevap yazılır. Kaynakların
        hepsi ücretsiz ve anahtarsızdır; satırdaki bağlantıya tıklayıp kendiniz
        doğrulayabilirsiniz.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Kutu baslik="Canlı kaynak" deger={`${canliSayi} / ${olcumler.length}`} alt="eyalet geneli servis" />
        <Kutu baslik="Erişilebilir parsel" deger={bin(toplam)} alt="şu an sorgulandı" vurgu />
        <Kutu
          baslik="Kampanyaya hazır"
          deger={bin(kampanyaToplam)}
          alt={`${kampanyaHazir.length} eyalette sahip adı + posta adresi`}
        />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--outline)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-high)" }}>
              <Th>Eyalet</Th>
              <Th>Kaynak</Th>
              <Th>İçerik</Th>
              <Th sag>Yanıt</Th>
              <Th sag>Parsel</Th>
            </tr>
          </thead>
          <tbody>
            {olcumler.map((o) => {
              const d = DURUM_ETIKET[o.durum ?? "hazir"] ?? DURUM_ETIKET.hazir;
              return (
                <tr key={o.eyalet} style={{ borderTop: "1px solid var(--outline)" }}>
                  <td className="px-3 py-2 font-bold" style={{ color: "var(--primary)" }}>
                    {o.eyalet}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                      style={{ color: "var(--primary-dim)" }}
                    >
                      {o.ad}
                    </a>
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {d.ton === "iyi" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#1a7f37" }} />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#9a6700" }} />
                      )}
                      {d.yazi}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                    {o.ms != null ? `${o.ms} ms` : "ulaşılamadı"}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                    {o.canli != null ? bin(o.canli) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
        <Database className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          &quot;Kampanyaya hazır&quot; = katmanda hem sahip adı hem sahibin posta adresi var,
          yani parsel doğrudan mektup/SMS kampanyasına girebilir. Diğerlerinde eksik alan
          skip-trace ile tamamlanır. Ulaşılamayan kaynak sıfır sayılmaz — sunucu o an
          yanıt vermemiştir, sayfayı yenileyince tekrar denenir.
        </p>
      </div>
    </main>
  );
}

function Kutu({
  baslik,
  deger,
  alt,
  vurgu,
}: {
  baslik: string;
  deger: string;
  alt: string;
  vurgu?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: vurgu ? "var(--surface-high)" : "var(--surface-low)",
        borderColor: "var(--outline)",
      }}
    >
      <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
        {baslik}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--primary)" }}>
        {deger}
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
        {alt}
      </div>
    </div>
  );
}

function Th({ children, sag }: { children: React.ReactNode; sag?: boolean }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-bold ${sag ? "text-right" : "text-left"}`}
      style={{ color: "var(--muted)" }}
    >
      {children}
    </th>
  );
}
