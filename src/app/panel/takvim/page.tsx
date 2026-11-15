import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadDay, loadServicesForPicker } from "@/lib/queries/calendar";
import { todayIso, addDays, fmtDateLong, fmtDate } from "@/lib/format";
import { DayCalendar } from "./day-calendar";
import { TodayButton } from "./today-button";
import { FreeSlotFinder } from "./free-slots";
import { CalendarShell } from "./calendar-shell";
import { AppointmentSearch } from "./appointment-search";
import { MiniCalendar, KasaSnapshot } from "./side-panel";
import { MobileCalHeader, MobileFabs } from "./mobile-header";
import { MonthView, ListView } from "./views";
import { money } from "@/lib/format";
import { loadKasaDay, summarize } from "@/lib/queries/kasa";
import { getT, getLang } from "@/lib/i18n/server";
import { weekdayOf } from "@/lib/schedule";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Takvim") };
}

export default async function CalendarPage({ searchParams }: PageProps<"/panel/takvim">) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayIso();
  const isWeek = sp.v === "week";
  const view = isWeek ? "week" as const : sp.v === "month" ? "month" as const : sp.v === "list" ? "list" as const : "day" as const;
  // haftalık: pazartesiden pazara
  const wdIdx = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
  const weekStart = addDays(d, -wdIdx);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { supabase, profile } = await requireSession();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const monthStart = d.slice(0, 7) + "-01";
  const monthEnd = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [day, picker, kasa, { data: monthVisits }, { data: ssRows }] = await Promise.all([
    isWeek ? loadDay(supabase, weekStart, weekDates[6]) : view === "list" ? loadDay(supabase, d, addDays(d, 6)) : loadDay(supabase, d), loadServicesForPicker(supabase), loadKasaDay(supabase, d),
    supabase.from("visits").select("visit_date").gte("visit_date", monthStart).lte("visit_date", monthEnd).neq("status", "cancelled"),
    supabase.from("staff_services").select("staff_id, service_id, price_override, duration_override"),
  ]);
  // "Personel" rolündeki kullanıcı (DIKIDI'deki "sadece görüntüleme") sadece kendi sütununu görür
  if (profile?.role === "staff" && profile.staff_id) {
    day.staff = day.staff.filter((x) => x.id === profile.staff_id);
    day.items = day.items.filter((x) => x.staff_id === profile.staff_id);
  }
  const staffServices: Record<string, string[]> = {};
  const overrides: Record<string, { p: number | null; d: number | null }> = {};
  for (const r of ssRows ?? []) {
    (staffServices[r.staff_id] ??= []).push(r.service_id);
    if (r.price_override !== null || r.duration_override !== null) overrides[`${r.staff_id}:${r.service_id}`] = { p: r.price_override === null ? null : Number(r.price_override), d: r.duration_override };
  }
  const sum = summarize(kasa.visits, kasa.expenses, Number(kasa.settings.kdv_rate), kasa.otherSales);
  const busyDays = new Set((monthVisits ?? []).map((v) => v.visit_date));
  const counts: Record<string, number> = {};
  for (const v of monthVisits ?? []) counts[v.visit_date] = (counts[v.visit_date] ?? 0) + 1;
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const wantStaff = typeof sp.s === "string" ? sp.s : "";
  const weekStaffId = day.staff.find((x) => x.id === wantStaff)?.id
    ?? day.staff.map((x) => ({ id: x.id, n: day.items.filter((it) => it.staff_id === x.id && it.status !== "cancelled").length })).sort((a, b) => b.n - a.n)[0]?.id ?? "";
  const step = isWeek || view === "list" ? 7 : 1;
  const q = (dd: string) => `/panel/takvim?d=${dd}${isWeek ? `&v=week&s=${weekStaffId}` : view === "list" ? "&v=list" : ""}`;
  const title = isWeek ? `${fmtDate(weekDates[0]).slice(0, 5)} – ${fmtDate(weekDates[6])}` : fmtDateLong(d, lang);

  const today = todayIso();
  const viewQ = view === "day" ? "" : view === "week" ? `&v=week&s=${weekStaffId}` : `&v=${view}`;
  const backHref = (view === "week" ? !weekDates.includes(today) : view === "month" ? d.slice(0, 7) !== today.slice(0, 7) : d !== today) ? `/panel/takvim?d=${today}${viewQ}` : undefined;
  const tab = (v: string, label: string, href: string) => <Link role="tab" aria-selected={view === v} href={href} className={`px-3 py-1 rounded-md text-sm font-semibold ${view === v ? "bg-surface shadow-card" : "text-muted"}`}>{label}</Link>;
  const more = (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {canWrite && <FreeSlotFinder date={d} services={picker.services.map((s) => ({ ...s, price: Number(s.price) }))} staff={day.staff.map((s) => ({ id: s.id, full_name: s.full_name, color: s.color }))} staffServices={staffServices} />}
        <AppointmentSearch />
      </div>
      <Link className="btn ghost justify-start" href={view === "week" ? `/panel/takvim?d=${d}` : `/panel/takvim?d=${d}&v=week${weekStaffId ? `&s=${weekStaffId}` : ""}`}>{view === "week" ? t("Gün görünümü") : t("Hafta görünümü (tek uzman)")}</Link>
      {backHref && <Link className="btn ghost justify-start" href={backHref}>⟲ {t("Bugüne dön")}</Link>}
      <Link className="btn ghost justify-start" href={`/panel/kasa?d=${d}`}>₺ {t("Kasa")} · <span className="num">{money(sum.gross)}</span>{sum.expected > 0 && <span className="text-muted num"> · {t("Bekleyen")} {money(sum.expected)}</span>}</Link>
      <Link className="btn ghost justify-start" href="/panel/online">{t("Online randevu talepleri")}</Link>
    </div>
  );

  return (
    <div className="mcal grid gap-4 max-md:-mx-3 max-md:-mt-3 max-md:gap-3 max-md:min-h-[100dvh] max-md:pb-2">
      <MobileCalHeader date={d} view={view} today={today} more={more} />
      <MobileFabs backHref={backHref} canWrite={canWrite} view={view} date={d} />
      <header className="max-md:hidden flex items-center gap-3 flex-wrap">
        {view !== "month" && <Link className="btn ghost sm" href={q(addDays(d, -step))} aria-label={isWeek ? t("Önceki hafta") : t("Önceki gün")}>‹</Link>}
        {view !== "month" && <h1 className="text-xl font-bold num">{title}</h1>}
        {view !== "month" && <Link className="btn ghost sm" href={q(addDays(d, step))} aria-label={isWeek ? t("Sonraki hafta") : t("Sonraki gün")}>›</Link>}
        {view !== "month" && (isWeek ? !weekDates.includes(todayIso()) : d !== todayIso()) && <TodayButton href={q(todayIso())} isWeek={isWeek} diffDays={Math.round((new Date(`${isWeek ? weekDates[0] : d}T12:00:00Z`).getTime() - new Date(`${isWeek ? addDays(todayIso(), 1 - weekdayOf(todayIso())) : todayIso()}T12:00:00Z`).getTime()) / 86400000)} />}
        <div className="flex gap-1 bg-sunk p-1 rounded-lg" role="tablist" aria-label={t("Görünüm")}>
          {tab("day", t("Gün"), `/panel/takvim?d=${d}`)}
          {tab("week", t("Hafta"), `/panel/takvim?d=${d}&v=week${weekStaffId ? `&s=${weekStaffId}` : ""}`)}
          {tab("month", t("Ay"), `/panel/takvim?d=${d}&v=month`)}
          {tab("list", t("Liste"), `/panel/takvim?d=${d}&v=list`)}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap w-full sm:w-auto">
        {canWrite && <FreeSlotFinder date={d} services={picker.services.map((s) => ({ ...s, price: Number(s.price) }))} staff={day.staff.map((s) => ({ id: s.id, full_name: s.full_name, color: s.color }))} staffServices={staffServices} />}
        <AppointmentSearch />
        <form action="/panel/takvim">
          {isWeek && <><input type="hidden" name="v" value="week" /><input type="hidden" name="s" value={weekStaffId} /></>}
          {(view === "month" || view === "list") && <input type="hidden" name="v" value={view} />}
          <span className="inp"><input type="date" name="d" defaultValue={d} /></span>
        </form>
        </div>
      </header>
      {view === "month" ? <MonthView date={d} counts={counts} /> : view === "list" ? <ListView date={d} items={day.items} staff={day.staff} /> : <CalendarShell side={<>
          <MiniCalendar date={d} busyDays={busyDays} />
          <KasaSnapshot date={d} gross={sum.gross} byMethod={sum.byMethod} expected={sum.expected} openCount={kasa.visits.filter((v) => !v.sale).length} closedCount={kasa.visits.filter((v) => v.sale).length + kasa.otherSales.length} />
        </>}>
        <DayCalendar
          key={(isWeek ? `w${weekStart}${weekStaffId}` : `d${d}`) + (typeof sp.open === "string" ? sp.open : "") + (typeof sp.new === "string" ? sp.new : "") + (sp.add === "1" ? "a" : "")}
          date={d}
          openVisit={typeof sp.open === "string" ? sp.open : undefined}
          newDraft={typeof sp.new === "string" && /^[0-9a-f-]{36}~\d{2}:\d{2}~[0-9a-f-]{36}$/.test(sp.new) ? { staffId: sp.new.split("~")[0], startHHMM: sp.new.split("~")[1], serviceId: sp.new.split("~")[2] } : undefined}
          week={isWeek && weekStaffId ? { dates: weekDates, staffId: weekStaffId } : undefined}
          staff={day.staff}
          items={day.items}
          timeOff={day.timeOff}
          schedules={day.schedules}
          dayHours={day.dayHours}
          settings={{ open_time: day.settings.open_time, close_time: day.settings.close_time, slot_minutes: day.settings.slot_minutes }}
          services={picker.services}
          categories={picker.categories}
          staffServices={staffServices}
          overrides={overrides}
          canManage={!!profile && ["owner", "manager"].includes(profile.role)}
          canWrite={canWrite}
          autoNew={sp.add === "1"}
        />
      </CalendarShell>}
    </div>
  );
}
