import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { BambooLogo } from "@/components/logo";
import { FORMS, isFormKey, type FormData } from "@/lib/forms/schemas";
import { formTx } from "@/lib/forms/i18n";
import { RemoteForm } from "./remote-form";

export const metadata: Metadata = { title: "Bamboo Beauty Lifes", robots: { index: false, follow: false } };

const TXT = {
  tr: { hi: "Merhaba {ad}", sub: "Lütfen formu doldurup en altta imzalayın. Bilgileriniz yalnızca güvenli hizmet için kullanılır.", done: "Teşekkür ederiz, formunuz bize ulaştı. Görüşmek üzere 🌿" },
  en: { hi: "Hello {ad}", sub: "Please fill in the form and sign at the bottom. Your information is used only to provide safe treatment.", done: "Thank you, we have received your form. See you soon 🌿" },
  ru: { hi: "Здравствуйте, {ad}", sub: "Пожалуйста, заполните анкету и подпишите её внизу. Ваши данные используются только для безопасного проведения процедур.", done: "Спасибо, ваша анкета получена. До встречи 🌿" },
};

export default async function RemoteFormPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f]{20,64}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data: f } = await db.from("client_forms").select("form_key, status, data, lang, customer:customers(first_name)").eq("token", token).maybeSingle();
  if (!f || !isFormKey(f.form_key)) notFound();
  const lang = (["tr", "en", "ru"].includes(String(sp.lang)) ? String(sp.lang) : f.lang) as "tr" | "en" | "ru";
  const T = TXT[lang] ?? TXT.tr, tx = formTx(lang);
  const name = (f.customer as { first_name: string } | null)?.first_name ?? "";
  return (
    <main className="flex-1 px-3 py-6" lang={lang}>
      <div className="max-w-2xl mx-auto grid gap-4">
        <header className="flex items-center gap-3"><BambooLogo size={48} /><div><b>Bamboo Beauty Lifes</b><div className="text-xs text-muted">Beauty & Wellness · Marmaris</div></div>
          <nav className="ml-auto flex gap-1 text-xs">{(["tr", "en", "ru"] as const).map((l) => <a key={l} href={`?lang=${l}`} className={`pill ${l === lang ? "good" : ""}`}>{l.toUpperCase()}</a>)}</nav>
        </header>
        <section className="panel grid gap-2">
          <h1 className="text-xl font-bold">{T.hi.replace("{ad}", name)} 🌿</h1>
          <h2 className="font-semibold">{tx(FORMS[f.form_key].title)}</h2>
          {f.status === "pending" ? <p className="text-sm text-muted">{T.sub}</p> : <p className="pill good justify-self-start">{T.done}</p>}
        </section>
        {f.status === "pending" && <RemoteForm token={token} formKey={f.form_key} lang={lang} initialData={f.data as FormData} doneText={T.done} />}
      </div>
    </main>
  );
}
