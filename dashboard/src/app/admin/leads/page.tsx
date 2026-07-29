import { redirect } from "next/navigation";

// ── EMEKLİYE AYRILDI ─────────────────────────────────────────────────────────
// Talep hunisi tek tabloda birleşti (`parcel_inquiries`). Bu ekran eski
// Supabase `Inquiry` tablosunu okuyordu; artık halefi /admin/talepler.
// Route SİLİNMEZ (eski link/yer imi çalışsın) → yönlendirme.
// Eski ekranın kodu `_arsiv-ekran.tsx` olarak yanında duruyor (route değil).
export default function AdminLeadsEmekli() {
  redirect("/admin/talepler");
}
