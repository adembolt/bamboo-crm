import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PayMethod, Staff } from "@/lib/database.types";

export type DayVisit = {
  id: string; visit_date: string; status: string; discount_percent: number; notes: string;
  customer: { id: string; first_name: string; last_name: string; phone: string } | null;
  items: { id: string; service_name: string; staff_id: string | null; starts_at: string; price: number; discount: number; status: string }[];
  sale: { id: string; total: number; discount: number; payments: { method: PayMethod; amount: number }[] } | null;
};

export async function loadKasaDay(supabase: SupabaseClient<Database>, isoDate: string) {
  const [visitsRes, expRes, staffRes, settingsRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visit_date, status, discount_percent, notes, customer:customers(id, first_name, last_name, phone), items:visit_items(id, service_name, staff_id, starts_at, price, discount, status), sale:sales(id, total, discount, payments:sale_payments(method, amount))")
      .eq("visit_date", isoDate)
      .neq("status", "cancelled")
      .order("created_at"),
    supabase.from("expenses").select("*, staff:staff(full_name)").eq("expense_date", isoDate).order("created_at"),
    supabase.from("staff").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("settings").select("kdv_rate, currency").eq("id", 1).single(),
  ]);
  const visits = ((visitsRes.data ?? []) as unknown as (Omit<DayVisit, "sale"> & { sale: DayVisit["sale"] | DayVisit["sale"][] })[]).map((v) => ({
    ...v,
    sale: Array.isArray(v.sale) ? (v.sale[0] ?? null) : v.sale,
  })) as DayVisit[];
  return { visits, expenses: expRes.data ?? [], staff: (staffRes.data ?? []) as Staff[], settings: settingsRes.data! };
}

export function summarize(visits: DayVisit[], expenses: { amount: number; method: PayMethod }[], kdv: number) {
  const byMethod: Record<string, number> = {};
  let gross = 0;
  for (const v of visits) {
    if (!v.sale) continue;
    gross += Number(v.sale.total);
    for (const p of v.sale.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }
  const expected = visits.filter((v) => !v.sale).reduce((s, v) => s + v.items.filter((i) => i.status !== "cancelled").reduce((a, i) => a + Number(i.price) - Number(i.discount), 0) * (1 - Number(v.discount_percent) / 100), 0);
  const exp = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const net = gross / (1 + kdv);
  return { gross, byMethod, expected, expenses: exp, kdv: gross - net, net, cashNet: (byMethod.cash ?? 0) - expenses.filter((e) => e.method === "cash").reduce((s, e) => s + Number(e.amount), 0) };
}

/** Personel hak edişi: kapatılmış satışların kalemlerinden */
export async function staffEarnings(supabase: SupabaseClient<Database>, from: string, to: string) {
  const { data } = await supabase
    .from("sale_items")
    .select("staff_id, total, kind, sale:sales!inner(sale_date)")
    .gte("sale.sale_date", from)
    .lte("sale.sale_date", to);
  const map = new Map<string, { service: number; product: number }>();
  for (const r of data ?? []) {
    if (!r.staff_id) continue;
    const m = map.get(r.staff_id) ?? { service: 0, product: 0 };
    if (r.kind === "product") m.product += Number(r.total); else m.service += Number(r.total);
    map.set(r.staff_id, m);
  }
  return map;
}
