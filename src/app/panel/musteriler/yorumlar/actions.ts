"use server";
import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";

export async function markReviewHandled(id: string, reply: string) {
  const { supabase } = await requireOps();
  const { error } = await supabase.from("reviews").update({ handled: true, ...(reply.trim() ? { reply: reply.trim().slice(0, 2000) } : {}) }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/musteriler/yorumlar"); revalidatePath("/panel");
  return { ok: true as const };
}
