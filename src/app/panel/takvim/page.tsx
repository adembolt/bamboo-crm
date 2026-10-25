import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadDay, loadServicesForPicker } from "@/lib/queries/calendar";
import { todayIso, addDays, fmtDateLong } from "@/lib/format";
import { DayCalendar } from "./day-calendar";

export const metadata = { title: "Takvim" };

export default async function CalendarPage({ searchParams }: PageProps<"/panel/takvim">) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayIso();
  const { supabase, profile } = await requireSession();
  const [day, picker] = await Promise.all([loadDay(supabase, d), loadServicesForPicker(supabase)]);
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
    </div>
  );
}
