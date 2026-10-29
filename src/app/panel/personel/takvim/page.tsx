import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT, getLang } from "@/lib/i18n/server";
import { fmtMonthYear, todayIso } from "@/lib/format";
import { MonthGrid } from "./month-grid";

export async function generateMetadata() { return { title: (await getT())("Çalışma takvimi") }; }

function shift(m: string, n: number) { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); }

export default async function MonthSchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const m = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : todayIso().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const days = Array.from({ length: new Date(Date.UTC(y, mo, 0)).getUTCDate() }, (_, i) => `${m}-${String(i + 1).padStart(2, "0")}`);
  const { supabase, profile } = await requireSession();
  const [t, lang] = [await getT(), await getLang()];
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);
  const [{ data: staff }, { data: rows }, { data: sched }, { data: offs }, { data: st }, { data: items }] = await Promise.all([
    supabase.from("staff").select("id, full_name, color, schedule_mode, dikidi_master_id").eq("is_active", true).order("sort_order"),
    supabase.from("staff_day_hours").select("staff_id, day, start_time, end_time").gte("day", days[0]).lte("day", days[days.length - 1]),
    supabase.from("staff_schedules").select("staff_id, weekday, start_time, end_time"),
    supabase.from("staff_time_off").select("staff_id, starts_at, ends_at").lte("starts_at", `${days[days.length - 1]}T23:59:59+03:00`).gte("ends_at", `${days[0]}T00:00:00+03:00`),
    supabase.from("settings").select("open_time, close_time, open_days").eq("id", 1).single(),
    supabase.from("visit_items").select("staff_id, starts_at").gte("starts_at", `${days[0]}T00:00:00+03:00`).lte("starts_at", `${days[days.length - 1]}T23:59:59+03:00`).not("status", "in", "(cancelled,no_show)"),
  ]);
  const count: Record<string, number> = {};
  for (const it of items ?? []) { if (!it.staff_id) continue; const d = new Date(new Date(it.starts_at).getTime() + 3 * 3600e3).toISOString().slice(0, 10); count[`${it.staff_id}|${d}`] = (count[`${it.staff_id}|${d}`] ?? 0) + 1; }
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/personel">← {t("Personel")}</Link>
        <Link className="btn ghost sm" href={`/panel/personel/takvim?m=${shift(m, -1)}`}>‹</Link>
        <h1 className="text-xl font-bold">{t("Çalışma takvimi")} · {fmtMonthYear(days[0], lang)}</h1>
        <Link className="btn ghost sm" href={`/panel/personel/takvim?m=${shift(m, 1)}`}>›</Link>
        {m !== todayIso().slice(0, 7) && <Link className="btn sm" href="/panel/personel/takvim">⟲ {t("Bu ay")}</Link>}
      </header>
      <MonthGrid
        days={days}
        today={todayIso()}
        staff={(staff ?? []).map((s) => ({ id: s.id, full_name: s.full_name, color: s.color, mode: s.schedule_mode, dikidi: !!s.dikidi_master_id }))}
        rows={(rows ?? []).map((r) => ({ ...r, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) }))}
        weekly={(sched ?? []).map((r) => ({ ...r, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) }))}
        offs={offs ?? []}
        salon={{ open: String(st?.open_time ?? "10:00").slice(0, 5), close: String(st?.close_time ?? "21:00").slice(0, 5), days: st?.open_days ?? [1, 2, 3, 4, 5, 6, 7] }}
        counts={count}
        canManage={canManage}
      />
    </div>
  );
}
