import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fullName } from "@/lib/format";
import { FORMS, isFormKey } from "@/lib/forms/schemas";
import { prefillFromCustomer } from "@/lib/forms/server";
import { NewForm } from "./new-form";

export default async function NewFormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const key = String(sp.tur ?? "");
  const visitId = typeof sp.ziyaret === "string" && /^[0-9a-f-]{36}$/.test(sp.ziyaret) ? sp.ziyaret : null;
  if (!isFormKey(key)) notFound();
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const [{ data: c }, { data: staff }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, phone, email, birth_date, nationality").eq("id", id).maybeSingle(),
    supabase.from("staff").select("id, full_name").eq("is_active", true).order("sort_order"),
  ]);
  if (!c) notFound();
  const me = profile?.staff_id ? staff?.find((s) => s.id === profile.staff_id)?.full_name ?? "" : "";
  const F = FORMS[key];
  return (
    <div className="grid gap-4 max-w-3xl mx-auto w-full">
      <header className="flex items-center gap-3 flex-wrap print:hidden">
        <Link href={`/panel/musteriler/${id}`} className="btn ghost sm">‹ {fullName(c)}</Link>
        <h1 className="text-xl font-bold">{F.title}</h1>
      </header>
      {!F.staffForm && <p className="text-sm text-muted">{t("Formu danışanla birlikte doldurun; “uzman doldurur” bölümleri salon içindir. Tableti danışana verebilirsiniz.")}</p>}
      <NewForm customerId={id} visitId={visitId} formKey={key} initialData={prefillFromCustomer(key, c)} staffNames={(staff ?? []).map((s) => s.full_name)} me={me} />
    </div>
  );
}
