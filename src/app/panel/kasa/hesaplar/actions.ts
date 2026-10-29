"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

const ok = { ok: true as const };
export async function setOpening(accountId: string, amount: number, date: string) {
  const { supabase } = await requireManager();
  if (!Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, error: "bad_input" };
  const { error } = await supabase.from("cash_accounts").update({ opening_balance: amount, opening_date: date }).eq("id", accountId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/kasa/hesaplar"); return ok;
}
export async function addAdjustment(accountId: string, amount: number, date: string, note: string) {
  const { supabase, user } = await requireManager();
  if (!Number.isFinite(amount) || !amount || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, error: "bad_input" };
  const { error } = await supabase.from("cash_adjustments").insert({ account_id: accountId, amount, adj_date: date, note: String(note ?? "").slice(0, 200), created_by: user.id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/kasa/hesaplar"); return ok;
}
