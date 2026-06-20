import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public vitrin (storefront) ilan kaynağı.
//
// Gerçek satılık ilanlar Supabase'deki `Property` tablosunda tutuluyor (Prisma
// modeli, admin /api/admin/property üzerinden yönetiliyor). Bu tablo RLS ile
// korunduğu için tarayıcının anon client'ı 0 satır döner; bu yüzden okuma
// service-role ile sunucu tarafında yapılır.
//
// Bu route PUBLIC'tir (gate yok) — sadece rate-limit uygulanır ve YALNIZCA
// yayında/satışa uygun ilanlar (status != DRAFT) döner. DRAFT taslaklar ve
// tax_delinquent_properties gibi ham acquisition lead'leri ASLA buraya sızmaz.

// Vitrinin (lib/data.ts > Property) ihtiyaç duyduğu tüm kolonlar. Bu kolonların
// hepsi `Property` tablosunda mevcut (admin analytics view'ı da kullanır).
// NOT: paymentsReceived kolonu canlı Supabase Property tablosunda YOK (yalnızca
// Prisma şemasında tanımlı). Seçersek "column does not exist" hatası → vitrin
// boş döner. Bu yüzden listeden çıkarıldı; vitrin bu alana ihtiyaç duymaz.
const COLUMNS =
  "id,title,slug,state,county,acres,price,costPrice,downPayment,monthlyPayment,term,images,description,features,lat,lng,zoning,terrain,roadAccess,utilities,apn,status,featured,createdAt,monthlyExpenses,useCases,interestRate";

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;

  // Env yoksa düzgün davran — sayfa boş-durum gösterir, çökmez.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ properties: [], error: "supabase_not_configured" });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const state = searchParams.get("state");

    const s = supabaseAdmin();
    let q = s
      .from("Property")
      .select(COLUMNS)
      // Yalnızca yayında ilanlar — DRAFT (taslak) hariç. AVAILABLE/PENDING/SOLD
      // vitrinde gösterilebilir; "sold" filtrelemesi UI tarafında yapılıyor.
      .neq("status", "DRAFT");

    // İlan detayı için tekil getirme — cuid id veya slug ile eşleştir.
    if (id) {
      q = q.or(`id.eq.${id},slug.eq.${id}`);
    } else {
      if (state) q = q.eq("state", state);
      q = q.order("createdAt", { ascending: false });
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ properties: [], error: error.message });
    // Eski uydurma seed kayıtlarını (kısa sayısal id: "1".."12") vitrinden gizle.
    // Bunlar DB'de korunur (silinmez) ama gerçek scraper-türevli ilanların
    // yanında uydurma başlık göstermemek için public yanıttan çıkarılır.
    const rows = (data ?? []).filter(
      (r: { id?: string }) => !(r.id && /^\d{1,2}$/.test(r.id))
    );
    return NextResponse.json({ properties: rows });
  } catch (e) {
    return NextResponse.json({
      properties: [],
      error: e instanceof Error ? e.message : "failed",
    });
  }
}
