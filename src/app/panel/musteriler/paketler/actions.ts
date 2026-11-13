"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

export type TemplateInput = { id?: string; name: string; serviceId: string | null; sessions: number; price: number; validDays: number | null; description: string; isActive: boolean };

export async function saveTemplate(i: TemplateInput) {
  const { supabase } = await requireManager();
  if (!i.name.trim() || !(i.sessions > 0)) return { ok: false as const, error: "Paket adı ve seans sayısı gerekli." };
  const row = { name: i.name.trim(), service_id: i.serviceId || null, sessions: Math.round(i.sessions), price: Math.max(0, i.price || 0), valid_days: i.validDays && i.validDays > 0 ? Math.round(i.validDays) : null, description: i.description.trim(), is_active: i.isActive };
  const { error } = i.id ? await supabase.from("package_templates").update(row).eq("id", i.id) : await supabase.from("package_templates").insert(row);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/musteriler/paketler");
  return { ok: true as const };
}

export async function deleteTemplate(id: string) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("package_templates").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/musteriler/paketler");
  return { ok: true as const };
}
