import { NextRequest, NextResponse } from "next/server";

// Parcel SCRUB — combines real external data (FEMA flood, OpenStreetMap road
// access via the existing /api/dd-check) with deal-data factors (size, absentee,
// valuation) into a single defensible scorecard. Read-only.

type Status = "pass" | "warn" | "fail" | "unknown";
type Factor = {
  key: string;
  label: string;
  status: Status;
  value: string;
  note: string;
  source: string;
  critical?: boolean;
};

const num = (v: string | null) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = num(sp.get("lat"));
  const lon = num(sp.get("lon"));
  const acres = num(sp.get("acres"));
  const value = num(sp.get("value"));
  const offer = num(sp.get("offer"));
  const spread = num(sp.get("spread"));
  const ownerState = (sp.get("ownerState") || "").toUpperCase();
  const propState = (sp.get("state") || "").toUpperCase();
  const use = (sp.get("use") || "").toLowerCase();

  const factors: Factor[] = [];

  // ── 1 & 2: FEMA flood + OSM road access (real, via dd-check) ──────────
  let floodCritical = false;
  let accessCritical = false;
  if (lat != null && lon != null) {
    try {
      const res = await fetch(
        `${req.nextUrl.origin}/api/dd-check?lat=${lat}&lon=${lon}`,
        { headers: { cookie: req.headers.get("cookie") ?? "" } },
      );
      const dd = await res.json();
      const f = dd.flood ?? {};
      const r = dd.road ?? {};

      // Flood
      const zone = String(f.floodZone ?? "?");
      const rs = typeof f.riskScore === "number" ? f.riskScore : null;
      let fStatus: Status = "unknown";
      let fNote = "FEMA verisi alınamadı.";
      if (rs != null) {
        if (rs >= 70) { fStatus = "fail"; floodCritical = true; fNote = `Yüksek sel riski (Zone ${zone}) — sigorta zorunlu, ELE.`; }
        else if (rs >= 30) { fStatus = "warn"; fNote = `Orta sel riski (Zone ${zone}) — dikkat.`; }
        else { fStatus = "pass"; fNote = `Sel riski yok/minimal (Zone ${zone}).`; }
      }
      factors.push({
        key: "flood", label: "Sel riski", status: fStatus,
        value: `Zone ${zone}`, note: fNote, source: "FEMA NFHL", critical: floodCritical,
      });

      // Road access
      const at = String(r.accessType ?? "unknown");
      let rStatus: Status = "unknown";
      let rNote = "Yol verisi alınamadı.";
      if (at === "direct") { rStatus = "pass"; rNote = `Doğrudan yol erişimi${r.nearestRoadName ? ` (${r.nearestRoadName})` : ""}.`; }
      else if (at === "near") { rStatus = "warn"; rNote = `Yakında yol var (${r.nearestRoadMeters ?? "?"} m).`; }
      else if (at === "landlocked") { rStatus = "fail"; accessCritical = true; rNote = "⚠️ Yasal yol erişimi YOK (landlocked) — ELE."; }
      factors.push({
        key: "access", label: "Yol erişimi", status: rStatus,
        value: at === "direct" ? "Doğrudan" : at === "near" ? "Yakın" : at === "landlocked" ? "Landlocked" : "?",
        note: rNote, source: "OpenStreetMap", critical: accessCritical,
      });
    } catch {
      factors.push({ key: "flood", label: "Sel riski", status: "unknown", value: "—", note: "Servise ulaşılamadı.", source: "FEMA NFHL" });
      factors.push({ key: "access", label: "Yol erişimi", status: "unknown", value: "—", note: "Servise ulaşılamadı.", source: "OpenStreetMap" });
    }
  } else {
    factors.push({ key: "flood", label: "Sel riski", status: "unknown", value: "Koordinat yok", note: "Bu kaynakta lat/lng yok — haritadan doğrula.", source: "FEMA NFHL" });
    factors.push({ key: "access", label: "Yol erişimi", status: "unknown", value: "Koordinat yok", note: "Bu kaynakta lat/lng yok — haritadan doğrula.", source: "OpenStreetMap" });
  }

  // ── 3: Parcel size sweet-spot (0.2–5 acre = az sermaye, kolay satış) ──
  if (acres != null && acres > 0) {
    let s: Status, n: string;
    if (acres >= 0.2 && acres <= 5) { s = "pass"; n = "İdeal aralık (0.2–5 acre) — az sermaye, hızlı satış."; }
    else if (acres > 5 && acres <= 20) { s = "warn"; n = "Büyük parsel — bölerek (subdivide) değerlenebilir."; }
    else if (acres < 0.2) { s = "warn"; n = "Çok küçük — kullanım sınırlı olabilir."; }
    else { s = "warn"; n = "Çok büyük — daha fazla sermaye / subdivide gerekir."; }
    factors.push({ key: "size", label: "Parsel boyutu", status: s, value: `${acres.toFixed(2)} acre`, note: n, source: "Parsel verisi" });
  } else {
    factors.push({ key: "size", label: "Parsel boyutu", status: "unknown", value: "—", note: "Acre verisi yok.", source: "Parsel verisi" });
  }

  // ── 4: Absentee (şehir-dışı sahip = motive satıcı) ────────────────────
  if (ownerState) {
    const absentee = ownerState !== propState;
    factors.push({
      key: "absentee", label: "Sahip durumu", status: absentee ? "pass" : "warn",
      value: absentee ? `Şehir dışı (${ownerState})` : `Eyalet içi (${ownerState})`,
      note: absentee ? "Absentee sahip — blind offer'a daha açık." : "Eyalet içi sahip — motivasyon düşük olabilir.",
      source: "Mailing adresi",
    });
  } else {
    factors.push({ key: "absentee", label: "Sahip durumu", status: "unknown", value: "—", note: "Sahip eyaleti bilinmiyor.", source: "Mailing adresi" });
  }

  // ── 5: Vacant land (boş arazi mi) ─────────────────────────────────────
  const vacant = /vacant|vl|vac|undet|rural|boş|raw|land/.test(use) || use === "";
  factors.push({
    key: "use", label: "Kullanım", status: vacant ? "pass" : "warn",
    value: use ? use.toUpperCase().slice(0, 24) : "Boş arazi (varsay.)",
    note: vacant ? "Boş arazi — hedef profil." : "Boş arazi olmayabilir — kontrol et.",
    source: "County use code",
  });

  // ── 6: Değerleme (spread + teklif) ────────────────────────────────────
  if (value && value > 0) {
    const sp20 = Math.round(value * 0.2);
    let s: Status, n: string;
    if (spread != null && spread > 0) { s = "pass"; n = `Pozitif spread (~$${spread.toLocaleString()}). Önerilen teklif ≈ $${sp20.toLocaleString()} (değerin %20'si).`; }
    else { s = "warn"; n = `Spread doğrulanmalı. Önerilen teklif ≈ $${sp20.toLocaleString()} (değerin %20'si).`; }
    factors.push({ key: "value", label: "Değerleme", status: s, value: `$${value.toLocaleString()}`, note: n, source: "Comps / assessed" });
  } else {
    factors.push({ key: "value", label: "Değerleme", status: "unknown", value: "—", note: "Değer verisi yok.", source: "Comps / assessed" });
  }

  // ── Skor + not + karar ────────────────────────────────────────────────
  const W: Record<Status, number> = { pass: 100, warn: 55, fail: 0, unknown: 50 };
  const scored = factors.filter((f) => f.status !== "unknown");
  const score = scored.length
    ? Math.round(scored.reduce((a, f) => a + W[f.status], 0) / scored.length)
    : 50;

  const hasCritical = factors.some((f) => f.critical);
  let grade: string, verdict: string, verdictTone: string, rationale: string;

  if (hasCritical) {
    grade = "F"; verdict = "ELE"; verdictTone = "fail";
    rationale = floodCritical && accessCritical
      ? "Hem yüksek sel riski hem landlocked — çöp parsel."
      : accessCritical ? "Yasal yol erişimi yok (landlocked) — satılamaz." : "Yüksek sel riski — sigorta/değer sorunu.";
  } else if (score >= 80) { grade = "A"; verdict = "AL"; verdictTone = "pass"; rationale = "Tüm kritik faktörler temiz — hedef profil deal."; }
  else if (score >= 65) { grade = "B"; verdict = "AL"; verdictTone = "pass"; rationale = "Güçlü deal, küçük uyarılar var."; }
  else if (score >= 50) { grade = "C"; verdict = "İNCELE"; verdictTone = "warn"; rationale = "Orta — birkaç faktör elle doğrulanmalı."; }
  else { grade = "D"; verdict = "ELE"; verdictTone = "fail"; rationale = "Zayıf — birden çok risk faktörü."; }

  return NextResponse.json({ score, grade, verdict, verdictTone, rationale, factors });
}
