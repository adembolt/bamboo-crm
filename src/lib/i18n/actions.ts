"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { isLang, LANG_COOKIE } from "./core";

/** Kullanıcının panel dilini değiştirir: çereze + hesabına (profiles.locale) yazar */
export async function setLang(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const s = await getSession();
  if (s) await s.supabase.from("profiles").update({ locale: lang }).eq("id", s.user.id);
  revalidatePath("/", "layout");
}
