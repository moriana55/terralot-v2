"use client";

import { Lock } from "lucide-react";

const ACCENT = "#8ed1df";

export function ComingSoon({ title }: { title?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div
        className="max-w-md w-full text-center rounded-2xl p-10"
        style={{ background: "var(--surface)", border: "1px solid var(--surface-high)" }}
      >
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
          style={{ width: 64, height: 64, background: "var(--surface-high)" }}
        >
          <Lock className="w-8 h-8" style={{ color: ACCENT }} />
        </div>
        <h1 className="text-xl font-bold mb-2">🔒 Yakında</h1>
        {title && (
          <p className="text-sm font-semibold mb-2" style={{ color: ACCENT }}>{title}</p>
        )}
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Bu modül yakında aktif edilecek.
        </p>
      </div>
    </div>
  );
}
