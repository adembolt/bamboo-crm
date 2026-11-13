import { addDays, todayIso } from "@/lib/format";

export type PeriodKind = "day" | "week" | "month" | "year" | "custom";
export type Period = { p: PeriodKind; d: string; from: string; to: string };
const iso = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** DIKIDI'deki gibi dönem seçimi: Bugün / Dün / Hafta / Ay / Yıl ve ‹ › ile kaydırma */
export function readPeriod(sp: Record<string, string | string[] | undefined>, def: PeriodKind = "day"): Period {
  const p = (["day", "week", "month", "year", "custom"].includes(String(sp.p)) ? sp.p : def) as PeriodKind;
  const d = iso(sp.d) ?? todayIso();
  if (p === "custom") { const from = iso(sp.from) ?? d, to = iso(sp.to) ?? d; return { p, d, from: from <= to ? from : to, to: from <= to ? to : from }; }
  return { p, d, ...bounds(p, d) };
}
export function bounds(p: PeriodKind, d: string) {
  if (p === "week") { const wd = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; const from = addDays(d, -wd); return { from, to: addDays(from, 6) }; }
  if (p === "month") { const [y, m] = d.split("-").map(Number); return { from: `${d.slice(0, 7)}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }; }
  if (p === "year") return { from: `${d.slice(0, 4)}-01-01`, to: `${d.slice(0, 4)}-12-31` };
  return { from: d, to: d };
}
export function shiftPeriod(p: PeriodKind, d: string, n: number) {
  if (p === "week") return addDays(d, 7 * n);
  if (p === "month") { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); }
  if (p === "year") return `${Number(d.slice(0, 4)) + n}-01-01`;
  return addDays(d, n);
}
