/* Personel çalışma saatleri: takvim ve online randevu aynı kuralı kullanır.
   - Personelin hiç haftalık programı yoksa: salonun açık olduğu saatler (eski davranış)
   - Programı var ama o gün satırı yoksa: o gün çalışmıyor
   - İzin/özel kapalı saatler (staff_time_off) gün sınırlarına kırpılır */
import { minutesOfDay } from "./format";

export type SchedRow = { staff_id: string; weekday: number; start_time: string; end_time: string };
export type OffRow = { staff_id: string; starts_at: string; ends_at: string; reason?: string };

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

/** ISO hafta günü: 1 = Pazartesi … 7 = Pazar (İstanbul) */
export function weekdayOf(isoDate: string) { const w = new Date(isoDate + "T12:00:00+03:00").getUTCDay(); return w === 0 ? 7 : w; }

export function workWindows(staffId: string, weekday: number, schedules: SchedRow[], openMin: number, closeMin: number): [number, number][] {
  const mine = schedules.filter((s) => s.staff_id === staffId);
  if (!mine.length) return [[openMin, closeMin]];
  return mine.filter((s) => s.weekday === weekday).map((s) => [toMin(s.start_time), toMin(s.end_time)] as [number, number]).sort((a, b) => a[0] - b[0]);
}

/** O güne düşen izin blokları (dakika), çok günlük izinler gün başı/sonuna kırpılır */
export function offBlocks(staffId: string, isoDate: string, offs: OffRow[]): { a: number; b: number; reason: string }[] {
  const dayStart = new Date(`${isoDate}T00:00:00+03:00`).getTime(), dayEnd = dayStart + 24 * 60 * 60000;
  return offs.filter((o) => o.staff_id === staffId).flatMap((o) => {
    const s = new Date(o.starts_at).getTime(), e = new Date(o.ends_at).getTime();
    if (e <= dayStart || s >= dayEnd) return [];
    const a = s <= dayStart ? 0 : minutesOfDay(o.starts_at), b = e >= dayEnd ? 1440 : minutesOfDay(o.ends_at);
    return b > a ? [{ a, b, reason: o.reason ?? "" }] : [];
  });
}

/** Çalışılmayan aralıklar (gri gösterilecek): [openMin, closeMin] içinde pencerelerin dışı */
export function offHours(windows: [number, number][], openMin: number, closeMin: number): [number, number][] {
  const out: [number, number][] = []; let cur = openMin;
  for (const [a, b] of windows) { if (a > cur) out.push([cur, Math.min(a, closeMin)]); cur = Math.max(cur, b); }
  if (cur < closeMin) out.push([cur, closeMin]);
  return out.filter(([a, b]) => b > a);
}

export function isWorking(minStart: number, minEnd: number, windows: [number, number][], offs: { a: number; b: number }[]) {
  return windows.some(([a, b]) => minStart >= a && minEnd <= b) && !offs.some((o) => minStart < o.b && minEnd > o.a);
}
