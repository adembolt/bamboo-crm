import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { StaffPayScheme } from "@/lib/database.types";
import { SchemesList } from "./schemes-list";

export async function generateMetadata() { return { title: (await getT())("Maaş şemaları") }; }

export default async function SchemesPage() {
  const { supabase } = await requireManager();
  const t = await getT();
  const [{ data: staff }, { data: schemes }] = await Promise.all([
    supabase.from("staff").select("id, full_name, title, is_active").eq("is_active", true).order("sort_order"),
    supabase.from("staff_pay_schemes").select("*").order("valid_from", { ascending: false }),
  ]);
  return (
    <div className="grid gap-4 max-w-4xl">
      <h1 className="text-xl font-bold">{t("Maaş şemaları")}</h1>
      <p className="text-sm text-muted">{t("Her personelin hak ediş kuralı: kendi satış yüzdesi, şirket satış yüzdesi, randevu primi, günlük ücret ve günlük garanti. Bir personele tarihten itibaren geçerli birden çok şema eklenebilir.")}</p>
      <SchemesList staff={staff ?? []} schemes={(schemes ?? []) as StaffPayScheme[]} />
    </div>
  );
}
