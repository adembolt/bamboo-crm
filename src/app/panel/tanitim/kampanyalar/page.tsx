import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { Deal } from "@/lib/database.types";
import { DealsList } from "./deals-ui";

export async function generateMetadata() { return { title: (await getT())("Kampanyalar") }; }

/* DIKIDI "Deals": süreli indirim / kampanya; yayınlananlar online randevu sayfasının üstünde görünür */
export default async function DealsPage() {
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const [{ data: deals }, { data: services }] = await Promise.all([
    supabase.from("deals").select("*").order("created_at", { ascending: false }),
    supabase.from("services").select("id, name_tr, price").eq("is_active", true).order("sort_order"),
  ]);
  return (
    <div className="grid gap-4 max-w-4xl">
      <h1 className="text-xl font-bold">{t("Kampanyalar")}</h1>
      <p className="text-sm text-muted">{t("“Yayında” olan ve tarihi geçerli kampanyalar online randevu sayfasının (/randevu) en üstünde gösterilir. İndirimi kasada ödeme alırken uygulayın.")}</p>
      <DealsList deals={(deals ?? []).map((d) => ({ ...d, discount_percent: d.discount_percent === null ? null : Number(d.discount_percent), price: d.price === null ? null : Number(d.price), old_price: d.old_price === null ? null : Number(d.old_price) })) as Deal[]} services={(services ?? []).map((s) => ({ ...s, price: Number(s.price) }))} canEdit={isManager} />
    </div>
  );
}
