import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Staff, VisitStatus, VisitSource } from "@/lib/database.types";

export type DayItem = {
  id: string;
  visit_id: string;
  service_id: string | null;
  service_name: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  price: number;
  discount: number;
  status: VisitStatus;
  notes: string;
  break_min: number;
  visit: {
    id: string;
    color: string;
    status: VisitStatus;
    source: VisitSource;
    notes: string;
    discount_percent: number;
    customer: { id: string; first_name: string; last_name: string; phone: string; tags: string[]; no_show_count: number } | null;
  };
};

export async function loadDay(supabase: SupabaseClient<Database>, isoDate: string) {
  const dayStart = new Date(`${isoDate}T00:00:00+03:00`).toISOString();
  const dayEnd = new Date(`${isoDate}T23:59:59+03:00`).toISOString();

  const [staffRes, itemsRes, settingsRes, timeOffRes, schedRes] = await Promise.all([
    supabase.from("staff").select("*").eq("is_active", true).order("sort_order").order("full_name"),
    supabase
      .from("visit_items")
      .select(
        "id, visit_id, service_id, service_name, staff_id, starts_at, ends_at, price, discount, status, notes, break_min, visit:visits!inner(id, color, status, source, notes, discount_percent, customer:customers(id, first_name, last_name, phone, tags, no_show_count))",
      )
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd)
      .order("starts_at"),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("staff_time_off").select("*").lte("starts_at", dayEnd).gte("ends_at", dayStart),
    supabase.from("staff_schedules").select("staff_id, weekday, start_time, end_time"),
  ]);

  return {
    staff: (staffRes.data ?? []) as Staff[],
    items: (itemsRes.data ?? []) as unknown as DayItem[],
    settings: settingsRes.data!,
    timeOff: timeOffRes.data ?? [],
    schedules: schedRes.data ?? [],
  };
}

export async function loadServicesForPicker(supabase: SupabaseClient<Database>) {
  const [cats, svcs] = await Promise.all([
    supabase.from("service_categories").select("id, name_tr, name_en, name_ru, sort_order, color").eq("is_active", true).order("sort_order"),
    supabase
      .from("services")
      .select("id, category_id, code, name_tr, name_en, name_ru, duration_min, buffer_min, price, kind")
      .eq("is_active", true)
      .order("sort_order")
      .order("name_tr"),
  ]);
  return { categories: cats.data ?? [], services: svcs.data ?? [] };
}
