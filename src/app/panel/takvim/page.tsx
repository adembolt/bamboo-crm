import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadDay, loadServicesForPicker } from "@/lib/queries/calendar";
import { todayIso, addDays, fmtDateLong } from "@/lib/format";
import { DayCalendar } from "./day-calendar";
import { MiniCalendar, KasaSnapshot } from "./side-panel";
import { loadKasaDay, summarize } from "@/lib/queries/kasa";

export const metadata = { title: "Takvim" };

export default async function CalendarPage({ searchParams }: PageProps<"/panel/takvim">) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayIso();
  const { supabase, profile } = await requireSession();
  const monthStart = d.slice(0, 7) + "-01";
  const monthEnd = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [day, picker, kasa, { data: monthVisits }] = await Promise.all([
    loadDay(supabase, d), loadServicesForPicker(supabase), loadKasaDay(supabase, d),
    supabase.from("visits").select("visit_date").gte("visit_date", monthStart).lte("visit_date", monthEnd).neq("status", "cancelled"),
  ]);
  const sum = summarize(kasa.visits, kasa.expenses, Number(kasa.settings.kdv_rate), kasa.otherSales);
  const busyDays = new Set((monthVisits ?? []).map((v) => v.visit_date));
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href={`/panel/takvim?d=${addDays(d, -1)}`} aria-label="Önceki gün">‹</Link>
        <h1 className="text-xl font-bold capitalize">{fmtDateLong(d)}</h1>
        <Link className="btn ghost sm" href={`/panel/takvim?d=${addDays(d, 1)}`} aria-label="Sonraki gün">›</Link>
        {d !== todayIso() && <Link className="btn ghost sm" href="/panel/takvim">Bugün</Link>}
        <form className="ml-auto" action="/panel/takvim">
          <span className="inp"><input type="date" name="d" defaultValue={d} /></span>
        </form>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_240px] gap-3 items-start">
        <DayCalendar
          date={d}
          staff={day.staff}
          items={day.items}
          timeOff={day.timeOff}
          settings={{ open_time: day.settings.open_time, close_time: day.settings.close_time, slot_minutes: day.settings.slot_minutes }}
          services={picker.services}
          categories={picker.categories}
          canWrite={canWrite}
        />
        <aside className="grid gap-3 lg:sticky lg:top-3 min-w-0">
          <MiniCalendar date={d} busyDays={busyDays} />
          <KasaSnapshot date={d} gross={sum.gross} byMethod={sum.byMethod} expected={sum.expected} openCount={kasa.visits.filter((v) => !v.sale).length} closedCount={kasa.visits.filter((v) => v.sale).length + kasa.otherSales.length} />
        </aside>
      </div>
    </div>
  );
}
