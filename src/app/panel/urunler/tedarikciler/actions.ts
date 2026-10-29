"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export async function saveSupplier(i: { id?: string | null; name: string; phone: string; notes: string }) {
  const { supabase } = await requireManager();
  const name = i.name.trim(); if (!name) return { ok: false as const, error: "name" };
  const row = { name, phone: i.phone.trim() ? normalizePhone(i.phone) : "", notes: i.notes.trim() };
  const { error } = i.id ? await supabase.from("suppliers").update(row).eq("id", i.id) : await supabase.from("suppliers").insert(row);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/urunler/tedarikciler"); return { ok: true as const };
}
export async function deleteSupplier(id: string) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/urunler/tedarikciler"); return { ok: true as const };
}
export async function saveWarehouse(i: { id?: string | null; name: string; staffId: string | null; active: boolean }) {
  const { supabase } = await requireManager();
  const name = i.name.trim(); if (!name) return { ok: false as const, error: "name" };
  const row = { name, responsible_staff_id: i.staffId || null, is_active: i.active };
  const { error } = i.id ? await supabase.from("warehouses").update(row).eq("id", i.id) : await supabase.from("warehouses").insert(row);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/urunler/tedarikciler"); return { ok: true as const };
}
