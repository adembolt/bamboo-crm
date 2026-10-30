"use client";
import { useState } from "react";
import { FormFiller } from "@/components/forms/form-filler";
import { formTx } from "@/lib/forms/i18n";
import type { FormKey, FormData } from "@/lib/forms/schemas";
import { submitRemoteForm } from "./actions";

const ERR: Record<string, Record<string, string>> = {
  tr: { done: "Bu form daha önce gönderildi.", missing: "Lütfen eksik alanları tamamlayın.", link: "Bağlantı geçersiz.", save: "Kaydedilemedi, lütfen tekrar deneyin." },
  en: { done: "This form has already been submitted.", missing: "Please complete the missing fields.", link: "Invalid link.", save: "Could not save, please try again." },
  ru: { done: "Эта анкета уже отправлена.", missing: "Пожалуйста, заполните недостающие поля.", link: "Ссылка недействительна.", save: "Не удалось сохранить, попробуйте ещё раз." },
};

export function RemoteForm({ token, formKey, lang, initialData, doneText }: { token: string; formKey: FormKey; lang: string; initialData: FormData; doneText: string }) {
  const [done, setDone] = useState(false);
  const tx = formTx(lang);
  if (done) return <section className="panel"><p className="font-semibold">{doneText}</p></section>;
  return (
    <FormFiller formKey={formKey} mode="client" tx={tx} initialData={initialData} submitLabel={tx("Formu gönder")}
      onSubmit={async (p) => {
        const r = await submitRemoteForm(token, p.data, p.sig);
        if (r.ok) { setDone(true); window.scrollTo(0, 0); return null; }
        return (ERR[lang] ?? ERR.tr)[r.error] ?? r.error;
      }} />
  );
}
