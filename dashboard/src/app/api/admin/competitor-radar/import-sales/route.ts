import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { csvToSales } from "@/lib/competitor-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/competitor-radar/import-sales
// Body: { csv: string, competitor?: string, source?: string }
// PropStream'den export edilen bir rakip LLC'nin deed/satış CSV'sini esnek
// başlık eşleme ile competitor_sales'e upsert eder (sale_key ile dedup).
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 10 }); // import ağır — dakikada 10
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let body: { csv?: string; competitor?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "geçersiz JSON gövde" }, { status: 400 });
  }
  const csv = (body.csv || "").trim();
  if (!csv) return NextResponse.json({ ok: false, error: "csv boş" }, { status: 400 });
  if (csv.length > 8_000_000) return NextResponse.json({ ok: false, error: "CSV çok büyük (>8MB)" }, { status: 413 });

  const mapped = csvToSales(csv, body.competitor, body.source || "propstream");
  if (mapped.missing.length) {
    return NextResponse.json(
      {
        ok: false,
        error: `Gerekli kolonlar bulunamadı: ${mapped.missing.join(", ")}`,
        detected: mapped.detected,
        hint: "PropStream export'unda en az Grantor/Seller (veya APN) + Sale Date (veya Sale Price) kolonu olmalı.",
      },
      { status: 422 }
    );
  }
  if (!mapped.records.length) {
    return NextResponse.json(
      { ok: false, error: "Eşleşen satış satırı yok.", detected: mapped.detected, skipped: mapped.skipped },
      { status: 422 }
    );
  }

  const s = supabaseAdmin();
  let upserted = 0;
  for (let i = 0; i < mapped.records.length; i += 500) {
    const chunk = mapped.records.slice(i, i + 500);
    const { error } = await s.from("competitor_sales").upsert(chunk, { onConflict: "sale_key" });
    if (error) {
      if (/Could not find the table|does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          { ok: false, error: "competitor_sales tablosu yok — önce sql/competitor_sales.sql uygula." },
          { status: 424 }
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    upserted += chunk.length;
  }

  return NextResponse.json({
    ok: true,
    upserted,
    skipped: mapped.skipped,
    detected: mapped.detected,
    competitor: body.competitor || null,
  });
}
