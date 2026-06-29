import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { nextAction, CadenceEvent } from "@/lib/cadence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// OUTREACH CADENCE TICK (admin-gated)
//
//   GET  /api/admin/outreach-tick   → DRY-RUN: vadesi gelen lead'leri listele (gönderme yok)
//   POST /api/admin/outreach-tick   → vadesi gelen her lead'e SIRADAKİ dokunuşu gönder
//        body (ops): { limit?: number }   varsayılan 25 lead/tik
//
// Akış:
//   1. outreach_events'ten lead başına EN YENİ satırı al (kadans işaretçisi orada).
//   2. cadence.nextAction ile vadesi gelmiş + yanıt yok + bitmemiş olanları seç.
//   3. Her biri için mevcut /api/outreach POST'unu çağır (deal-sheet + Lob + log +
//      sequence_step ilerletme zaten orada). LOB_API_KEY yoksa /api/lob mock atar.
//   4. {processed, sent, skipped, items} özetini döndür.
//
// Bu route gecelik cron tarafından çağrılmak üzere tasarlandı (henüz kurulmadı);
// admin panelinden "▶ Kadansı ilerlet" ile de elle tetiklenebilir.
//
// DÜRÜST NOT: kadans kolonları (outreach_cadence.sql) uygulanmadan veya en az bir
// Touch-1 teklifi gönderilmeden bu route 0 işler — graceful, çökme yok.
// ─────────────────────────────────────────────────────────────────────────────

function isMissingColumn(msg?: string | null): boolean {
  return /schema cache|does not exist|could not find|column/i.test(msg ?? "");
}

interface EventRow extends CadenceEvent {
  id: string;
  lead_ref: string | null;
  created_at: string;
  channel?: string | null;
}

// Lead başına EN YENİ satırı (kadans işaretçisi) çıkar. Tick gönderince yeni satır
// eklenir → bir sonraki tikte o satır "en yeni" olur, eski due satır seçilmez.
async function loadLatestPerLead(
  s: ReturnType<typeof supabaseAdmin>
): Promise<{ rows: EventRow[]; missing: boolean }> {
  const { data, error } = await s
    .from("outreach_events")
    .select("id,lead_ref,created_at,channel,sequence_step,next_action_at,last_sent_at,sequence_status,responded")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    return { rows: [], missing: isMissingColumn(error.message) };
  }
  const seen = new Set<string>();
  const latest: EventRow[] = [];
  for (const r of (data as EventRow[]) || []) {
    const key = r.lead_ref || r.id;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(r);
  }
  return { rows: latest, missing: false };
}

// Vadesi gelmiş (gönderilmeye hazır) lead'leri + sıradaki adımı döndür.
function dueItems(rows: EventRow[], now: Date) {
  const out: { leadId: string; step: number; channel: string; type: string; dueAt: string }[] = [];
  for (const r of rows) {
    if (!r.lead_ref) continue;
    const a = nextAction(r, now);
    if (a.kind === "send" && a.ready) {
      out.push({
        leadId: r.lead_ref,
        step: a.step.step,
        channel: a.step.channel,
        type: a.step.type,
        dueAt: a.dueAt.toISOString(),
      });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const s = supabaseAdmin();
  const { rows, missing } = await loadLatestPerLead(s);
  if (missing) {
    return NextResponse.json({
      due: [],
      ready: 0,
      note: "Kadans kolonları yok — dashboard/sql/outreach_cadence.sql uygula.",
    });
  }
  const due = dueItems(rows, new Date());
  return NextResponse.json({
    ready: due.length,
    due,
    note:
      due.length === 0
        ? "Vadesi gelen dokunuş yok (henüz teklif gönderilmedi ya da hepsi beklemede)."
        : `${due.length} lead için sıradaki dokunuş gönderilmeye hazır. POST ile tetikle.`,
  });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { limit: 10 });
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const max = Math.min(100, Math.max(1, typeof body.limit === "number" ? Math.trunc(body.limit) : 25));

  const s = supabaseAdmin();
  const { rows, missing } = await loadLatestPerLead(s);
  if (missing) {
    return NextResponse.json({
      processed: 0,
      sent: 0,
      skipped: 0,
      items: [],
      note: "Kadans kolonları yok — dashboard/sql/outreach_cadence.sql uygula, sonra tekrar dene.",
    });
  }

  const due = dueItems(rows, new Date()).slice(0, max);
  const origin = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") || "";

  let sent = 0;
  let skipped = 0;
  const items: { leadId: string; step: number; channel: string; status: string; error?: string | null }[] = [];

  // Her lead için mevcut /api/outreach gönderim akışını yeniden kullan (deal-sheet,
  // Lob, loglama, sequence_step ilerletme hepsi orada). Sıralı: paylaşılan Lob
  // hesabını / rate limiti yormamak için.
  for (const d of due) {
    try {
      const r = await fetch(`${origin}/api/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          leadId: d.leadId,
          channel: d.channel,
          type: d.type,
          sequenceStep: d.step,
          send: true,
        }),
      });
      const j = (await r.json().catch(() => null)) as { status?: string; error?: string | null } | null;
      const status = j?.status || (r.ok ? "unknown" : "failed");
      if (status === "sent" || status === "mock") sent++;
      else skipped++;
      items.push({ leadId: d.leadId, step: d.step, channel: d.channel, status, error: j?.error ?? null });
    } catch (e) {
      skipped++;
      items.push({ leadId: d.leadId, step: d.step, channel: d.channel, status: "failed", error: String(e) });
    }
  }

  return NextResponse.json({
    processed: due.length,
    sent,
    skipped,
    items,
    note:
      due.length === 0
        ? "Vadesi gelen dokunuş yoktu."
        : `${due.length} lead işlendi · ${sent} gönderildi/mock · ${skipped} atlandı. LOB_API_KEY yoksa gönderimler mock'tur.`,
  });
}
