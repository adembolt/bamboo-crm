import { requireSession } from "@/lib/auth";
import { ServicesTable } from "./services-table";
import type { Service, ServiceCategory } from "@/lib/database.types";

export const metadata = { title: "Hizmetler" };

export default async function ServicesPage({ searchParams }: PageProps<"/panel/hizmetler">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const only = typeof sp.only === "string" ? sp.only : ""; // online | offline | inactive
  const { supabase, profile } = await requireSession();
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);

  const [{ data: cats }, { data: svcs }] = await Promise.all([
    supabase.from("service_categories").select("*").order("sort_order").order("name_tr"),
    supabase.from("services").select("*").order("sort_order").order("code").order("name_tr"),
  ]);

  return (
    <ServicesTable
      categories={(cats ?? []) as ServiceCategory[]}
      services={(svcs ?? []) as Service[]}
      canManage={canManage}
      initial={{ cat, q, only }}
    />
  );
}
