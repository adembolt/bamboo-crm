import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StaffPayScheme } from "@/lib/database.types";
import { workWindows, offBlocks, weekdayOf, toMin, type SchedRow, type DayHourRow, type OffRow } from "@/lib/schedule";
import { addDays, todayIso } from "@/lib/format";

/* Personel hak edişi — DIKIDI maaş şemalarıyla aynı mantık:
   kendi satışları % (hizmet/ürün, indirim ve malzeme düşülebilir) + şirket satışları % + oluşturduğu randevulardan prim %
   + çalıştığı gün başına sabit ücret; günlük garanti varsa gün toplamı garantinin altına düşmez.
   Şeması olmayan personel için eski staff.pay_percent / product_percent kullanılır. */

export type PayLine = { own: number; company: number; booking: number; fixed: number; guarantee: number; total: number; serviceSales: number; productSales: number; days: number; scheme: StaffPayScheme | null };

type Item = { staff_id: string | null; kind: string; qty: number; unit_price: number; total: number; material_cost: number; sale_date: string; author: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function computePayroll(supabase: SupabaseClient<Database>, from: string, to: string): Promise<Map<string, PayLine>> {
  const [{ data: staff }, { data: schemes }, itemsRes, { data: settings }, { data: sched }, { data: dayRows }, { data: offs }] = await Promise.all([
    supabase.from("staff").select("id, pay_percent, product_percent, schedule_mode, is_active"),
    supabase.from("staff_pay_schemes").select("*").order("valid_from", { ascending: false }),
    supabase.from("sale_items").select("staff_id, kind, qty, unit_price, total, material_cost, visit_item:visit_items(booked_by_staff_id), sale:sales!inner(sale_date, visit_id)").gte("sale.sale_date", from).lte("sale.sale_date", to).limit(20000),
    supabase.from("settings").select("open_time, close_time").eq("id", 1).single(),
    supabase.from("staff_schedules").select("staff_id, weekday, start_time, end_time"),
    supabase.from("staff_day_hours").select("staff_id, day, start_time, end_time").gte("day", from).lte("day", to),
    supabase.from("staff_time_off").select("staff_id, starts_at, ends_at").lte("starts_at", `${to}T23:59:59+03:00`).gte("ends_at", `${from}T00:00:00+03:00`),
  ]);

  // Randevuyu oluşturan: DIKIDI'den gelen kalemde booked_by_staff_id; CRM'de ziyareti açan kullanıcının personel kaydı
  type Raw = { staff_id: string | null; kind: string; qty: number; unit_price: number; total: number; material_cost: number; visit_item: { booked_by_staff_id: string | null } | null; sale: { sale_date: string; visit_id: string | null } };
  const raw = (itemsRes.data ?? []) as unknown as Raw[];
  const visitIds = [...new Set(raw.filter((r) => !r.visit_item?.booked_by_staff_id && r.sale.visit_id).map((r) => r.sale.visit_id!))];
  const creatorStaff = new Map<string, string>();
  if (visitIds.length) {
    const { data: vs } = await supabase.from("visits").select("id, created_by").in("id", visitIds.slice(0, 2000));
    const profIds = [...new Set((vs ?? []).map((v) => v.created_by).filter(Boolean) as string[])];
    const { data: profs } = profIds.length ? await supabase.from("profiles").select("id, staff_id").in("id", profIds) : { data: [] };
    const p2s = new Map((profs ?? []).map((p) => [p.id, p.staff_id]));
    for (const v of vs ?? []) { const s = v.created_by ? p2s.get(v.created_by) : null; if (s) creatorStaff.set(v.id, s); }
  }
  const items: Item[] = raw.map((r) => ({
    staff_id: r.staff_id, kind: r.kind, qty: Number(r.qty), unit_price: Number(r.unit_price), total: Number(r.total), material_cost: Number(r.material_cost ?? 0),
    sale_date: r.sale.sale_date, author: r.visit_item?.booked_by_staff_id ?? (r.sale.visit_id ? creatorStaff.get(r.sale.visit_id) ?? null : null),
  })).filter((i) => i.kind === "service" || i.kind === "product" || i.kind === "package");

  const open = toMin(String(settings?.open_time ?? "10:00").slice(0, 5)), close = toMin(String(settings?.close_time ?? "21:00").slice(0, 5));
  const schedRows = (sched ?? []) as SchedRow[], dayHourRows = (dayRows ?? []) as DayHourRow[], offRows = (offs ?? []) as OffRow[];
  const today = todayIso();
  const days: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const schemeFor = (staffId: string, day: string) => (schemes ?? []).find((s) => s.staff_id === staffId && s.valid_from <= day) as StaffPayScheme | undefined;

  const workedCache = new Map<string, boolean>();
  const worked = (staffId: string, mode: string | null, day: string) => {
    const k = `${staffId}|${day}`; if (workedCache.has(k)) return workedCache.get(k)!;
    const w = workWindows(staffId, weekdayOf(day), schedRows, open, close, { mode, date: day, rows: dayHourRows });
    const mins = w.reduce((s, [a, b]) => s + (b - a), 0);
    const off = offBlocks(staffId, day, offRows).reduce((s, o) => s + (o.b - o.a), 0);
    const v = mins > 0 && off < mins; workedCache.set(k, v); return v;
  };

  const byDay = new Map<string, Item[]>();
  for (const i of items) byDay.set(i.sale_date, [...(byDay.get(i.sale_date) ?? []), i]);

  const out = new Map<string, PayLine>();
  for (const s of staff ?? []) {
    const line: PayLine = { own: 0, company: 0, booking: 0, fixed: 0, guarantee: 0, total: 0, serviceSales: 0, productSales: 0, days: 0, scheme: null };
    for (const day of days) {
      const its = byDay.get(day) ?? [];
      const sc = schemeFor(s.id, day);
      if (sc) line.scheme = sc;
      const isWorked = day <= today && worked(s.id, s.schedule_mode, day);
      let dayOwn = 0, dayComp = 0, dayBook = 0, dayFixed = 0;
      for (const i of its) {
        const isProd = i.kind === "product";
        const gross = i.unit_price * i.qty, net = i.total;
        if (i.staff_id === s.id) { if (isProd) line.productSales += net; else line.serviceSales += net; }
        if (!sc) {
          if (i.staff_id === s.id) dayOwn += net * Number(isProd ? s.product_percent : s.pay_percent) / 100;
          continue;
        }
        if (i.staff_id === s.id) {
          const base = isProd ? (sc.product_deduct_discount ? net : gross) : Math.max(0, (sc.service_deduct_discount ? net : gross) - (sc.service_deduct_materials ? i.material_cost : 0));
          dayOwn += base * Number(isProd ? sc.product_percent : sc.service_percent) / 100;
        }
        const cp = Number(isProd ? sc.company_product_percent : sc.company_service_percent);
        if (cp && !(sc.company_exclude_own && i.staff_id === s.id) && (!sc.company_only_on_shift || isWorked)) dayComp += (sc.company_deduct_discount ? net : gross) * cp / 100;
        const bp = Number(isProd ? sc.booking_product_percent : sc.booking_service_percent);
        if (bp && i.author === s.id && !(sc.booking_exclude_own && i.staff_id === s.id)) dayBook += net * bp / 100;
      }
      if (sc && isWorked) dayFixed = Number(sc.daily_wage);
      if (isWorked) line.days++;
      const dayTotal = dayOwn + dayComp + dayBook + dayFixed;
      const g = sc && isWorked && Number(sc.daily_guarantee) > dayTotal ? Number(sc.daily_guarantee) - dayTotal : 0;
      line.own += dayOwn; line.company += dayComp; line.booking += dayBook; line.fixed += dayFixed; line.guarantee += g;
    }
    line.total = r2(line.own + line.company + line.booking + line.fixed + line.guarantee);
    line.own = r2(line.own); line.company = r2(line.company); line.booking = r2(line.booking); line.fixed = r2(line.fixed); line.guarantee = r2(line.guarantee);
    line.serviceSales = r2(line.serviceSales); line.productSales = r2(line.productSales);
    out.set(s.id, line);
  }
  return out;
}
