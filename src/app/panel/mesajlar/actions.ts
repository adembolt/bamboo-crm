"use server";
import { revalidatePath } from "next/cache";
import { requireManager, requireOps } from "@/lib/auth";

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
