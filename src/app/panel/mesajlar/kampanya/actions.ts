"use server";
import { BRAND_VOICE_RULES } from "@/lib/brand-voice";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";

export type Segment = { langs: ("tr" | "en" | "ru")[]; lastVisit: "all" | "active" | "sleeping" | "lost" | "never"; categoryId: string | null; consentOnly: boolean; tag: string | null };

export async function saveCampaign(i: { id?: string | null; name: string; segment: Segment; body_tr: string; body_en: string; body_ru: string }) {
  const { supabase, user } = await requireManager();
  const name = i.name.trim(); if (!name) return { ok: false as const, error: "Kampanya adı gerekli." };
  const row = { name, segment: i.segment as unknown as Record<string, unknown>, body_tr: i.body_tr.trim(), body_en: i.body_en.trim(), body_ru: i.body_ru.trim() };
  let id = i.id ?? null;
  if (id) { const { error } = await supabase.from("campaigns").update(row).eq("id", id); if (error) return { ok: false as const, error: error.message }; }
  else { const { data, error } = await supabase.from("campaigns").insert({ ...row, created_by: user.id }).select("id").single(); if (error || !data) return { ok: false as const, error: error?.message ?? "insert" }; id = data.id; }
  revalidatePath("/panel/mesajlar/kampanya");
  redirect(`/panel/mesajlar/kampanya/${id}`);
}
export async function deleteCampaign(id: string) {
  const { supabase } = await requireManager();
  await supabase.from("campaigns").delete().eq("id", id);
  revalidatePath("/panel/mesajlar/kampanya");
  redirect("/panel/mesajlar/kampanya");
}
/** Türkçe metinden İngilizce ve Rusça sürüm (Claude) */
export async function translateCampaign(tr: string) {
  await requireManager();
  const { complete } = await import("@/lib/ai");
  if (!tr.trim()) return { ok: false as const, error: "Önce Türkçe metni yazın." };
  const system = `You translate WhatsApp marketing messages for Bamboo Beauty Lifes from Turkish into English and Russian.
${BRAND_VOICE_RULES}
Return JSON only: {"en": "...", "ru": "..."}. Keep the same meaning, paragraph breaks (\\n\\n), bullets, emojis, prices, dates and links exactly; keep placeholders like {ad} and {salon} unchanged; natural native wording, not literal. If the Turkish text breaks the style rules (e.g. missing the "Bamboo Beauty Lifes 🌿" last line), still follow the rules in the translations.`;
  const r = await complete({ system, user: tr, maxTokens: 1200 });
  if (!r.ok) return { ok: false as const, error: r.error };
  try { const j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)); return { ok: true as const, en: String(j.en ?? ""), ru: String(j.ru ?? "") }; }
  catch { return { ok: false as const, error: "Çeviri okunamadı, tekrar deneyin." }; }
}
