import { NextRequest, NextResponse } from "next/server";
import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import { supabaseAdmin } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// ANLAŞMA BORU HATTI (5 aşama) — arama kokpitindeki "İlgileniyor" sonucu
// otomatik giriş yapar; buradan Teklif → Pazarlık → Sözleşme → Tapu sürülür.
// GET: hattaki anlaşmalar (lead bilgisiyle). POST: aşama/not/teklif güncelle
// veya elle ekle. DELETE: hattan çıkar.
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = new Set(["ilgileniyor", "teklif", "pazarlik", "sozlesme", "tapu"]);

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();
  const { data: deals, error } = await s
    .from("pipeline_deals")
    .select("lead_id, stage, note, offer_amount, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error && /relation|does not exist/i.test(error.message)) {
    return NextResponse.json({ deals: [], schemaReady: false });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (deals ?? []).map((d) => d.lead_id);
  const { data: leads } = ids.length
    ? await s.from("offmarket_leads").select("lead_id, owner, state, county, apn, acres, est_offer, est_retail, est_margin, phone").in("lead_id", ids)
    : { data: [] };
  const map = new Map((leads ?? []).map((l) => [l.lead_id, l]));

  return NextResponse.json({
    deals: (deals ?? []).map((d) => ({ ...d, lead: map.get(d.lead_id) ?? null })),
    schemaReady: true,
  });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let body: { lead_id?: string; stage?: string; note?: string; offer_amount?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "geçersiz json" }, { status: 400 });
  }
  if (!body.lead_id) return NextResponse.json({ error: "lead_id zorunlu" }, { status: 400 });
  if (body.stage && !STAGES.has(body.stage)) return NextResponse.json({ error: "geçersiz aşama" }, { status: 400 });

  const s = supabaseAdmin();
  const patch: Record<string, unknown> = { lead_id: body.lead_id, updated_at: new Date().toISOString() };
  if (body.stage) patch.stage = body.stage;
  if (body.note !== undefined) patch.note = body.note?.slice(0, 1000) || null;
  if (body.offer_amount !== undefined) patch.offer_amount = body.offer_amount;

  const { error } = await s.from("pipeline_deals").upsert(patch, { onConflict: "lead_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const leadId = req.nextUrl.searchParams.get("lead_id");
  if (!leadId) return NextResponse.json({ error: "lead_id zorunlu" }, { status: 400 });
  const s = supabaseAdmin();
  const { error } = await s.from("pipeline_deals").delete().eq("lead_id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
