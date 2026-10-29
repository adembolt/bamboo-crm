import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { SupplierUI } from "./supplier-ui";

export async function generateMetadata() { return { title: (await getT())("Tedarikçiler ve depolar") }; }

export default async function SuppliersPage() {
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);
  const [{ data: sup }, { data: wh }, { data: staff }] = await Promise.all([
    supabase.from("suppliers").select("id, name, phone, notes").order("name"),
    supabase.from("warehouses").select("id, name, responsible_staff_id, is_active").order("name"),
    supabase.from("staff").select("id, full_name").eq("is_active", true).order("sort_order"),
  ]);
  return (
    <div className="grid gap-4 max-w-4xl">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/urunler">‹</Link>
        <h1 className="text-xl font-bold">{t("Tedarikçiler ve depolar")}</h1>
      </header>
      <SupplierUI suppliers={sup ?? []} warehouses={wh ?? []} staff={staff ?? []} canManage={canManage} />
    </div>
  );
}
