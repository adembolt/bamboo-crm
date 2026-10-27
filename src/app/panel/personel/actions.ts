"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

export async function saveStaff(_prev: { error: string; saved?: boolean }, formData: FormData) {
  const { supabase } = await requireManager();
  const id = String(formData.get("id") ?? "");
  const payload = {
    full_name: String(formData.get("full_name") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    color: String(formData.get("color") ?? "#5E9E6C"),
    languages: String(formData.get("languages") ?? "tr").split(",").map((s) => s.trim()).filter(Boolean),
    online_bookable: formData.get("online_bookable") === "on",
    pay_model: String(formData.get("pay_model") ?? "percent") as "daily_prim" | "percent" | "fixed",
    pay_percent: Number(formData.get("pay_percent") ?? 0) || 0,
    product_percent: Number(formData.get("product_percent") ?? 0) || 0,
    is_active: formData.get("is_active") === "on",
  };
  if (!payload.full_name) return { error: "Ad gerekli." };
  const res = id ? await supabase.from("staff").update(payload).eq("id", id) : await supabase.from("staff").insert(payload);
  if (res.error) return { error: res.error.message };
  revalidatePath("/panel/personel");
  revalidatePath("/panel/takvim");
  return { error: "", saved: true };
}

/** Personelin yapabildiği hizmetleri kaydeder (tam liste ile değiştirir) */
export async function setStaffServices(staffId: string, serviceIds: string[]) {
  const { supabase } = await requireManager();
  const ids = [...new Set(serviceIds)].filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const { data: cur } = await supabase.from("staff_services").select("service_id, price_override, duration_override").eq("staff_id", staffId);
  const keep = new Map((cur ?? []).map((r) => [r.service_id, r]));
  const del = (cur ?? []).filter((r) => !ids.includes(r.service_id)).map((r) => r.service_id);
  if (del.length) {
    const { error } = await supabase.from("staff_services").delete().eq("staff_id", staffId).in("service_id", del);
    if (error) return { ok: false as const, error: error.message };
  }
  const add = ids.filter((id) => !keep.has(id)).map((service_id) => ({ staff_id: staffId, service_id }));
  for (let i = 0; i < add.length; i += 500) {
    const { error } = await supabase.from("staff_services").insert(add.slice(i, i + 500));
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath("/panel/personel"); revalidatePath("/panel/takvim");
  return { ok: true as const, count: ids.length };
}
