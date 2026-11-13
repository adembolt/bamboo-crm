"use server";
import { revalidatePath } from "next/cache";
import { requireSession, requireOps, requireManager } from "@/lib/auth";
import type { PayMethod } from "@/lib/database.types";

type Res = { ok: true } | { ok: false; error: string };
const okDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/* ---------- Aramalar ---------- */
export async function addCall(i: { direction: "in" | "out"; outcome: string; customerId: string | null; phone: string; note: string; at?: string }): Promise<Res> {
  const { supabase, user, profile } = await requireSession();
  if (!profile) return { ok: false, error: "Yetki yok." };
  const outcome = ["answered", "missed", "no_answer", "booked", "callback"].includes(i.outcome) ? i.outcome : "answered";
  if (!i.customerId && !i.phone.trim()) return { ok: false, error: "Müşteri veya telefon gerekli." };
  const { error } = await supabase.from("call_logs").insert({ direction: i.direction === "out" ? "out" : "in", outcome: outcome as "answered", customer_id: i.customerId, phone: i.phone.trim().slice(0, 30), note: i.note.trim().slice(0, 500), call_at: i.at ? new Date(i.at).toISOString() : new Date().toISOString(), created_by: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/musteriler/aramalar");
  return { ok: true };
}
export async function deleteCall(id: string): Promise<Res> {
  const { supabase } = await requireOps();
  const { error } = await supabase.from("call_logs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/musteriler/aramalar");
  return { ok: true };
}

/* ---------- Bahşişler ---------- */
export async function addTip(i: { date: string; staffId: string; amount: number; method: PayMethod; toPayroll: boolean; customerId: string | null; note: string }): Promise<Res> {
  const { supabase, user } = await requireOps();
  if (!i.staffId || !(i.amount > 0)) return { ok: false, error: "Personel ve tutar gerekli." };
  const method = (["cash", "card", "transfer", "online"].includes(i.method) ? i.method : "cash") as PayMethod;
  const { error } = await supabase.from("tips").insert({ tip_date: okDate(i.date) ? i.date : new Date().toISOString().slice(0, 10), staff_id: i.staffId, amount: Math.round(i.amount * 100) / 100, method, to_payroll: i.toPayroll, customer_id: i.customerId, note: i.note.trim().slice(0, 300), created_by: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/musteriler/bahsisler"); revalidatePath("/panel/kasa/maas");
  return { ok: true };
}
export async function deleteTip(id: string): Promise<Res> {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("tips").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/musteriler/bahsisler");
  return { ok: true };
}

/* ---------- Cezalar: müşteri bakiyesine borç ---------- */
async function balanceMove(supabase: Awaited<ReturnType<typeof requireOps>>["supabase"], customerId: string, amount: number, reason: string, userId: string) {
  const { data: c } = await supabase.from("customers").select("balance").eq("id", customerId).single();
  await supabase.from("customers").update({ balance: Math.round((Number(c?.balance ?? 0) + amount) * 100) / 100 }).eq("id", customerId);
  await supabase.from("balance_ledger").insert({ customer_id: customerId, amount, reason, created_by: userId });
}
export async function addFine(i: { customerId: string; visitId: string | null; kind: "no_show" | "late_cancel" | "other"; amount: number; reason: string; date?: string }): Promise<Res> {
  const { supabase, user } = await requireOps();
  if (!i.customerId || !(i.amount > 0)) return { ok: false, error: "Müşteri ve tutar gerekli." };
  const label = i.kind === "no_show" ? "Gelmeme cezası" : i.kind === "late_cancel" ? "Geç iptal cezası" : "Ceza";
  const { error } = await supabase.from("fines").insert({ customer_id: i.customerId, visit_id: i.visitId, kind: i.kind, amount: Math.round(i.amount * 100) / 100, reason: i.reason.trim().slice(0, 300), fine_date: i.date && okDate(i.date) ? i.date : new Date().toISOString().slice(0, 10), created_by: user.id });
  if (error) return { ok: false, error: error.code === "23505" ? "Bu randevu için ceza zaten yazılmış." : error.message };
  await balanceMove(supabase, i.customerId, -Math.round(i.amount * 100) / 100, `${label}${i.reason ? ` · ${i.reason}` : ""}`, user.id);
  revalidatePath("/panel/musteriler/cezalar"); revalidatePath(`/panel/musteriler/${i.customerId}`);
  return { ok: true };
}
export async function waiveFine(id: string): Promise<Res> {
  const { supabase, user } = await requireManager();
  const { data: f } = await supabase.from("fines").select("customer_id, amount, waived").eq("id", id).single();
  if (!f || f.waived) return { ok: false, error: "Ceza bulunamadı." };
  await supabase.from("fines").update({ waived: true }).eq("id", id);
  await balanceMove(supabase, f.customer_id, Number(f.amount), "Ceza silindi", user.id);
  revalidatePath("/panel/musteriler/cezalar"); revalidatePath(`/panel/musteriler/${f.customer_id}`);
  return { ok: true };
}
export async function saveFineRules(fd: FormData) {
  const { supabase } = await requireManager();
  const n = (k: string) => { const v = Number(String(fd.get(k) ?? "").replace(",", ".")); return Number.isFinite(v) && v >= 0 ? v : 0; };
  await supabase.from("settings").update({ fine_no_show: n("fine_no_show"), fine_late_cancel: n("fine_late_cancel"), fine_late_cancel_hours: Math.round(n("fine_late_cancel_hours")) || 24 }).eq("id", 1);
  revalidatePath("/panel/musteriler/cezalar");
}
