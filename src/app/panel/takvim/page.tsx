import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadDay, loadServicesForPicker } from "@/lib/queries/calendar";
import { todayIso, addDays, fmtDateLong, fmtDate } from "@/lib/format";
import { DayCalendar } from "./day-calendar";
import { CalendarShell } from "./calendar-shell";
import { AppointmentSearch } from "./appointment-search";
import { MiniCalendar, KasaSnapshot } from "./side-panel";
import { loadKasaDay, summarize } from "@/lib/queries/kasa";
import { getT, getLang } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Takvim") };
}

export default async function CalendarPage({ searchParams }: PageProps<"/panel/takvim">) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayIso();
  const isWeek = sp.v === "week";
  // haftalık: pazartesiden pazara
  const wdIdx = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
  const weekStart = addDays(d, -wdIdx);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { supabase, profile } = await requireSession();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const monthStart = d.slice(0, 7) + "-01";
  const monthEnd = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [day, picker, kasa, { data: monthVisits }, { data: ssRows }] = await Promise.all([
    isWeek ? loadDay(supabase, weekStart, weekDates[6]) : loadDay(supabase, d), loadServicesForPicker(supabase), loadKasaDay(supabase, d),
    supabase.from("visits").select("visit_date").gte("visit_date", monthStart).lte("visit_date", monthEnd).neq("status", "cancelled"),
    supabase.from("staff_services").select("staff_id, service_id"),
  ]);
  const staffServices: Record<string, string[]> = {};
  for (const r of ssRows ?? []) (staffServices[r.staff_id] ??= []).push(r.service_id);
  const sum = summarize(kasa.visits, kasa.expenses, Number(kasa.settings.kdv_rate), kasa.otherSales);
  const busyDays = new Set((monthVisits ?? []).map((v) => v.visit_date));
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const wantStaff = typeof sp.s === "string" ? sp.s : "";
  const weekStaffId = day.staff.find((x) => x.id === wantStaff)?.id
    ?? day.staff.map((x) => ({ id: x.id, n: day.items.filter((it) => it.staff_id === x.id && it.status !== "cancelled").length })).sort((a, b) => b.n - a.n)[0]?.id ?? "";
  const step = isWeek ? 7 : 1;
  const q = (dd: string) => `/panel/takvim?d=${dd}${isWeek ? `&v=week&s=${weekStaffId}` : ""}`;
  const title = isWeek ? `${fmtDate(weekDates[0]).slice(0, 5)} – ${fmtDate(weekDates[6])}` : fmtDateLong(d, lang);

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href={q(addDays(d, -step))} aria-label={isWeek ? t("Önceki hafta") : t("Önceki gün")}>‹</Link>
        <h1 className="text-xl font-bold num">{title}</h1>
        <Link className="btn ghost sm" href={q(addDays(d, step))} aria-label={isWeek ? t("Sonraki hafta") : t("Sonraki gün")}>›</Link>
        {(isWeek ? !weekDates.includes(todayIso()) : d !== todayIso()) && <Link className="btn ghost sm" href={q(todayIso())}>{t("Bugün")}</Link>}
        <div className="flex gap-1 bg-sunk p-1 rounded-lg" role="tablist" aria-label={t("Görünüm")}>
          <Link role="tab" aria-selected={!isWeek} href={`/panel/takvim?d=${d}`} className={`px-3 py-1 rounded-md text-sm font-semibold ${!isWeek ? "bg-surface shadow-card" : "text-muted"}`}>{t("Gün")}</Link>
          <Link role="tab" aria-selected={isWeek} href={`/panel/takvim?d=${d}&v=week${weekStaffId ? `&s=${weekStaffId}` : ""}`} className={`px-3 py-1 rounded-md text-sm font-semibold ${isWeek ? "bg-surface shadow-card" : "text-muted"}`}>{t("Hafta")}</Link>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap w-full sm:w-auto">
        <AppointmentSearch />
        <form action="/panel/takvim">
          {isWeek && <><input type="hidden" name="v" value="week" /><input type="hidden" name="s" value={weekStaffId} /></>}
          <span className="inp"><input type="date" name="d" defaultValue={d} /></span>
        </form>
        </div>
      </header>
      <CalendarShell side={<>
          <MiniCalendar date={d} busyDays={busyDays} />
          <KasaSnapshot date={d} gross={sum.gross} byMethod={sum.byMethod} expected={sum.expected} openCount={kasa.visits.filter((v) => !v.sale).length} closedCount={kasa.visits.filter((v) => v.sale).length + kasa.otherSales.length} />
        </>}>
        <DayCalendar
          key={(isWeek ? `w${weekStart}${weekStaffId}` : `d${d}`) + (typeof sp.open === "string" ? sp.open : "")}
          date={d}
          openVisit={typeof sp.open === "string" ? sp.open : undefined}
          week={isWeek && weekStaffId ? { dates: weekDates, staffId: weekStaffId } : undefined}
          staff={day.staff}
          items={day.items}
          timeOff={day.timeOff}
          schedules={day.schedules}
          settings={{ open_time: day.settings.open_time, close_time: day.settings.close_time, slot_minutes: day.settings.slot_minutes }}
          services={picker.services}
          categories={picker.categories}
          staffServices={staffServices}
          canManage={!!profile && ["owner", "manager"].includes(profile.role)}
          canWrite={canWrite}
        />
      </CalendarShell>
    </div>
  );
}
