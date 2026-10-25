"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

export async function setServiceOnline(id: string, online: boolean) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("services").update({ online_visible: online }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/hizmetler");
  return { ok: true as const };
}

export async function setServicesOnlineBulk(ids: string[], online: boolean) {
  const { supabase } = await requireManager();
  if (!ids.length) return { ok: true as const };
  const { error } = await supabase.from("services").update({ online_visible: online }).in("id", ids);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/hizmetler");
  return { ok: true as const };
}

export async function setCategoryOnline(id: string, online: boolean) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("service_categories").update({ online_visible: online }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/hizmetler");
  return { ok: true as const };
}

export async function setServiceActive(id: string, active: boolean) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("services").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/hizmetler");
  return { ok: true as const };
}

export async function saveService(_prev: { error: string; saved?: boolean }, formData: FormData) {
  const { supabase } = await requireManager();
  const id = String(formData.get("id") ?? "");
  const payload = {
    category_id: String(formData.get("category_id") ?? "") || null,
    code: String(formData.get("code") ?? "").trim() || null,
    name_tr: String(formData.get("name_tr") ?? "").trim(),
    name_en: String(formData.get("name_en") ?? "").trim(),
    name_ru: String(formData.get("name_ru") ?? "").trim(),
    description_tr: String(formData.get("description_tr") ?? ""),
    duration_min: Math.max(5, Number(formData.get("duration_min") ?? 60) || 60),
    buffer_min: Math.max(0, Number(formData.get("buffer_min") ?? 0) || 0),
    price: Number(formData.get("price") ?? 0) || 0,
    session_count: Math.max(1, Number(formData.get("session_count") ?? 1) || 1),
    kind: (String(formData.get("kind") ?? "service") as "service" | "package" | "consultation" | "product_like"),
    online_visible: formData.get("online_visible") === "on",
    requires_consultation: formData.get("requires_consultation") === "on",
    is_active: formData.get("is_active") !== "off",
  };
  if (!payload.name_tr) return { error: "Türkçe ad gerekli." };
  const res = id
    ? await supabase.from("services").update(payload).eq("id", id)
    : await supabase.from("services").insert(payload);
  if (res.error) return { error: res.error.message };
  revalidatePath("/panel/hizmetler");
  return { error: "", saved: true };
}
