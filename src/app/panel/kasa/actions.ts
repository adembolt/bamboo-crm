"use server";
import { revalidatePath } from "next/cache";
import { requireOps, requireManager } from "@/lib/auth";
import type { PayMethod } from "@/lib/database.types";

export type CloseVisitInput = {
  visitId: string;
  discountPercent: number;
  payments: { method: PayMethod; amount: number }[];
  notes?: string;
  itemOverrides?: Record<string, number>; // visit_item_id -> fiyat
};

/** Ziyareti kapatır: satış + kalemler + ödemeler oluşturur, ziyareti 'completed' yapar. */
export async function closeVisit(input: CloseVisitInput) {
  const { supabase, user } = await requireOps();
  const { data: visit } = await supabase.from("visits").select("id, customer_id, visit_date, status").eq("id", input.visitId).single();
  if (!visit) return { ok: false as const, error: "Ziyaret bulunamadı." };
  const { data: existing } = await supabase.from("sales").select("id").eq("visit_id", visit.id).maybeSingle();
  if (existing) return { ok: false as const, error: "Bu ziyaret zaten kapatılmış." };

  const { data: items } = await supabase.from("visit_items").select("id, service_name, staff_id, price, discount, status").eq("visit_id", visit.id).neq("status", "cancelled");
  const lines = (items ?? []).map((i) => {
    const unit = input.itemOverrides?.[i.id] ?? Number(i.price);
    return { visit_item_id: i.id, kind: "service" as const, name: i.service_name, staff_id: i.staff_id, qty: 1, unit_price: unit, discount: Number(i.discount), total: unit - Number(i.discount) };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discount = Math.round(subtotal * (Math.max(0, Math.min(100, input.discountPercent)) / 100) * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const paid = input.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (Math.abs(paid - total) > 0.5) return { ok: false as const, error: `Ödeme toplamı (${paid}) tutarla (${total}) eşleşmiyor.` };

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({ visit_id: visit.id, customer_id: visit.customer_id, sale_date: visit.visit_date, subtotal, discount, total, notes: input.notes ?? "", created_by: user.id })
    .select("id")
    .single();
  if (error || !sale) return { ok: false as const, error: error?.message ?? "Satış oluşturulamadı" };

  // İndirimi kalemlere oransal dağıt (hak ediş net tutar üzerinden)
  const factor = subtotal > 0 ? total / subtotal : 1;
  await supabase.from("sale_items").insert(lines.map((l) => ({ ...l, sale_id: sale.id, total: Math.round(l.total * factor * 100) / 100 })));
  const pays = input.payments.filter((p) => Number(p.amount) > 0).map((p) => ({ sale_id: sale.id, method: p.method, amount: Number(p.amount) }));
  if (pays.length) await supabase.from("sale_payments").insert(pays);
  await supabase.from("visits").update({ status: "completed", discount_percent: input.discountPercent }).eq("id", visit.id);
  await supabase.from("visit_items").update({ status: "completed" }).eq("visit_id", visit.id).neq("status", "cancelled");

  revalidatePath("/panel/kasa"); revalidatePath("/panel/takvim"); revalidatePath("/panel");
  return { ok: true as const, saleId: sale.id, total };
}

export async function voidSale(saleId: string) {
  const { supabase } = await requireManager();
  const { data: sale } = await supabase.from("sales").select("visit_id").eq("id", saleId).single();
  const { error } = await supabase.from("sales").delete().eq("id", saleId);
  if (error) return { ok: false as const, error: error.message };
  if (sale?.visit_id) await supabase.from("visits").update({ status: "arrived" }).eq("id", sale.visit_id);
  revalidatePath("/panel/kasa"); revalidatePath("/panel/takvim");
  return { ok: true as const };
}

export async function addExpense(_prev: { error: string }, formData: FormData) {
  const { supabase, user } = await requireOps();
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!amount || amount <= 0) return { error: "Tutar gerekli." };
  const { error } = await supabase.from("expenses").insert({
    expense_date: String(formData.get("date")),
    category: String(formData.get("category") ?? "genel"),
    description: String(formData.get("description") ?? "").trim(),
    amount,
    method: String(formData.get("method") ?? "cash") as PayMethod,
    staff_id: String(formData.get("staff_id") ?? "") || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/kasa");
  return { error: "" };
}

export async function deleteExpense(id: string) {
  const { supabase } = await requireOps();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/panel/kasa");
}

export async function addPayout(_prev: { error: string }, formData: FormData) {
  const { supabase, user } = await requireManager();
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!amount) return { error: "Tutar gerekli." };
  const { error } = await supabase.from("staff_payouts").insert({
    staff_id: String(formData.get("staff_id")),
    period_start: String(formData.get("period_start")),
    period_end: String(formData.get("period_end")),
    amount,
    method: String(formData.get("method") ?? "cash") as PayMethod,
    notes: String(formData.get("notes") ?? ""),
    paid_at: String(formData.get("paid_at") || formData.get("period_end")),
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/kasa");
  return { error: "" };
}
