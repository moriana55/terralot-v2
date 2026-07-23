// Harf notu rozeti — arsa-notları vitrini, harita popup'ı ve arama kuyruğunda
// aynı görsel dil. Renkler: lib/offmarket-grade.ts (tek kaynak).
import { gradeColor } from "@/lib/offmarket-grade";

export default function GradeBadge({
  grade,
  size = "md",
  title,
}: {
  grade: string | null | undefined;
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  if (!grade) return null;
  const c = gradeColor(grade);
  const px = size === "lg" ? 44 : size === "md" ? 30 : 22;
  const fs = size === "lg" ? 18 : size === "md" ? 13 : 11;
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: px, height: px, borderRadius: px / 3,
        background: `${c}1a`, border: `2px solid ${c}`, color: c,
        font: `800 ${fs}px system-ui, sans-serif`, letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
    >
      {grade}
    </span>
  );
}
