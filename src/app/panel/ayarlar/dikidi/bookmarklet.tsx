"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

const SRC = "https://bamboo-crm-tau.vercel.app/dikidi-sync.js";
const code = (token: string, full: boolean) =>
  `javascript:(function(){window.__BAMBOO_TOKEN=${JSON.stringify(token)};window.__BAMBOO_FULL=${full ? 1 : 0};var s=document.createElement('script');s.src='${SRC}?v='+Date.now();document.body.appendChild(s);})();`;

/** React javascript: bağlantılarını engellediği için href DOM'a elle yazılır. */
export function Bookmarklet({ token }: { token: string }) {
  const t = useT();
  const daily = useRef<HTMLAnchorElement>(null);
  const full = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    daily.current?.setAttribute("href", code(token, false));
    full.current?.setAttribute("href", code(token, true));
  }, [token]);
  const stop = (e: React.MouseEvent) => { e.preventDefault(); alert(t("Bu düğme burada değil, DIKIDI sayfasındayken yer imleri çubuğundan tıklanır. Önce yer imleri çubuğuna sürükleyin.")); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a ref={daily} onClick={stop} draggable className="btn" title={t("Yer imleri çubuğuna sürükleyin")}>⇅ {t("Bamboo'ya aktar")}</a>
      <a ref={full} onClick={stop} draggable className="btn ghost sm" title={t("Yer imleri çubuğuna sürükleyin")}>{t("Tam aktarım (Ocak'tan bugüne)")}</a>
      <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(code(token, false)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* yoksay */ } }}>
        {copied ? t("Kopyalandı") : t("Kodu kopyala")}
      </button>
    </div>
  );
}
