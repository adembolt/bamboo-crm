import { requireSession } from "@/lib/auth";
import { StaffList } from "./staff-list";
import type { Staff } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Personel") };
}

export default async function StaffPage() {
  const { supabase, profile } = await requireSession();
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);
  const [{ data }, { data: services }, { data: categories }, { data: ss }] = await Promise.all([
    supabase.from("staff").select("*").order("sort_order").order("full_name"),
    supabase.from("services").select("id, category_id, code, name_tr, name_en, name_ru, duration_min, price").eq("is_active", true).order("sort_order").order("name_tr"),
    supabase.from("service_categories").select("id, name_tr, name_en, name_ru, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("staff_services").select("staff_id, service_id"),
  ]);
  const assigned: Record<string, string[]> = {};
  for (const r of ss ?? []) (assigned[r.staff_id] ??= []).push(r.service_id);
  return <StaffList staff={(data ?? []) as Staff[]} canManage={canManage} services={(services ?? []).map((x) => ({ ...x, price: Number(x.price) }))} categories={categories ?? []} assigned={assigned} />;
}
