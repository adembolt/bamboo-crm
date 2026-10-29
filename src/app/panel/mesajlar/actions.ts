"use server";
import { revalidatePath } from "next/cache";
import { requireManager, requireOps } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export async function markSent(input: { customerId: string | null; visitId: string | null; kind: string; body: string }) {
  const { supabase, user } = await requireOps();
  await supabase.from("message_log").insert({ customer_id: input.customerId, visit_id: input.visitId, kind: input.kind, body: input.body.slice(0, 2000), sent_by: user.id });
  revalidatePath("/panel/mesajlar");
}

export async function saveTemplates(fd: FormData) {
  const { supabase } = await requireManager();
  const rows: { kind: string; locale: string; body: string }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^tpl:(\w+):(tr|en|ru)$/);
    if (m && typeof v === "string") rows.push({ kind: m[1], locale: m[2], body: v.trim() });
  }
  if (rows.length) await supabase.from("message_templates").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
  revalidatePath("/panel/mesajlar");
}

/** Claude ile müşteriye özel mesaj: geçmiş ziyaretler, paket, bakiye bağlamıyla */
export async function personalize(input: { customerId: string | null; kind: string; locale: string; draft: string }) {
  const { supabase } = await requireOps();
  const { complete } = await import("@/lib/ai");
  const t = await getT();
  if (!input.customerId) return { ok: false as const, error: t("Müşteri yok.") };
  const [{ data: c }, { data: visits }, { data: pk }, { data: st }] = await Promise.all([
    supabase.from("customers").select("first_name, last_name, gender, notes, balance, loyalty_points").eq("id", input.customerId).single(),
    supabase.from("visits").select("visit_date, status, items:visit_items(service_name, staff:staff(full_name))").eq("customer_id", input.customerId).order("visit_date", { ascending: false }).limit(6),
    supabase.from("customer_packages").select("name, total_sessions, used_sessions, expires_at").eq("customer_id", input.customerId).eq("is_active", true),
    supabase.from("settings").select("business_name, google_review_url").eq("id", 1).single(),
  ]);
  if (!c) return { ok: false as const, error: t("Müşteri bulunamadı.") };
  const lang = input.locale === "ru" ? "Russian" : input.locale === "tr" ? "Turkish" : "English";
  const hist = (visits ?? []).map((v) => `${v.visit_date} (${v.status}): ${v.items.map((i) => `${i.service_name}${i.staff?.full_name ? " / " + i.staff.full_name.split(" ")[1] : ""}`).join(", ")}`).join("\n") || "none";
  const pkgs = (pk ?? []).map((p) => `${p.name}: ${p.total_sessions - p.used_sessions} sessions left${p.expires_at ? `, expires ${p.expires_at}` : ""}`).join("\n") || "none";
  const system = `You write short WhatsApp messages for ${st?.business_name || "Bamboo Beauty Lifes"}, a premium beauty & wellness salon in Marmaris, Turkey (always "beauty salon" / "Beauty & Wellness"; never call it a spa or a hairdresser).
Rules: write ONLY the message text, in ${lang}; warm, personal, professional; 2–4 sentences, max ~350 characters; at most one emoji; address the customer by first name; keep every concrete fact from the draft (date, time, services, links) exactly; you may add one relevant personal touch from the history (e.g. remaining package sessions, a natural next treatment) but never invent prices, discounts or medical claims; no hashtags, no signature line.`;
  const user = `Message type: ${input.kind}\nCustomer: ${c.first_name} ${c.last_name}\nRecent visits:\n${hist}\nActive packages:\n${pkgs}\nPrepaid balance: ${Number(c.balance) > 0 ? c.balance + " TRY" : "none"}\n\nDraft to personalise:\n${input.draft}`;
  const r = await complete({ system, user, maxTokens: 350 });
  return r.ok ? { ok: true as const, text: r.text.replace(/^["“]|["”]$/g, "") } : { ok: false as const, error: r.error };
}
