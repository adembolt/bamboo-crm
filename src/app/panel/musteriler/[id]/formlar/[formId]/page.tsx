import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fullName, fmtDate } from "@/lib/format";
import { FORMS, isFormKey, type FormData, type Signatures } from "@/lib/forms/schemas";
import { ViewForm } from "./view-form";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bamboo-crm-tau.vercel.app";

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string; formId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, formId } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const [{ data: f }, { data: c }, { data: staff }] = await Promise.all([
    supabase.from("client_forms").select("*").eq("id", formId).eq("customer_id", id).maybeSingle(),
    supabase.from("customers").select("id, first_name, last_name, phone").eq("id", id).maybeSingle(),
    supabase.from("staff").select("full_name").eq("is_active", true).order("sort_order"),
  ]);
  if (!f || !c || !isFormKey(f.form_key)) notFound();
  const F = FORMS[f.form_key];
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const hasStaffPart = F.sections.some((s) => s.staffOnly) || F.sign;
  return (
    <div className="grid gap-4 max-w-3xl mx-auto w-full">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href={`/panel/musteriler/${id}`} className="btn ghost sm print:hidden">‹ {fullName(c)}</Link>
        <div className="grid">
          <h1 className="text-xl font-bold">{F.title}</h1>
          <span className="text-sm text-muted">Bamboo Beauty Lifes · {fullName(c)} · {fmtDate(f.form_date)}{f.staff_name ? ` · ${t("Uzman")}: ${f.staff_name}` : ""}</span>
        </div>
        <span className={`pill ml-auto ${f.status === "pending" ? "warn" : "good"}`}>{f.status === "pending" ? t("Danışan bekleniyor") : f.signatures?.client ? t("Danışan imzalı") : t("Kaydedildi")}</span>
      </header>
      {sp.kaydedildi && <p className="pill good justify-self-start print:hidden">{t("Form kaydedildi.")}</p>}
      {f.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{f.flags.map((x) => <span key={x} className="pill warn">⚠ {x}</span>)}</div>
      )}
      <ViewForm formId={f.id} customerId={id} formKey={f.form_key} status={f.status} data={f.data as FormData} sig={f.signatures as Signatures} staffName={f.staff_name} date={f.form_date}
        staffNames={(staff ?? []).map((s) => s.full_name)} canDelete={isManager} canEditStaff={hasStaffPart && f.status !== "pending"}
        link={f.status === "pending" && f.token ? `${SITE}/form/${f.token}?lang=${f.lang}` : null} phone={c.phone} name={c.first_name} />
    </div>
  );
}
