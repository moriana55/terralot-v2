import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requireGate } from "@/lib/api-guard";
import rakipSatislarData from "@/data/rakip-satislar.json";
import mohaveData from "@/data/mohave-offmarket.json";
import trsOzetData from "@/data/trs-ozet.json";
import {
  normalizeApnCandidates,
  findRakipSatisRecord,
  findMohaveOffmarketRow,
  findGenericApnRecord,
  buildOurRecordSummary,
  findTrsOzet,
  type RakipSatisLike,
  type MohaveOffmarketLike,
  type TrsOzetData,
} from "@/lib/apn-dogrula";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// APN + TRS DOĞRULAMA — "SOL sütun: bizim kayıtlarımız" ucu. Elimizdeki tüm veri
// kaynaklarında (rakip-satislar.json tapu kaydı, mohave-offmarket.json 20K lead,
// varsa rakip-ilan-fiyat.json aktif ilan) APN'i arar + TRS için önceden
// hesaplanmış bölge özetini (trs-ozet.json) döner.
//
// SAĞ sütun (Mohave County ArcGIS canlı sorgu) BURADA YOK — o tarayıcıdan
// atılır (residential IP gerektiriyor, sunucudan timeout olur; bkz. apn-sorgula
// sayfası / CountyGisLayer.tsx ile aynı dürüst kısıt).
// ─────────────────────────────────────────────────────────────────────────────

const RAKIP_RECORDS = (rakipSatislarData as { records: RakipSatisLike[] }).records ?? [];
const MOHAVE_ROWS = (mohaveData as { rows: MohaveOffmarketLike[] }).rows ?? [];
const TRS_OZET = trsOzetData as unknown as TrsOzetData;

// rakip-ilan-fiyat.json (varsa) — başka bir ajan üretiyor olabilir, şekli kesin
// değil. Yoksa/şekli farklıysa sessizce atla (existsSync + try/catch ile korunur).
// fs.readFileSync (bundler'ın import()'u statik çözmeye çalışıp derleme anında
// olmayan dosya için HATA VERMESİNİ önlemek için — dynamic import yerine).
function loadRakipIlanFiyat(): { apn?: string | null; [k: string]: unknown }[] {
  try {
    const path = join(process.cwd(), "src/data/rakip-ilan-fiyat.json");
    if (!existsSync(path)) return [];
    const data = JSON.parse(readFileSync(path, "utf8"));
    const records = data?.records;
    return Array.isArray(records) ? (records as { apn?: string | null }[]) : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const unauth = await requireGate(req);
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const apn = (searchParams.get("apn") || "").trim();
  const trs = (searchParams.get("trs") || "").trim();

  if (trs) {
    const ozet = findTrsOzet(TRS_OZET, trs);
    return NextResponse.json({ kind: "trs", trs, ozet });
  }

  if (!apn) {
    return NextResponse.json({ error: "apn veya trs parametresi gerekli" }, { status: 400 });
  }

  const candidates = normalizeApnCandidates(apn);
  const rakipSatis = findRakipSatisRecord(RAKIP_RECORDS, candidates);
  const mohave = findMohaveOffmarketRow(MOHAVE_ROWS, candidates);
  const ilanRecords = loadRakipIlanFiyat();
  const ilan = findGenericApnRecord(ilanRecords, candidates);
  const summary = buildOurRecordSummary(apn, rakipSatis, mohave, ilan);

  return NextResponse.json({
    kind: "apn",
    apn,
    candidates,
    rakipSatis,
    mohave,
    ilan,
    summary,
  });
}
