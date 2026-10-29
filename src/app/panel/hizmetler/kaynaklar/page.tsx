import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { ResourcesUI } from "./resources-ui";

export async function generateMetadata() { return { title: (await getT())("Kabinler ve cihazlar") }; }

export default async function ResourcesPage() {
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);
  const [{ data: res }, { data: links }, { data: cats }, { data: svcs }] = await Promise.all([
    supabase.from("resources").select("*").order("sort_order").order("name"),
    supabase.from("service_resources").select("service_id, resource_id"),
    supabase.from("service_categories").select("id, name_tr, name_en, name_ru, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("services").select("id, category_id").eq("is_active", true),
  ]);
  // kaynağın kategorileri: kategorideki hizmetlerin tamamı bağlıysa işaretli
  const catOf = new Map((svcs ?? []).map((s) => [s.id, s.category_id]));
  const resources = (res ?? []).map((r) => {
    const mine = new Set((links ?? []).filter((l) => l.resource_id === r.id).map((l) => l.service_id));
    const catIds = (cats ?? []).filter((c) => { const all = (svcs ?? []).filter((s) => s.category_id === c.id); return all.length > 0 && all.every((s) => mine.has(s.id)); }).map((c) => c.id);
    const partial = [...new Set([...mine].map((id) => catOf.get(id)).filter(Boolean) as string[])].filter((c) => !catIds.includes(c));
    return { ...r, categoryIds: catIds, partial, serviceCount: mine.size };
  });
  return (
    <div className="grid gap-4 max-w-3xl">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/hizmetler">‹</Link>
        <h1 className="text-xl font-bold">{t("Kabinler ve cihazlar")}</h1>
      </header>
      <p className="text-sm text-muted">{t("Bir hizmete kabin atanınca aynı saatte o kabine ikinci randevu verilmez (kapasite kadar). Kabin atanmamış hizmetlerde kontrol yapılmaz.")}</p>
      <ResourcesUI resources={resources} categories={cats ?? []} canManage={canManage} />
    </div>
  );
}
