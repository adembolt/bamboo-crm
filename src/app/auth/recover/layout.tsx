import { LangProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";

/* Panel dışında: istemci sayfası useT() kullanabilsin diye dil sağlayıcı */
export default async function RecoverLayout({ children }: { children: React.ReactNode }) {
  return <LangProvider lang={await getLang()}>{children}</LangProvider>;
}
