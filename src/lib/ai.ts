import "server-only";

/* Claude API — sunucu tarafı yardımcı. ANTHROPIC_API_KEY Vercel ortam değişkeninden okunur. */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

export function aiEnabled() { return !!process.env.ANTHROPIC_API_KEY; }

export async function complete(opts: { system: string; user: string; maxTokens?: number; temperature?: number }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Yapay zekâ kapalı: Vercel'de ANTHROPIC_API_KEY tanımlı değil." };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: opts.maxTokens ?? 400, temperature: opts.temperature ?? 0.7, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
      signal: AbortSignal.timeout(25000),
    });
    const j = (await r.json()) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
    if (!r.ok) return { ok: false, error: j.error?.message ?? `API hatası (${r.status})` };
    const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    return text ? { ok: true, text } : { ok: false, error: "Boş yanıt" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bağlantı hatası" };
  }
}
