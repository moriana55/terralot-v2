// Deal score → letter grade inside a progress ring. Scans instantly.
export function gradeOf(score: number): { letter: string; varName: string } {
  if (score >= 80) return { letter: "A+", varName: "--grade-a" };
  if (score >= 70) return { letter: "A", varName: "--grade-a" };
  if (score >= 55) return { letter: "B", varName: "--grade-b" };
  if (score >= 40) return { letter: "C", varName: "--grade-c" };
  return { letter: "D", varName: "--grade-d" };
}

export function ScoreBadge({ score, size = 38 }: { score: number | null | undefined; size?: number }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center justify-center rounded-full text-[10px] font-bold" style={{ width: size, height: size, color: "var(--grade-d)", border: "1.5px dashed var(--outline)" }}>—</span>
    );
  }
  const { letter, varName } = gradeOf(score);
  const color = `var(${varName})`;
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} title={`Skor ${score}/100`}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-high)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
      </svg>
      <span className="font-extrabold leading-none" style={{ color, fontSize: size * 0.34 }}>{letter}</span>
    </span>
  );
}
