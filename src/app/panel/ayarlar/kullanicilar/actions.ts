"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database.types";

const ROLES: AppRole[] = ["owner", "manager", "reception", "staff"];

async function guard(role: AppRole) {
  const s = await requireManager();
  // sadece sahip başka birini sahip/yönetici yapabilir
  if ((role === "owner" || role === "manager") && s.profile?.role !== "owner") throw new Error("Sadece işletme sahibi yönetici atayabilir.");
  return s;
}

export async function inviteUser(i: { email: string; name: string; role: AppRole; staffId: string | null }) {
  if (!ROLES.includes(i.role)) return { ok: false as const, error: "role" };
  await guard(i.role);
  const email = i.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, error: "E-posta geçersiz." };
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: i.name.trim() }, redirectTo: `${origin}/auth/recover` });
  if (error || !data.user) return { ok: false as const, error: error?.message ?? "invite" };
  await admin.from("profiles").update({ full_name: i.name.trim() || email.split("@")[0], role: i.role, staff_id: i.staffId }).eq("id", data.user.id);
  revalidatePath("/panel/ayarlar/kullanicilar");
  return { ok: true as const };
}

export async function updateUser(i: { id: string; role: AppRole; staffId: string | null; name: string }) {
  if (!ROLES.includes(i.role)) return { ok: false as const, error: "role" };
  const s = await guard(i.role);
  if (i.id === s.user.id && i.role !== s.profile?.role) return { ok: false as const, error: "Kendi rolünüzü değiştiremezsiniz." };
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", i.id).single();
  if (target?.role === "owner" && s.profile?.role !== "owner") return { ok: false as const, error: "Sahibin ayarlarını sadece sahip değiştirebilir." };
  const { error } = await admin.from("profiles").update({ role: i.role, staff_id: i.staffId, full_name: i.name.trim() }).eq("id", i.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/ayarlar/kullanicilar");
  return { ok: true as const };
}

export async function setUserBlocked(id: string, blocked: boolean) {
  const s = await requireManager();
  if (id === s.user.id) return { ok: false as const, error: "Kendi erişiminizi kapatamazsınız." };
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "owner") return { ok: false as const, error: "Sahibin erişimi kapatılamaz." };
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: blocked ? "876000h" : "none" });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/ayarlar/kullanicilar");
  return { ok: true as const };
}

export async function sendPasswordReset(email: string) {
  await requireManager();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const admin = createAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/recover` });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
