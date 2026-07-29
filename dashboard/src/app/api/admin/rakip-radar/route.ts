import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import { loadTracked } from "@/lib/rakip-radar-store";
import { scraperHealth, type RunnerStatus } from "@/lib/scraper-health";
import {
  competitorStats,
  ppaHistogram,
  radarSummary,
  verificationLinks,
  isSyntheticApn,
  daysBetween,
} from "@/lib/rakip-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/rakip-radar — radar ekranının tüm verisi:
// izlenen ilanlar (DOM + fiyat geçmişi), özet kartlar, rakip performansı,
// $/acre histogramı ve son diff olayları. Salt-okunur; snapshot almak için
// POST /api/admin/rakip-radar/refresh kullanılır.
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const now = new Date();
  try {
    const s = supabaseAdmin();
    const tracked = await loadTracked(s);

    const [{ data: events }, { data: runs }, { data: lastScrape }] = await Promise.all([
      s.from("competitor_events").select("*").order("at", { ascending: false }).limit(200),
      s.from("competitor_snapshots").select("run_at").order("run_at", { ascending: false }).limit(1),
      // Scraper tazeliği: kaynak tablodaki en yeni scraped_at (snapshot'tan
      // bağımsız — scraper ölürse burası bayatlar ve rozet kırmızıya döner).
      s.from("competitor_listings").select("scraped_at").order("scraped_at", { ascending: false, nullsFirst: false }).limit(1),
    ]);

    // Runner durumu. Vercel'de/başka makinede dosya yoktur → null; sağlık o
    // zaman sadece veri tazeliğinden hesaplanır.
    //
    // 2026-07-29: kaynak DEĞİŞTİ. Eskiden ayna klasördeki
    // ~/Library/Application Support/terralot-runner/status.json okunuyordu;
    // o ayna artık hiç koşmuyor, yani dosya SONSUZA KADAR "başarılı" yazılı
    // kalırdı — düzeltmeye çalıştığımız yalanın ta kendisi. Artık gerçek
    // projedeki scraper/.hasat-durum.json okunur; eski yol yalnızca geriye
    // dönük yedek olarak denenir.
    let runner: RunnerStatus | null = null;
    const adaylar = [
      process.env.VEGALAND_HASAT_DURUM,
      join(process.cwd(), "..", "scraper", ".hasat-durum.json"),
      process.env.VEGALAND_RUNNER_STATUS,
      join(homedir(), "Library", "Application Support", "terralot-runner", "status.json"),
    ].filter(Boolean) as string[];
    for (const p of adaylar) {
      try {
        const ham = JSON.parse(readFileSync(p, "utf8"));
        // Yeni format (.hasat-durum.json) → eski RunnerStatus şekline çevir.
        runner = ham.sonKosuBaslangic
          ? {
              lastRunAt: ham.sonKosuBitis ?? ham.sonKosuBaslangic,
              lastSuccessAt: ham.sonBasariliKosu ?? null,
              consecutiveFailures: ham.ustUsteHata ?? 0,
              lastError: ham.sonHata ?? null,
            }
          : (ham as RunnerStatus);
        break;
      } catch {
        /* sıradaki adaya geç */
      }
    }
    const lastScrapeAt = lastScrape?.[0]?.scraped_at ?? null;

    const listings = tracked
      .map((t) => ({
        ...t,
        dom:
          t.status === "ACTIVE" || t.status === "PENDING"
            ? daysBetween(t.first_seen, now)
            : t.dom_days,
        syntheticApn: isSyntheticApn(t.apn),
        links: verificationLinks(t),
      }))
      .sort((a, b) => {
        // Şüpheliler üstte (aksiyon gerekiyor), sonra aktifler DOM'a göre
        const rank = (s: string) =>
          s === "SUSPECTED_SOLD" ? 0 : s === "PENDING" ? 1 : s === "ACTIVE" ? 2 : s === "SOLD_VERIFIED" ? 3 : 4;
        return rank(a.status) - rank(b.status) || (b.dom ?? 0) - (a.dom ?? 0);
      });

    return NextResponse.json({
      summary: radarSummary(tracked, now),
      competitors: competitorStats(tracked),
      histogram: ppaHistogram(tracked, now),
      listings,
      events: events ?? [],
      lastRunAt: runs?.[0]?.run_at ?? null,
      lastScrapeAt,
      health: scraperHealth(lastScrapeAt, runner, now),
      trackedCount: tracked.length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "failed",
        hint: "Tablolar yoksa: npx prisma db execute --file sql/rakip_radar.sql (bkz. README Rakip Radar bölümü)",
      },
      { status: 500 }
    );
  }
}
