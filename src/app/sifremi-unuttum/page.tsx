import { requestReset } from "@/app/login/actions";
import { BambooLogo } from "@/components/logo";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Şifremi unuttum") };
}

export default async function ForgotPage({ searchParams }: PageProps<"/sifremi-unuttum">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";
  const sent = sp.sent === "1";
  const t = await getT();
  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <form action={requestReset} className="panel w-full max-w-sm grid gap-4">
        <div className="flex items-center gap-3">
          <BambooLogo size={48} />
          <div><h1 className="text-xl font-bold">{t("Şifremi unuttum")}</h1><p className="text-sm text-muted">{t("E-postana yenileme bağlantısı gönderelim.")}</p></div>
        </div>
        {sent ? (
          <p className="pill good justify-center text-center">{t("Kayıtlıysa e-postana bağlantı gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.")}</p>
        ) : (
          <>
            <label className="f">{t("E-posta")}<span className="inp"><input name="email" type="email" autoComplete="email" required /></span></label>
            {error && <p className="pill bad justify-center">{error}</p>}
            <button className="btn" type="submit">{t("Bağlantı gönder")}</button>
          </>
        )}
        <a href="/login" className="text-sm text-center text-muted hover:underline">← {t("Girişe dön")}</a>
      </form>
    </main>
  );
}
