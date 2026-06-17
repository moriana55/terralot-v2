import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";

export const runtime = "nodejs";

// Triggers the competitor scraper worker that lives in the sibling `scraper/`
// package. The worker (Puppeteer) runs out-of-band and upserts into Supabase;
// the page refreshes from `competitor_listings` once it finishes.
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  try {
    // dashboard/ and scraper/ are siblings under terralot-v2/
    const scraperDir = path.resolve(process.cwd(), "..", "scraper");
    const child = spawn("node", ["competitor-scraper.js"], {
      cwd: scraperDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({
      ok: true,
      message: "Competitor scraper started. Listings will appear once it finishes.",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "spawn failed" },
      { status: 500 }
    );
  }
}
