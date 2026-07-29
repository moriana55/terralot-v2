import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP EKRANI — SEKME ÇUBUĞU
//
// 5 ayrı rakip ekranı tek adreste toplandı: /admin/rakip-radar?sekme=…
// Sekme seçimi URL'de tutulur (link paylaşılabilir, geri tuşu çalışır).
// Sunucu bileşeni — sadece <Link>'ler, native <select> YOK.
// ─────────────────────────────────────────────────────────────────────────────

export const SEKMELER = [
  { anahtar: "radar", baslik: "Radar", ipucu: "İlan yaşam döngüsü, snapshot/diff, satış doğrulama" },
  { anahtar: "manzara", baslik: "Manzara", ipucu: "Rakip şu an ne satıyor + PropStream satış importu" },
  { anahtar: "defter", baslik: "Defter", ipucu: "Discount Lots parsel defteri (tapu vs ilan)" },
  { anahtar: "bolgeler", baslik: "Bölgeler", ipucu: "Rakip yoğunluğu + bizim envanter + spread" },
  { anahtar: "ekonomi", baslik: "Ekonomi", ipucu: "Taksit ekonomisi + arbitraj hesaplayıcı" },
] as const;

export type SekmeAnahtari = (typeof SEKMELER)[number]["anahtar"];

/** URL'den gelen ham `?sekme=` değerini bilinen bir sekmeye indirger. */
export function sekmeCoz(ham: string | string[] | undefined): SekmeAnahtari {
  const v = Array.isArray(ham) ? ham[0] : ham;
  const bulunan = SEKMELER.find((s) => s.anahtar === v);
  return bulunan ? bulunan.anahtar : "radar";
}

export default function SekmeCubugu({ aktif }: { aktif: SekmeAnahtari }) {
  return (
    <div className="px-8 pt-6">
      <nav
        className="flex items-center gap-1 flex-wrap border-b"
        style={{ borderColor: "var(--outline)" }}
        aria-label="Rakip ekranı sekmeleri"
      >
        {SEKMELER.map((s) => {
          const secili = s.anahtar === aktif;
          return (
            <Link
              key={s.anahtar}
              href={`/admin/rakip-radar?sekme=${s.anahtar}`}
              title={s.ipucu}
              aria-current={secili ? "page" : undefined}
              className="px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
              style={{
                borderColor: secili ? "var(--accent-ink)" : "transparent",
                color: secili ? "var(--accent-ink)" : "var(--muted)",
              }}
            >
              {s.baslik}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
