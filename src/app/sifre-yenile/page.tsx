import { redirect } from "next/navigation";
import { setNewPassword } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { BambooLogo } from "@/components/logo";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Yeni şifre") };
}

export default async function ResetPage({ searchParams }: PageProps<"/sifre-yenile">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sifremi-unuttum?error=" + encodeURIComponent(t("Bağlantının süresi dolmuş, tekrar isteyin")));
  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <form action={setNewPassword} className="panel w-full max-w-sm grid gap-4">
        <div className="flex items-center gap-3">
          <BambooLogo size={48} />
          <div><h1 className="text-xl font-bold">{t("Yeni şifre")}</h1><p className="text-sm text-muted">{user.email}</p></div>
        </div>
        <label className="f">{t("Yeni şifre (en az 8 karakter)")}<span className="inp"><input name="password" type="password" autoComplete="new-password" minLength={8} required /></span></label>
        <label className="f">{t("Yeni şifre (tekrar)")}<span className="inp"><input name="password2" type="password" autoComplete="new-password" minLength={8} required /></span></label>
        {error && <p className="pill bad justify-center">{error}</p>}
        <button className="btn" type="submit">{t("Şifreyi kaydet")}</button>
      </form>
    </main>
  );
}
