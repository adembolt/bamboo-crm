import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, makeT, type Lang } from "./core";

/** Çerezdeki panel dili (giriş yapılınca hesaptaki dil çereze yazılır) */
export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "tr";
});

export async function getT() {
  return makeT(await getLang());
}
