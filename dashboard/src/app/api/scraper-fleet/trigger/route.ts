import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual "Çalıştır" trigger for a single Cerberus bot. Honest by design:
// it only spawns a local worker when SCRAPER_LOCAL=1 AND the sibling
// scraper/ package + script actually exist. Otherwise it returns a clear
// "service not connected" payload instead of pretending to run.

const triggerSchema = z.object({
  bot: z.enum(["tax", "national", "retail", "comp", "calendar"]),
});

// bot kind → worker script in the sibling scraper/ package
const SCRIPTS: Record<string, { script: string; manual: string }> = {
  tax: { script: "migrate_to_supabase.js", manual: "cd scraper && node migrate_to_supabase.js" },
  national: { script: "socrata-harvest.js", manual: "cd scraper && node socrata-harvest.js" },
  retail: { script: "zillow-harvest.js", manual: "cd scraper && node zillow-harvest.js" },
  comp: { script: "competitor-scraper.js", manual: "cd scraper && node competitor-scraper.js" },
  calendar: { script: "govease-harvest.js", manual: "cd scraper && node govease-harvest.js" },
};

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = triggerSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bot" }, { status: 400 });
  }

  const { bot } = parsed.data;
  const cfg = SCRIPTS[bot];

  // Gate: local trigger must be explicitly enabled.
  if (process.env.SCRAPER_LOCAL !== "1") {
    return NextResponse.json({
      ok: false,
      connected: false,
      message: `Scraper servisi bağlı değil. Elle çalıştır: ${cfg.manual}`,
    });
  }

  const scraperDir = path.resolve(process.cwd(), "..", "scraper");
  const scriptPath = path.join(scraperDir, cfg.script);
  if (!existsSync(scriptPath)) {
    return NextResponse.json({
      ok: false,
      connected: false,
      message: `Worker bulunamadı (${cfg.script}). Elle çalıştır: ${cfg.manual}`,
    });
  }

  try {
    const child = spawn("node", [cfg.script], {
      cwd: scraperDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return NextResponse.json({
      ok: true,
      connected: true,
      message: `${bot} botu tetiklendi. Sonuçlar tarama bitince Supabase'e yazılır.`,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, connected: true, error: e instanceof Error ? e.message : "spawn failed" },
      { status: 500 }
    );
  }
}
