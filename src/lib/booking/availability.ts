import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { localToIso, minutesOfDay, hhmm, todayIso } from "@/lib/format";
import { toMin, weekdayOf, workWindows, offBlocks } from "@/lib/schedule";

export type Slot = { time: string; staffIds: string[] };


/**
 * Bir gün için uygun saatleri hesaplar.
 * - settings.open_days / open_time / close_time temel pencere
 * - staff_schedules varsa personelin o günkü saatleri
 * - staff_time_off ve mevcut visit_items düşülür
 * - online_min_notice_minutes ve online_max_days_ahead uygulanır
 */
export async function getSlots(opts: { serviceId: string; staffId: string | null; date: string }): Promise<{ slots: Slot[]; error?: string }> {
  const db = createAdminClient();
  const [{ data: settings }, { data: service }] = await Promise.all([
    db.from("settings").select("*").eq("id", 1).single(),
    db.from("services").select("id, duration_min, buffer_min, is_active, online_visible").eq("id", opts.serviceId).maybeSingle(),
  ]);
  if (!settings || !settings.online_booking_enabled) return { slots: [], error: "closed" };
  if (!service || !service.is_active || !service.online_visible) return { slots: [], error: "service" };

  const today = todayIso();
  const maxDate = new Date(today + "T12:00:00Z"); maxDate.setUTCDate(maxDate.getUTCDate() + settings.online_max_days_ahead);
  if (opts.date < today || opts.date > maxDate.toISOString().slice(0, 10)) return { slots: [] };
  const wd = weekdayOf(opts.date);
  if (!settings.open_days.includes(wd)) return { slots: [] };

  let staffQ = db.from("staff").select("id, schedule_mode").eq("is_active", true).eq("online_bookable", true);
  if (opts.staffId) staffQ = staffQ.eq("id", opts.staffId);
  const { data: staffRows } = await staffQ;
  const staffIds = (staffRows ?? []).map((s) => s.id);
  if (!staffIds.length) return { slots: [] };

  // Personel ↔ hizmet eşlemesi varsa daralt
  const { data: ss } = await db.from("staff_services").select("staff_id").eq("service_id", service.id).in("staff_id", staffIds);
  const mapped = (ss ?? []).map((r) => r.staff_id);
  const candidates = mapped.length ? staffIds.filter((id) => mapped.includes(id)) : staffIds;

  const dayStart = localToIso(opts.date, "00:00");
  const dayEnd = localToIso(opts.date, "23:59");
  const [{ data: schedules }, { data: offs }, { data: busy }, { data: dayHours }] = await Promise.all([
    db.from("staff_schedules").select("staff_id, weekday, start_time, end_time").in("staff_id", candidates),
    db.from("staff_time_off").select("staff_id, starts_at, ends_at").in("staff_id", candidates).lte("starts_at", dayEnd).gte("ends_at", dayStart),
    db.from("visit_items").select("staff_id, starts_at, ends_at").in("staff_id", candidates).gte("starts_at", dayStart).lte("starts_at", dayEnd).not("status", "in", "(cancelled,no_show)"),
    db.from("staff_day_hours").select("staff_id, day, start_time, end_time").in("staff_id", candidates).eq("day", opts.date),
  ]);
  // Onay bekleyen online talepler de yer kaplasın (çifte rezervasyon olmasın)
  const { data: pendingReq } = await db.from("booking_requests").select("staff_id, starts_at, service:services(duration_min, buffer_min)").eq("status", "new").gte("starts_at", dayStart).lte("starts_at", dayEnd);

  const need = service.duration_min + service.buffer_min;
  const step = settings.slot_minutes;
  const openMin = toMin(settings.open_time), closeMin = toMin(settings.close_time);
  const nowMin = opts.date === today ? minutesOfDay(new Date().toISOString()) + settings.online_min_notice_minutes : -1;

  const slots = new Map<string, string[]>();
  for (const sid of candidates) {
    const mode = (staffRows ?? []).find((x) => x.id === sid)?.schedule_mode;
    const windows = workWindows(sid, wd, schedules ?? [], openMin, closeMin, { mode, date: opts.date, rows: dayHours ?? [] });
    const blocks: [number, number][] = [
      ...offBlocks(sid, opts.date, offs ?? []).map((o) => [o.a, o.b] as [number, number]),
      ...(busy ?? []).filter((b) => b.staff_id === sid).map((b) => [minutesOfDay(b.starts_at), minutesOfDay(b.ends_at)] as [number, number]),
      ...(pendingReq ?? []).filter((r) => r.staff_id === sid || r.staff_id === null).map((r) => { const a = minutesOfDay(r.starts_at); return [a, a + ((r.service?.duration_min ?? 60) + (r.service?.buffer_min ?? 0))] as [number, number]; }),
    ];
    for (const [ws, we] of windows) {
      for (let t = Math.ceil(ws / step) * step; t + need <= Math.min(we, closeMin); t += step) {
        if (t < openMin || t <= nowMin) continue;
        const clash = blocks.some(([a, b]) => t < b && t + need > a);
        if (clash) continue;
        const key = hhmm(t);
        slots.set(key, [...(slots.get(key) ?? []), sid]);
      }
    }
  }
  return { slots: [...slots.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, staffIds]) => ({ time, staffIds })) };
}
