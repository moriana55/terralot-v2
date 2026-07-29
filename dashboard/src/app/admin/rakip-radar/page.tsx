import { Suspense } from "react";
import SekmeCubugu, { sekmeCoz } from "./sekme-cubugu";
import SekmeRadar from "./sekme-radar";
import SekmeManzara from "./sekme-manzara";
import SekmeDefter from "./sekme-defter";
import SekmeBolgeler from "./sekme-bolgeler";
import SekmeEkonomi from "./sekme-ekonomi";

// ─────────────────────────────────────────────────────────────────────────────
// RAKİP EKRANI — tek adres, 5 sekme (2026-07-29 birleştirme)
//
// Eskiden 5 ayrı sayfaydı; hepsi buraya taşındı, eski adresler redirect ediyor:
//   ?sekme=radar     (varsayılan) ← /admin/rakip-radar          (ilan yaşam döngüsü)
//   ?sekme=manzara                ← /admin/competitor-radar     (+ PropStream CSV importu)
//   ?sekme=defter                 ← /admin/rakip-defteri
//   ?sekme=bolgeler               ← /admin/rakip-istihbarat + /admin/pazar-ortusme
//   ?sekme=ekonomi                ← /admin/competitor-analysis
//
// PERFORMANS: bu bir SUNUCU bileşenidir ve SADECE aktif sekmenin gövdesini
// render eder. Pasif sekmelerin istemci bileşenleri hiç monte edilmez → 5 sekmenin
// fetch'i asla aynı anda koşmaz (her gövde veriyi kendi useEffect'inde çeker).
// ─────────────────────────────────────────────────────────────────────────────

export default async function RakipRadarPage({
  searchParams,
}: {
  // Next.js 16: searchParams bir Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const aktif = sekmeCoz(sp.sekme);

  return (
    <div>
      <SekmeCubugu aktif={aktif} />
      <Suspense
        key={aktif}
        fallback={<div className="p-8 text-sm" style={{ color: "var(--muted)" }}>Yükleniyor…</div>}
      >
        {aktif === "radar" && <SekmeRadar />}
        {aktif === "manzara" && <SekmeManzara />}
        {aktif === "defter" && <SekmeDefter />}
        {aktif === "bolgeler" && <SekmeBolgeler />}
        {aktif === "ekonomi" && <SekmeEkonomi />}
      </Suspense>
    </div>
  );
}
