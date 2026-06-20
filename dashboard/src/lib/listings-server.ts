import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { mapListing, type Property, type RawListing } from "@/lib/data";

// Sunucu tarafı (Server Component) ilan okuma — örn. land-for-sale/[state]
// SEO sayfaları. Tarayıcının fetch'ini kullanamadığı için doğrudan
// service-role ile RLS-korumalı `Property` tablosundan okur.
// "server-only" import'u bu modülün ASLA client bundle'a girmemesini garanti eder.

// paymentsReceived canlı Property tablosunda YOK (yalnızca Prisma şemasında).
// Seçersek sorgu hata verir; vitrin için gereksiz → listeden çıkarıldı.
const COLUMNS =
  "id,title,slug,state,county,acres,price,costPrice,downPayment,monthlyPayment,term,images,description,features,lat,lng,zoning,terrain,roadAccess,utilities,apn,status,featured,createdAt,monthlyExpenses,useCases,interestRate";

// Verilen eyaletteki yayında ilanları getirir. Env yoksa / Supabase boş veya
// erişilemezse boş dizi döner — sayfa çökmez, dürüst boş-durum gösterir.
export async function getPropertiesByStateServer(state: string): Promise<Property[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("Property")
      .select(COLUMNS)
      .neq("status", "DRAFT") // taslakları gizle
      .eq("state", state)
      .order("createdAt", { ascending: false });
    if (error) return [];
    // Eski uydurma seed kayıtlarını (kısa sayısal id) gizle — /api/listings ile
    // aynı davranış. DB'de korunur, yalnızca vitrinden çıkarılır.
    return ((data ?? []) as RawListing[])
      .filter((r) => !(r.id && /^\d{1,2}$/.test(r.id)))
      .map(mapListing);
  } catch {
    return [];
  }
}
