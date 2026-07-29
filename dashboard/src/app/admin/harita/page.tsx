// ─────────────────────────────────────────────────────────────────────────────
// /admin/harita — PROJEDEKİ TEK HARİTA EKRANI
//
// Dört ayrı harita sayfası burada birleşti. Hangi işin yapıldığını `?mod=`,
// ekranın panel içinde mi tam ekran mı durduğunu `?gorunum=` belirler:
//   ?mod=offmarket&gorunum=vitrin  → tam ekran off-market vitrini (varsayılan)
//   ?mod=offmarket&gorunum=panel   → panel içi analitik off-market görünümü
//   ?mod=anlasma                   → vergi-borçlu deal + ihale + megaproje
//   ?mod=alinabilir                → comp'lu alınabilir parseller (2D/3D)
//
// Sorgu parametreleri istemcide `useSearchParams()` ile okunur; bu yüzden gövde
// `harita-kabuk.tsx` içinde ve <Suspense> ile sarılıdır (Next 16 kuralı).
// ─────────────────────────────────────────────────────────────────────────────

import HaritaKabuk from "./harita-kabuk";

export default function AnaHaritaPage() {
  return <HaritaKabuk />;
}
