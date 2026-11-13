import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { fmtDate, todayIso, addDays } from "@/lib/format";
import { shiftPeriod, type Period } from "@/lib/period";

/** Sunucu bileşeni: dönem düğmeleri + ‹ tarih › ; diğer filtreler `keep` ile korunur */
export async function PeriodBar({ base, period, keep = {} }: { base: string; period: Period; keep?: Record<string, string | undefined> }) {
  const t = await getT();
  const today = todayIso();
  const url = (p: string, d: string) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(keep)) if (v) u.set(k, v); u.set("p", p); u.set("d", d); return `${base}?${u}`; };
  const btn = (on: boolean) => `px-3 py-1 rounded-md text-sm font-semibold ${on ? "bg-surface shadow-card text-ink" : "text-muted hover:text-ink"}`;
  const label = period.from === period.to ? fmtDate(period.from) : `${fmtDate(period.from)} – ${fmtDate(period.to)}`;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 bg-sunk p-1 rounded-lg">
        <Link className={btn(period.p === "day" && period.d === today)} href={url("day", today)}>{t("Bugün")}</Link>
        <Link className={btn(period.p === "day" && period.d === addDays(today, -1))} href={url("day", addDays(today, -1))}>{t("Dün")}</Link>
        <Link className={btn(period.p === "week")} href={url("week", period.d)}>{t("Hafta")}</Link>
        <Link className={btn(period.p === "month")} href={url("month", period.d)}>{t("Ay")}</Link>
        <Link className={btn(period.p === "year")} href={url("year", period.d)}>{t("Yıl")}</Link>
      </div>
      {period.p !== "custom" && <Link className="btn ghost sm" aria-label={t("Önceki")} href={url(period.p, shiftPeriod(period.p, period.d, -1))}>‹</Link>}
      <span className="text-sm font-semibold num">{label}</span>
      {period.p !== "custom" && <Link className="btn ghost sm" aria-label={t("Sonraki")} href={url(period.p, shiftPeriod(period.p, period.d, 1))}>›</Link>}
    </div>
  );
}
