"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** Bugünden başka bir güne/haftaya bakılırken belirgin "Bugüne dön" düğmesi + T kısayolu */
export function TodayButton({ href, diffDays, isWeek }: { href: string; diffDays: number; isWeek: boolean }) {
  const t = useT();
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (e.key === "t" || e.key === "T") { e.preventDefault(); router.push(href); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
  const rel = isWeek
    ? (diffDays > 0 ? t("{n} hafta sonra", { n: Math.round(diffDays / 7) }) : t("{n} hafta önce", { n: Math.round(-diffDays / 7) }))
    : diffDays === 1 ? t("Yarın") : diffDays === -1 ? t("Dün") : diffDays > 0 ? t("{n} gün sonra", { n: diffDays }) : t("{n} gün önce", { n: -diffDays });
  return (
    <>
      <span className={`pill ${diffDays < 0 ? "" : "warn"}`} title={t("Bugüne göre")}>{rel}</span>
      <Link className="btn sm" href={href} title={t("Bugüne dön (kısayol: T)")}>⟲ {t("Bugüne dön")}</Link>
    </>
  );
}
