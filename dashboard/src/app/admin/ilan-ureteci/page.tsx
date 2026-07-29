import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// EMEKLİ EKRAN — İlan Üreteci artık `admin/satis-sayfalari` içinde yaşıyor.
// Route silinmez (eski link/yer imi çalışsın): burası sadece yönlendirir.
// Ekranın eski gövdesi aynı klasörde `_arsiv-ekran.tsx` olarak duruyor.
// `?id=` (ve varsa arama/limit) korunarak taşınır → link paylaşan biri
// doğrudan aynı parselin ilan editörüne düşer.
// ─────────────────────────────────────────────────────────────────────────────

type SP = { id?: string; q?: string; n?: string };

export default async function IlanUreteciPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  if (sp.id) p.set("id", sp.id);
  if (sp.q) p.set("q", sp.q);
  if (sp.n) p.set("n", sp.n);
  const qs = p.toString();
  redirect(qs ? `/admin/satis-sayfalari?${qs}` : "/admin/satis-sayfalari");
}
