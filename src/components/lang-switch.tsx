"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLang } from "@/lib/i18n/actions";
import { LANGS } from "@/lib/i18n/core";
import { useLang, useT } from "@/lib/i18n/client";

/** TR / EN / RU — seçim kullanıcının hesabına kaydedilir */
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useLang(), t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t("Panel dili")} className={`flex gap-0.5 bg-sunk p-0.5 rounded-lg ${pending ? "opacity-60" : ""} ${className}`}>
      {LANGS.map((l) => (
        <button key={l.key} type="button" title={l.label} aria-pressed={lang === l.key} disabled={pending}
          onClick={() => lang !== l.key && start(async () => { await setLang(l.key); router.refresh(); })}
          className={`flex-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${lang === l.key ? "bg-surface shadow-card text-ink" : "text-muted hover:text-ink"}`}>{l.short}</button>
      ))}
    </div>
  );
}
