/* Panel çeviri çekirdeği. Anahtar = Türkçe metnin kendisi; sözlükte yoksa Türkçe gösterilir.
   Değişken: t("{n} kişi", { n: 3 }) */
import { DICT } from "./dict";

export type Lang = "tr" | "en" | "ru";
export const LANGS: { key: Lang; label: string; short: string }[] = [
  { key: "tr", label: "Türkçe", short: "TR" },
  { key: "en", label: "English", short: "EN" },
  { key: "ru", label: "Русский", short: "RU" },
];
export const LANG_COOKIE = "ui_lang";
export const isLang = (v: unknown): v is Lang => v === "tr" || v === "en" || v === "ru";
export const INTL: Record<Lang, string> = { tr: "tr-TR", en: "en-GB", ru: "ru-RU" };

export type TFn = (s: string, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): TFn {
  return (s, vars) => {
    let out = s;
    if (lang !== "tr") {
      const e = DICT[s];
      if (e) out = (lang === "en" ? e[0] : e[1]) || s;
      else if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") console.debug("[i18n] eksik:", s);
    }
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return out;
  };
}

/** Veritabanındaki çok dilli ad: name_en / name_ru doluysa onu, yoksa name_tr */
export function localName(o: { name_tr: string; name_en?: string | null; name_ru?: string | null }, lang: Lang) {
  return (lang === "en" ? o.name_en : lang === "ru" ? o.name_ru : null) || o.name_tr;
}
