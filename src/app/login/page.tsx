import { login } from "./actions";
import { BambooLogo } from "@/components/logo";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Giriş") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";
  const next = typeof sp.next === "string" ? sp.next : "/panel";
  const t = await getT();

  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <form action={login} className="panel w-full max-w-sm grid gap-4">
        <div className="flex items-center gap-3">
          <BambooLogo size={48} />
          <div>
            <h1 className="text-xl font-bold">Bamboo Panel</h1>
            <p className="text-sm text-muted">Bamboo Beauty Lifes · Beauty &amp; Wellness</p>
          </div>
        </div>
        <input type="hidden" name="next" value={next} />
        <label className="f">{t("E-posta")}
          <span className="inp"><input name="email" type="email" autoComplete="email" required /></span>
        </label>
        <label className="f">{t("Şifre")}
          <span className="inp"><input name="password" type="password" autoComplete="current-password" required /></span>
        </label>
        {error && <p className="pill bad justify-center">{error}</p>}
        <button className="btn" type="submit">{t("Giriş yap")}</button>
        <a href="/sifremi-unuttum" className="text-sm text-center text-green font-semibold hover:underline">{t("Şifremi unuttum")}</a>
      </form>
    </main>
  );
}
