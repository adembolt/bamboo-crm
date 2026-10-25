"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export async function createCustomer(_prev: { error: string }, formData: FormData) {
  const { supabase } = await requireOps();
  const first = String(formData.get("first_name") ?? "").trim();
  if (!first) return { error: "Ad gerekli." };
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (phone) {
    const { data: ex } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
    if (ex) redirect(`/panel/musteriler/${ex.id}`);
  }
  const birth = String(formData.get("birth_date") ?? "");
  const { data, error } = await supabase
    .from("customers")
    .insert({
      first_name: first,
      last_name: String(formData.get("last_name") ?? "").trim(),
      phone,
      locale: String(formData.get("locale") ?? "tr"),
      source: String(formData.get("source") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      birth_date: birth || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Kaydedilemedi" };
  revalidatePath("/panel/musteriler");
  redirect(`/panel/musteriler/${data.id}`);
}

export async function updateCustomer(id: string, _prev: { error: string; saved?: boolean }, formData: FormData) {
  const { supabase } = await requireOps();
  const birth = String(formData.get("birth_date") ?? "");
  const tags = String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const { error } = await supabase
    .from("customers")
    .update({
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      phone: normalizePhone(String(formData.get("phone") ?? "")),
      email: String(formData.get("email") ?? "").trim(),
      locale: String(formData.get("locale") ?? "tr"),
      gender: String(formData.get("gender") ?? "") as "" | "f" | "m" | "x",
      nationality: String(formData.get("nationality") ?? ""),
      source: String(formData.get("source") ?? ""),
      birth_date: birth || null,
      tags,
      notes: String(formData.get("notes") ?? ""),
      health_notes: String(formData.get("health_notes") ?? ""),
      discount_percent: Number(formData.get("discount_percent") ?? 0) || 0,
      consent_marketing: formData.get("consent_marketing") === "on",
      is_blocked: formData.get("is_blocked") === "on",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/panel/musteriler/${id}`);
  return { error: "", saved: true };
}
