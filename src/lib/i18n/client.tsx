"use client";
import { createContext, useContext, useMemo } from "react";
import { makeT, type Lang, type TFn } from "./core";

const Ctx = createContext<{ lang: Lang; t: TFn }>({ lang: "tr", t: makeT("tr") });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const v = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx).t;
export const useLang = () => useContext(Ctx).lang;
