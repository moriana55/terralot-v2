import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { runRefresh } from "@/lib/rakip-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/rakip-radar/refresh — competitor_listings'in ŞU ANKİ halini
// snapshot olarak kaydeder ve bir önceki izlenen durumla diff'ler
// (NEW / PRICE_CHANGED / STATUS_CHANGED / DISAPPEARED / REAPPEARED).
//
// NOT: Bu route scraper'ı ÇALIŞTIRMAZ — kaynak tabloyu tazelemek için önce
// POST /api/competitor-scraper (Puppeteer, out-of-band) tetiklenir, o bitince
// bu çağrılır. Günlük otomasyon: scripts/rakip-radar-refresh.mjs (README).
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    const result = await runRefresh(supabaseAdmin());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "refresh failed",
        hint: "Tablolar yoksa sql/rakip_radar.sql çalıştırılmalı (README → Rakip Radar).",
      },
      { status: 500 }
    );
  }
}
