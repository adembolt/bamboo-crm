import { requireSession } from "@/lib/auth";
import { StaffList } from "./staff-list";
import type { Staff } from "@/lib/database.types";

export const metadata = { title: "Personel" };

export default async function StaffPage() {
  const { supabase, profile } = await requireSession();
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);
  const { data } = await supabase.from("staff").select("*").order("sort_order").order("full_name");
  return <StaffList staff={(data ?? []) as Staff[]} canManage={canManage} />;
}
