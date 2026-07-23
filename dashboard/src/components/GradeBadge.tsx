// Harf notu rozeti — arsa-notları vitrini, harita popup'ı ve arama kuyruğunda
// aynı görsel dil. Renkler: lib/offmarket-grade.ts (tek kaynak).
// grade=null + showNA → "N/A" rozeti (derecelendirilemedi — F ile karıştırma).
import { gradeColor, GRADE_LABELS } from "@/lib/offmarket-grade";

export default function GradeBadge({
  grade,
  size = "md",
  title,
  showNA = false,
}: {
  grade: string | null | undefined;
  size?: "sm" | "md" | "lg";
  title?: string;
  showNA?: boolean;
}) {
  const isNA = grade == null;
  if (isNA && !showNA) return null;
  const c = isNA ? "#64748b" : gradeColor(grade);
  const px = size === "lg" ? 44 : size === "md" ? 30 : 22;
  const fs = (size === "lg" ? 18 : size === "md" ? 13 : 11) - (isNA ? 3 : 0);
  return (
    <span
      title={title ?? (isNA ? GRADE_LABELS["N/A"] : undefined)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: px, height: px, borderRadius: px / 3, padding: isNA ? "0 4px" : 0,
        background: `${c}1a`, border: `2px ${isNA ? "dashed" : "solid"} ${c}`, color: c,
        font: `800 ${fs}px system-ui, sans-serif`, letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
    >
      {isNA ? "N/A" : grade}
    </span>
  );
}
