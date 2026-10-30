"use server";
import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";

export async function addCustomerNote(customerId: string, body: string) {
  const { supabase, user } = await requireOps();
  const b = body.trim(); if (!b) return { ok: false as const, error: "empty" };
  const { error } = await supabase.from("customer_notes").insert({ customer_id: customerId, body: b.slice(0, 4000), created_by: user.id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/panel/musteriler/${customerId}`); return { ok: true as const };
}
export async function deleteCustomerNote(id: string, customerId: string) {
  const { supabase } = await requireOps();
  const { error } = await supabase.from("customer_notes").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/panel/musteriler/${customerId}`); return { ok: true as const };
}
export async function addCustomerPhoto(i: { customerId: string; path: string; kind: "before" | "after" | "other"; caption: string; takenAt: string }) {
  const { supabase, user } = await requireOps();
  if (!i.path.startsWith(`${i.customerId}/`)) return { ok: false as const, error: "path" };
  const { error } = await supabase.from("customer_photos").insert({ customer_id: i.customerId, storage_path: i.path, kind: i.kind, caption: i.caption.slice(0, 200), taken_at: i.takenAt, created_by: user.id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/panel/musteriler/${i.customerId}`); return { ok: true as const };
}
export async function deleteCustomerPhoto(id: string, customerId: string) {
  const { supabase } = await requireOps();
  const { data: p } = await supabase.from("customer_photos").select("storage_path").eq("id", id).maybeSingle();
  if (p) await supabase.storage.from("customer-photos").remove([p.storage_path]);
  await supabase.from("customer_photos").delete().eq("id", id);
  revalidatePath(`/panel/musteriler/${customerId}`); return { ok: true as const };
}
