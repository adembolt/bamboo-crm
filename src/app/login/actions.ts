"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/panel");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent("E-posta veya şifre hatalı")}&next=${encodeURIComponent(next)}`);
  }
  redirect(next.startsWith("/") ? next : "/panel");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "bamboo-crm-tau.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Şifre sıfırlama e-postası gönderir (kayıtlı olmasa da aynı mesajı gösterir) */
export async function requestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/sifremi-unuttum?error=" + encodeURIComponent("E-posta gerekli"));
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=/sifre-yenile` });
  redirect("/sifremi-unuttum?sent=1");
}

/** Oturum açıkken yeni şifre belirler */
export async function setNewPassword(formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  const pw2 = String(formData.get("password2") ?? "");
  if (pw.length < 8) redirect("/sifre-yenile?error=" + encodeURIComponent("Şifre en az 8 karakter olmalı"));
  if (pw !== pw2) redirect("/sifre-yenile?error=" + encodeURIComponent("Şifreler aynı değil"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sifremi-unuttum?error=" + encodeURIComponent("Bağlantının süresi dolmuş, tekrar isteyin"));
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) redirect("/sifre-yenile?error=" + encodeURIComponent(error.message));
  redirect("/panel?pw=1");
}
