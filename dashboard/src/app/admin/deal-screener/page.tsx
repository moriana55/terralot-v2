import { redirect } from "next/navigation";

// Bu ekran emekliye ayrıldı: gövdesi /admin/acquisitions altındaki "Ele" ve
// "Bölge" sekmelerine taşındı (acquisitions/sekme-ele.tsx · sekme-bolge.tsx).
// Route silinmez — eski link ve yer imleri çalışmaya devam etsin diye
// mevcut `?state=` / `?q=` / `?src=` parametreleri korunarak yönlendirilir.
// `?mode=counties` ile gelen eski bağlantılar "Bölge" sekmesine düşer.
export default async function DealScreenerYonlendirme({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tek = (k: string): string | null => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s ? s : null;
  };

  const params = new URLSearchParams();
  params.set("sekme", tek("mode") === "counties" ? "bolge" : "ele");
  for (const anahtar of ["q", "state", "src"]) {
    const deger = tek(anahtar);
    if (deger) params.set(anahtar, deger);
  }

  redirect(`/admin/acquisitions?${params.toString()}`);
}
