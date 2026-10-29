"use server";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { isLang, LANG_COOKIE } from "@/lib/i18n/core";
import { createClient } from "@/lib/supabase/server";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { getT } from "@/lib/i18n/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/panel");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent((await getT())("E-posta veya şifre hatalı"))}&next=${encodeURIComponent(next)}`);
  }
  // hesaptaki panel dilini bu tarayıcıya uygula
  const { data: p } = await supabase.from("profiles").select("locale").eq("id", data.user.id).maybeSingle();
  if (isLang(p?.locale)) (await cookies()).set(LANG_COOKIE, p.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
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
  if (!email) redirect("/sifremi-unuttum?error=" + encodeURIComponent((await getT())("E-posta gerekli")));
  // implicit akış: bağlantı hangi cihazda açılırsa açılsın çalışır (PKCE aynı tarayıcıyı ister)
  const sb = createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/recover` });
  if (error && (error.status === 429 || /rate|limit|seconds/i.test(error.message)))
    redirect("/sifremi-unuttum?error=" + encodeURIComponent((await getT())("Çok fazla istek yapıldı. Supabase saatte en fazla 2 e-posta gönderiyor; lütfen bir saat sonra tekrar deneyin.")));
  redirect("/sifremi-unuttum?sent=1");
}

/** Oturum açıkken yeni şifre belirler */
export async function setNewPassword(formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  const pw2 = String(formData.get("password2") ?? "");
  if (pw.length < 8) redirect("/sifre-yenile?error=" + encodeURIComponent((await getT())("Şifre en az 8 karakter olmalı")));
  if (pw !== pw2) redirect("/sifre-yenile?error=" + encodeURIComponent((await getT())("Şifreler aynı değil")));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sifremi-unuttum?error=" + encodeURIComponent((await getT())("Bağlantının süresi dolmuş, tekrar isteyin")));
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) redirect("/sifre-yenile?error=" + encodeURIComponent(error.message));
  redirect("/panel?pw=1");
}
