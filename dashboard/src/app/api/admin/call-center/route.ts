import { NextRequest, NextResponse } from "next/server";
import { requireGate, enforceRateLimit } from "@/lib/api-guard";
import { supabaseAdmin } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// SICAK ARAMA KOKPİTİ — GET: arama kuyruğu + yaklaşan geri aramalar.
// POST: arama sonucu kaydet (dnc ise lead'i aranmaz işaretle).
// PUT: skip-trace telefon importu (lead_id veya APN eşleşmesi).
//
// DÜRÜSTLÜK: telefon üretilmez; yalnızca import edilen numaralar gösterilir.
// Numarasız lead kuyrukta "numara bekliyor" olarak listelenir.
// ─────────────────────────────────────────────────────────────────────────────

const OUTCOMES = new Set(["no_answer", "voicemail", "interested", "not_interested", "wrong_number", "callback", "dnc"]);
const QUEUE_LIMIT = 60;
const IMPORT_CAP = 500;

const LEAD_COLS =
  "lead_id, state, county, apn, owner, mailing_city, mailing_state, situs, acres, est_offer, est_retail, est_margin, phone, phone_source, do_not_call";

function normPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const sp = req.nextUrl.searchParams;
  const state = sp.get("state");
  const onlyPhone = sp.get("only_phone") === "1";

  const s = supabaseAdmin();
  let q = s
    .from("offmarket_leads")
    .select(LEAD_COLS)
    .eq("do_not_call", false)
    .order("est_margin", { ascending: false, nullsFirst: false })
    .limit(QUEUE_LIMIT);
  if (state) q = q.eq("state", state);
  if (onlyPhone) q = q.not("phone", "is", null);

  const { data: leads, error } = await q;

  // sql/call_center.sql henüz çalıştırılmadıysa telefon kolonları yoktur —
  // kuyruk yine gelsin, sayfa "şema hazır değil" uyarısı göstersin.
  if (error && /column|does not exist/i.test(error.message)) {
    let fb = s
      .from("offmarket_leads")
      .select("lead_id, state, county, apn, owner, mailing_city, mailing_state, situs, acres, est_offer, est_retail, est_margin")
      .order("est_margin", { ascending: false, nullsFirst: false })
      .limit(QUEUE_LIMIT);
    if (state) fb = fb.eq("state", state);
    const fbRes = await fb;
    if (fbRes.error) return NextResponse.json({ error: fbRes.error.message }, { status: 500 });
    return NextResponse.json({
      leads: (fbRes.data ?? []).map((l) => ({ ...l, phone: null, phone_source: null, do_not_call: false })),
      lastOutcome: {},
      callbacks: [],
      phoneTotal: 0,
      schemaReady: false,
    });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (leads ?? []).map((l) => l.lead_id);
  const [logsRes, cbRes, phoneCountRes] = await Promise.all([
    ids.length
      ? s.from("call_logs").select("lead_id, outcome, created_at").in("lead_id", ids).order("created_at", { ascending: false }).limit(400)
      : Promise.resolve({ data: [], error: null }),
    s.from("call_logs").select("lead_id, note, callback_at").not("callback_at", "is", null).gte("callback_at", new Date().toISOString()).order("callback_at", { ascending: true }).limit(20),
    s.from("offmarket_leads").select("lead_id", { count: "exact", head: true }).not("phone", "is", null),
  ]);

  // lead başına son sonuç
  const lastOutcome: Record<string, { outcome: string; at: string }> = {};
  for (const r of logsRes.data ?? []) {
    if (!lastOutcome[r.lead_id]) lastOutcome[r.lead_id] = { outcome: r.outcome, at: r.created_at };
  }

  // geri aramaların lead bilgisi
  const cbIds = [...new Set((cbRes.data ?? []).map((r) => r.lead_id))];
  const { data: cbLeads } = cbIds.length
    ? await s.from("offmarket_leads").select("lead_id, owner, state, county, phone").in("lead_id", cbIds)
    : { data: [] as { lead_id: string; owner: string; state: string; county: string; phone: string | null }[] };
  const cbMap = new Map((cbLeads ?? []).map((l) => [l.lead_id, l]));

  return NextResponse.json({
    leads: leads ?? [],
    lastOutcome,
    callbacks: (cbRes.data ?? []).map((r) => ({ ...r, lead: cbMap.get(r.lead_id) ?? null })),
    phoneTotal: phoneCountRes.count ?? 0,
    schemaReady: true,
  });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let body: { lead_id?: string; outcome?: string; note?: string; callback_at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "geçersiz json" }, { status: 400 });
  }
  if (!body.lead_id || !body.outcome || !OUTCOMES.has(body.outcome)) {
    return NextResponse.json({ error: "lead_id ve geçerli outcome zorunlu" }, { status: 400 });
  }

  const s = supabaseAdmin();
  const { error } = await s.from("call_logs").insert({
    lead_id: body.lead_id,
    outcome: body.outcome,
    note: body.note?.slice(0, 1000) || null,
    callback_at: body.outcome === "callback" && body.callback_at ? body.callback_at : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.outcome === "dnc") {
    await s.from("offmarket_leads").update({ do_not_call: true }).eq("lead_id", body.lead_id);
  }
  // "İlgileniyor" → anlaşma boru hattına otomatik düşür (varsa dokunma)
  if (body.outcome === "interested") {
    await s.from("pipeline_deals").upsert(
      { lead_id: body.lead_id, stage: "ilgileniyor", note: body.note?.slice(0, 500) || null },
      { onConflict: "lead_id", ignoreDuplicates: true },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let body: { rows?: { key?: string; phone?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "geçersiz json" }, { status: 400 });
  }
  const rows = (body.rows ?? []).slice(0, IMPORT_CAP);
  if (!rows.length) return NextResponse.json({ error: "satır yok" }, { status: 400 });

  const s = supabaseAdmin();
  let updated = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const key = r.key?.trim();
    const phone = r.phone ? normPhone(r.phone) : null;
    if (!key || !phone) {
      if (key) skipped.push(key);
      continue;
    }
    const byId = await s.from("offmarket_leads").update({ phone, phone_source: "skiptrace" }).eq("lead_id", key).select("lead_id");
    if (byId.data?.length) {
      updated += byId.data.length;
      continue;
    }
    const byApn = await s.from("offmarket_leads").update({ phone, phone_source: "skiptrace" }).eq("apn", key).select("lead_id");
    if (byApn.data?.length) updated += byApn.data.length;
    else skipped.push(key);
  }
  return NextResponse.json({ ok: true, updated, skipped: skipped.slice(0, 20), skippedCount: skipped.length });
}
