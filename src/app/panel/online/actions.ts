"use server";
import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export async function approveRequest(id: string) {
  const { supabase, user } = await requireOps();
  const { data: r } = await supabase.from("booking_requests").select("*, service:services(id, name_tr, duration_min, buffer_min, price)").eq("id", id).eq("status", "new").single();
  if (!r || !r.service) return;
  const phone = normalizePhone(r.phone);
  let customerId: string | null = null;
  const { data: ex } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
  if (ex) customerId = ex.id;
  else {
    const { data: c } = await supabase.from("customers").insert({ first_name: r.first_name, last_name: r.last_name, phone, email: r.email, locale: r.locale, source: "online" }).select("id").single();
    customerId = c?.id ?? null;
  }
  const visitDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date(r.starts_at));
  let visitId: string | null = null;
  if (customerId) {
    const { data: v } = await supabase.from("visits").select("id").eq("customer_id", customerId).eq("visit_date", visitDate).neq("status", "cancelled").maybeSingle();
    visitId = v?.id ?? null;
  }
  if (!visitId) {
    const { data: v } = await supabase.from("visits").insert({ customer_id: customerId, visit_date: visitDate, status: "confirmed", source: "online", notes: r.notes, created_by: user.id }).select("id").single();
    visitId = v?.id ?? null;
  }
  if (!visitId) return;
  const ends = new Date(new Date(r.starts_at).getTime() + (r.service.duration_min + r.service.buffer_min) * 60000).toISOString();
  const { error } = await supabase.from("visit_items").insert({ visit_id: visitId, service_id: r.service.id, service_name: r.service.name_tr, staff_id: r.staff_id, starts_at: r.starts_at, ends_at: ends, price: Number(r.service.price), status: "confirmed" });
  if (error) return;
  await supabase.from("booking_requests").update({ status: "approved", visit_id: visitId }).eq("id", id);
  revalidatePath("/panel/online"); revalidatePath("/panel/takvim"); revalidatePath("/panel");
}

export async function rejectRequest(id: string) {
  const { supabase } = await requireOps();
  await supabase.from("booking_requests").update({ status: "rejected" }).eq("id", id);
  revalidatePath("/panel/online"); revalidatePath("/panel");
}
