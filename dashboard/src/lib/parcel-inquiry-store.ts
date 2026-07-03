// Shared in-memory fallback buffer for /p/[id] buyer inquiries.
//
// Primary storage is the Supabase `parcel_inquiries` table (see
// sql/parcel_inquiries.sql — owner runs it once in the SQL editor). Until the
// table exists (or if an insert fails), inquiries land here so the public form
// NEVER silently drops a lead. The buffer is process-local (lost on restart /
// not shared across serverless instances) → the admin UI labels these rows
// "geçici" and the API response tells the page to also surface the WhatsApp /
// email fallback buttons prominently.
//
// Lives in a lib module (not inside a route file) so both the public POST
// route and the gated admin list route read the SAME buffer.

export interface ParcelInquiry {
  id: string;
  parcel_id: string;
  parcel_title: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
  /** true → sadece bellekte (Supabase insert başarısız); admin UI "geçici" gösterir. */
  volatile?: boolean;
}

const MAX_BUFFER = 500; // hard cap so a spam burst can't grow memory unbounded

const buffer: ParcelInquiry[] = [];

export function pushFallbackInquiry(q: ParcelInquiry) {
  buffer.push({ ...q, volatile: true });
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
}

export function fallbackInquiries(): ParcelInquiry[] {
  return [...buffer].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
