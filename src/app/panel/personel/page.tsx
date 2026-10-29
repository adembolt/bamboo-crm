import { requireSession } from "@/lib/auth";
import { StaffList } from "./staff-list";
import type { Staff, StaffPayScheme } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";
import { addDays, todayIso, localToIso } from "@/lib/format";

export async function generateMetadata() {
  return { title: (await getT())("Personel") };
}

export default async function StaffPage() {
  const { supabase, profile } = await requireSession();
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);
  const [{ data }, { data: services }, { data: categories }, { data: ss }, { data: sch }, { data: offs }, { data: st }, { data: schemes }] = await Promise.all([
    supabase.from("staff").select("*").order("sort_order").order("full_name"),
    supabase.from("services").select("id, category_id, code, name_tr, name_en, name_ru, duration_min, price").eq("is_active", true).order("sort_order").order("name_tr"),
    supabase.from("service_categories").select("id, name_tr, name_en, name_ru, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("staff_services").select("staff_id, service_id"),
    supabase.from("staff_schedules").select("staff_id, weekday, start_time, end_time"),
    supabase.from("staff_time_off").select("id, staff_id, starts_at, ends_at, reason").gte("ends_at", localToIso(addDays(todayIso(), -30), "00:00")).order("starts_at"),
    supabase.from("settings").select("open_time, close_time, open_days").eq("id", 1).single(),
    canManage ? supabase.from("staff_pay_schemes").select("*") : Promise.resolve({ data: [] }),
  ]);
  const assigned: Record<string, string[]> = {};
  for (const r of ss ?? []) (assigned[r.staff_id] ??= []).push(r.service_id);
  return <StaffList schemes={(schemes ?? []) as StaffPayScheme[]} staff={(data ?? []) as Staff[]} canManage={canManage} services={(services ?? []).map((x) => ({ ...x, price: Number(x.price) }))} categories={categories ?? []} assigned={assigned} hours={{ schedules: sch ?? [], offs: offs ?? [], openTime: st?.open_time ?? "10:00", closeTime: st?.close_time ?? "21:00", openDays: st?.open_days ?? [1, 2, 3, 4, 5, 6, 7] }} />;
}
