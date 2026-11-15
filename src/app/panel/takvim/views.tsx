import Link from "next/link";
import type { Staff } from "@/lib/database.types";
import type { DayItem } from "@/lib/queries/calendar";
import { addDays, todayIso, fmtTime, fullName, fmtMonthYear, fmtWeekdayShort, fmtDateLong } from "@/lib/format";
import { getT, getLang } from "@/lib/i18n/server";

const WEEK = Array.from({ length: 7 }, (_, i) => addDays("2024-01-01", i));

/** Ay görünümü: her günde randevu sayısı; güne dokununca gün görünümü açılır */
export async function MonthView({ date, counts }: { date: string; counts: Record<string, number> }) {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const [y, m] = date.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const today = todayIso();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const total = Object.entries(counts).filter(([d]) => d.slice(0, 7) === date.slice(0, 7)).reduce((s, [, n]) => s + n, 0);
  return (
    <section className="panel grid gap-3 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-3">
      <div className="flex items-center justify-between gap-2">
        <Link className="btn ghost sm" href={`/panel/takvim?d=${prev}&v=month`} aria-label={t("Önceki ay")}>‹</Link>
        <div className="text-center"><b className="text-lg">{fmtMonthYear(date, lang)}</b><div className="text-xs text-muted">{t("{n} randevu", { n: total })}</div></div>
        <Link className="btn ghost sm" href={`/panel/takvim?d=${next}&v=month`} aria-label={t("Sonraki ay")}>›</Link>
      </div>
      <div className="grid grid-cols-7 text-center text-[12px] text-muted font-semibold">{WEEK.map((w, i) => <span key={w} className={i >= 5 ? "text-bad" : ""}>{fmtWeekdayShort(w, lang)}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => c ? (
          <Link key={c} href={`/panel/takvim?d=${c}`} aria-label={`${fmtDateLong(c, lang)} · ${t("{n} randevu", { n: counts[c] ?? 0 })}`}
            className={`rounded-xl min-h-[64px] md:min-h-[84px] p-1.5 grid content-between text-left border ${c === date ? "border-[var(--accent,var(--green))] bg-sunk" : "border-line bg-surface hover:bg-sunk"} ${c === today ? "ring-1 ring-[var(--accent,var(--green))]" : ""}`}>
            <span className={`text-[15px] font-semibold num ${i % 7 >= 5 ? "text-bad" : ""}`}>{Number(c.slice(8))}</span>
            {counts[c] ? <span className="justify-self-start rounded-md px-1.5 text-[11px] font-bold num" style={{ background: "var(--sage, var(--green-soft))", color: "var(--sage-ink, var(--green))" }}>{counts[c]}</span> : <span />}
          </Link>
        ) : <span key={`e${i}`} />)}
      </div>
    </section>
  );
}

const STATUS: Record<string, string> = { pending: "Onay bekliyor", confirmed: "Onaylandı", arrived: "Geldi", completed: "Ödendi", no_show: "Gelmedi" };

/** Liste görünümü: seçilen günden başlayarak 7 günün randevuları, saat sırasıyla */
export async function ListView({ date, items, staff }: { date: string; items: DayItem[]; staff: Staff[] }) {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const dayOf = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date(iso));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const live = items.filter((i) => i.status !== "cancelled");
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i)).map((d) => ({ d, its: live.filter((i) => dayOf(i.starts_at) === d) })).filter((x) => x.its.length || x.d === date);
  return (
    <div className="grid gap-4 max-md:px-3">
      {days.map(({ d, its }) => (
        <section key={d} className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted sticky top-0 z-10 py-1 bg-ground">{fmtDateLong(d, lang)}{d === todayIso() ? ` · ${t("Bugün")}` : ""}</h2>
          {its.length === 0 && <div className="panel text-sm text-muted">{t("Bu gün randevu yok.")}</div>}
          {its.map((it) => {
            const c = it.visit.customer, s = it.staff_id ? staffById.get(it.staff_id) : undefined;
            return (
              <Link key={it.id} href={`/panel/takvim?d=${d}&open=${it.visit_id}`} className="rounded-2xl p-3 grid gap-0.5 border-l-4" style={{ background: "var(--sage, var(--green-soft))", color: "var(--sage-ink, var(--ink))", borderColor: s?.color ?? "transparent" }}>
                <div className="flex items-center justify-between gap-2 text-[13px] num font-medium"><span>{fmtTime(it.starts_at)} – {fmtTime(it.ends_at)}</span><span className="text-[11px] opacity-80">{t(STATUS[it.status] ?? it.status)}</span></div>
                <b className="text-[16px] leading-tight">{c ? fullName(c) : t("Müşteri yok")}</b>
                {c?.phone && <span className="text-[13px] num opacity-90">{c.phone}</span>}
                <span className="text-[13px] opacity-90 line-clamp-2">{it.service_name}</span>
                <span className="text-[12px] opacity-80">{s?.full_name ?? t("Atanmamış")}</span>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
