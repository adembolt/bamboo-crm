"use client";
import { useState } from "react";
import { saveTemplates } from "./actions";
import { KINDS, type MsgLocale } from "@/lib/messages";

const LOCALES: { key: MsgLocale; label: string }[] = [{ key: "tr", label: "Türkçe" }, { key: "en", label: "English" }, { key: "ru", label: "Русский" }];

export function TemplateEditor({ templates, vars }: { templates: { kind: string; locale: MsgLocale; body: string }[]; vars: string[] }) {
  const [kind, setKind] = useState(KINDS[0].key as string);
  const get = (k: string, l: MsgLocale) => templates.find((t) => t.kind === k && t.locale === l)?.body ?? "";
  return (
    <section id="sablonlar" className="panel grid gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-bold">Mesaj şablonları</h2>
        <div className="flex gap-1 bg-sunk p-1 rounded-lg">{KINDS.map((k) => <button key={k.key} type="button" onClick={() => setKind(k.key)} className={`px-3 py-1 rounded-md text-sm font-semibold ${kind === k.key ? "bg-surface shadow-card" : "text-muted"}`}>{k.label}</button>)}</div>
      </div>
      <p className="text-xs text-muted">Değişkenler: {vars.map((v) => <code key={v} className="mr-2">{v}</code>)}. Müşterinin dili yoksa telefon koduna göre seçilir (+90 TR, +7 RU, diğer EN).</p>
      <form action={saveTemplates} className="grid gap-3">
        {KINDS.map((k) => LOCALES.map((l) => (
          <label key={`${k.key}:${l.key}`} className={`f ${k.key === kind ? "" : "hidden"}`}>{l.label}
            <textarea name={`tpl:${k.key}:${l.key}`} defaultValue={get(k.key, l.key)} rows={3} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          </label>
        )))}
        <div><button className="btn">Şablonları kaydet</button></div>
      </form>
    </section>
  );
}
