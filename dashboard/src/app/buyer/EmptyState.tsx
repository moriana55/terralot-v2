import type { LucideIcon } from "lucide-react";

// Honest empty state — used across the buyer portal until a buyer↔contract
// model is wired. Never fabricates data; explains what will appear here.
export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div
      className="text-center py-20 rounded-2xl border border-dashed"
      style={{ borderColor: "var(--outline)", color: "var(--muted)" }}
    >
      <Icon className="w-8 h-8 mx-auto mb-4 opacity-50" />
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>{title}</p>
      <p className="text-xs max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
