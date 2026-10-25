import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PayMethod, Staff } from "@/lib/database.types";

export type DayVisit = {
  id: string; visit_date: string; status: string; discount_percent: number; notes: string;
  customer: { id: string; first_name: string; last_name: string; phone: string; loyalty_points: number; balance: number } | null;
  items: { id: string; service_id: string | null; service_name: string; staff_id: string | null; starts_at: string; price: number; discount: number; status: string; package_id: string | null }[];
  packages?: { id: string; name: string; service_id: string | null; total_sessions: number; used_sessions: number; expires_at: string | null }[];
  sale: { id: string; total: number; discount: number; payments: { method: PayMethod; amount: number }[] } | null;
};
export type OtherSale = { id: string; sale_date: string; total: number; notes: string; customer: { id: string; first_name: string; last_name: string } | null; items: { kind: string; name: string; total: number }[]; payments: { method: PayMethod; amount: number }[] };

export async function loadKasaDay(supabase: SupabaseClient<Database>, isoDate: string) {
  const [visitsRes, expRes, staffRes, settingsRes, otherRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visit_date, status, discount_percent, notes, customer:customers(id, first_name, last_name, phone, loyalty_points, balance), items:visit_items(id, service_id, service_name, staff_id, starts_at, price, discount, status, package_id), sale:sales(id, total, discount, payments:sale_payments(method, amount))")
      .eq("visit_date", isoDate)
      .neq("status", "cancelled")
      .order("created_at"),
    supabase.from("expenses").select("*, staff:staff(full_name)").eq("expense_date", isoDate).order("created_at"),
    supabase.from("staff").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("settings").select("kdv_rate, currency").eq("id", 1).single(),
    supabase.from("sales").select("id, sale_date, total, notes, customer:customers(id, first_name, last_name), items:sale_items(kind, name, total), payments:sale_payments(method, amount)").eq("sale_date", isoDate).is("visit_id", null).order("created_at"),
  ]);
  const visits = ((visitsRes.data ?? []) as unknown as (Omit<DayVisit, "sale"> & { sale: DayVisit["sale"] | DayVisit["sale"][] })[]).map((v) => ({
    ...v,
    sale: Array.isArray(v.sale) ? (v.sale[0] ?? null) : v.sale,
  })) as DayVisit[];
  // Açık ziyaretlerin müşterilerine ait aktif paketler
  const custIds = [...new Set(visits.filter((v) => !v.sale && v.customer).map((v) => v.customer!.id))];
  if (custIds.length) {
    const { data: pk } = await supabase.from("customer_packages").select("id, customer_id, name, service_id, total_sessions, used_sessions, expires_at").in("customer_id", custIds).eq("is_active", true);
    for (const v of visits) if (v.customer) v.packages = (pk ?? []).filter((p) => p.customer_id === v.customer!.id && p.used_sessions < p.total_sessions && (!p.expires_at || p.expires_at >= isoDate));
  }
  return { visits, otherSales: (otherRes.data ?? []) as unknown as OtherSale[], expenses: expRes.data ?? [], staff: (staffRes.data ?? []) as Staff[], settings: settingsRes.data! };
}

export function summarize(visits: DayVisit[], expenses: { amount: number; method: PayMethod }[], kdv: number, otherSales: OtherSale[] = []) {
  const byMethod: Record<string, number> = {};
  let gross = 0;
  for (const v of visits) {
    if (!v.sale) continue;
    gross += Number(v.sale.total);
    for (const p of v.sale.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }
  for (const o of otherSales) { gross += Number(o.total); for (const p of o.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount); }
  // Hediye çeki ve puanla ödenen kısım gerçek tahsilat değil (çek satışında zaten sayıldı)
  gross -= (byMethod.gift_card ?? 0) + (byMethod.points ?? 0) + (byMethod.balance ?? 0);
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
    if (r.kind === "product") m.product += Number(r.total); else if (r.kind === "service" || r.kind === "package") m.service += Number(r.total);
    map.set(r.staff_id, m);
  }
  return map;
}
