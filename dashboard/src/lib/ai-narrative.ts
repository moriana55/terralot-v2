// Optional OpenAI-style narrative layer.
//
// Several features (underwriting, buildability) produce a deterministic,
// rule-based verdict that ALWAYS works with zero external deps. On top of that,
// if an OPENAI_API_KEY is present we ask a model to turn the structured signals
// into a short investor-grade narrative. If the key is absent OR the call fails,
// we return null and the caller falls back to a deterministic template.
//
// This keeps the demo green offline while showing the "AI upgrade path".
//
// TODO(owner): set OPENAI_API_KEY in env to enable real narratives. Model and
// base URL are overridable via OPENAI_MODEL / OPENAI_BASE_URL for Azure / proxies.

export function aiEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

interface NarrativeOpts {
  system: string;
  prompt: string;
  maxTokens?: number;
}

// Returns a narrative string, or null when AI is unavailable / errors out.
export async function aiNarrative(opts: NarrativeOpts): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: opts.maxTokens ?? 320,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const text: string | undefined = json?.choices?.[0]?.message?.content;
    return text?.trim() || null;
  } catch {
    return null; // fail soft — caller uses deterministic narrative
  }
}
