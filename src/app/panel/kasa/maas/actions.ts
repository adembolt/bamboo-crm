"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

export async function addStaffAdjustment(i: { staffId: string; amount: number; date: string; note: string }) {
  const { supabase, user } = await requireManager();
  if (!Number.isFinite(i.amount) || !i.amount || !/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return { ok: false as const, error: "bad_input" };
  const { error } = await supabase.from("staff_adjustments").insert({ staff_id: i.staffId, amount: Math.round(i.amount * 100) / 100, adj_date: i.date, note: String(i.note ?? "").slice(0, 200), created_by: user.id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/kasa/maas"); return { ok: true as const };
}
export async function deleteStaffAdjustment(id: string) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("staff_adjustments").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/kasa/maas"); return { ok: true as const };
}
export async function setPayrollStart(date: string) {
  const { supabase } = await requireManager();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, error: "bad_input" };
  const { error } = await supabase.from("settings").update({ payroll_start: date }).eq("id", 1);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/kasa/maas"); return { ok: true as const };
}
