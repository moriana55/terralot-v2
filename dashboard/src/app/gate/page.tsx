"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";

function GateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace(next);
    } else {
      setError("Yanlış şifre.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border p-8 space-y-5"
      style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-high)" }}>
          <Lock className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">Admin Access</h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Protected area</p>
        </div>
      </div>
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Password</label>
        <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--surface-low)", borderColor: "var(--outline)" }} />
      </div>
      {error && <p className="text-xs" style={{ color: "#ff5050" }}>{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--primary)", color: "#000" }}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        Enter
      </button>
    </form>
  );
}

export default function GatePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <Suspense fallback={null}>
        <GateForm />
      </Suspense>
    </div>
  );
}
