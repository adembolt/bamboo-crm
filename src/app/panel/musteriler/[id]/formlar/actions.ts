"use server";
import { revalidatePath } from "next/cache";
import { requireSession, requireManager } from "@/lib/auth";
import { FORMS, SESSIONS, GUIDES, formFlags, isFormKey, missingFields, type FormData, type Signatures } from "@/lib/forms/schemas";
import { applyFormToCustomer, prefillFromCustomer, recomputeHealthFlags, staffFieldIds } from "@/lib/forms/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bamboo-crm-tau.vercel.app";
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function internal() {
  const s = await requireSession();
  if (!s.profile) throw new Error("Bu işlem için yetkiniz yok.");
  return s;
}
const clean = (o: unknown) => JSON.parse(JSON.stringify(o ?? {}));
const okSig = (s?: string) => (s && s.startsWith("data:image/png;base64,") && s.length < 200_000 ? s : undefined);

async function staffIdByName(supabase: Awaited<ReturnType<typeof internal>>["supabase"], name: string) {
  if (!name) return null;
  const { data } = await supabase.from("staff").select("id, full_name").ilike("full_name", name).limit(1);
  return data?.[0]?.id ?? null;
}

export async function saveClientForm(i: { customerId: string; visitId: string | null; formKey: string; data: FormData; sig: Signatures; staffName: string; date: string }): Promise<Res<{ id: string }>> {
  const { supabase, user } = await internal();
  if (!isFormKey(i.formKey)) return { ok: false, error: "form" };
  const sig: Signatures = { client: okSig(i.sig.client), staff: okSig(i.sig.staff) };
  const data = clean(i.data) as FormData;
  const miss = missingFields(i.formKey, data, sig);
  if (miss.length) return { ok: false, error: `Eksik: ${miss.join(", ")}` };
  const { data: row, error } = await supabase.from("client_forms").insert({
    customer_id: i.customerId, visit_id: i.visitId || null, form_key: i.formKey, form_date: /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : new Date().toISOString().slice(0, 10),
    status: "signed", data, signatures: sig, flags: formFlags(i.formKey, data), staff_name: i.staffName.slice(0, 80), staff_id: await staffIdByName(supabase, i.staffName),
    signed_at: sig.client ? new Date().toISOString() : null, created_by: user.id, token: null,
  }).select("id").single();
  if (error || !row) return { ok: false, error: error?.message ?? "kayıt" };
  await applyFormToCustomer(supabase, i.customerId, i.formKey, data);
  revalidatePath(`/panel/musteriler/${i.customerId}`);
  return { ok: true, id: row.id };
}

/** Kaydedilmiş formda yalnız salon bölümleri ve uzman imzası güncellenir (danışan beyanı değiştirilemez). */
export async function updateFormStaff(i: { formId: string; data: FormData; sig: Signatures; staffName: string }): Promise<Res> {
  const { supabase } = await internal();
  const { data: f } = await supabase.from("client_forms").select("id, customer_id, form_key, data, signatures, status").eq("id", i.formId).maybeSingle();
  if (!f || !isFormKey(f.form_key)) return { ok: false, error: "Form bulunamadı." };
  if (f.status === "pending") return { ok: false, error: "Danışan formu henüz doldurmadı." };
  const allowed = staffFieldIds(f.form_key), inData = clean(i.data) as FormData;
  const data = { ...(f.data as FormData) };
  for (const k of allowed) if (k in inData) data[k] = inData[k];
  const signatures = { ...(f.signatures as Signatures) };
  if (!signatures.staff && okSig(i.sig.staff)) signatures.staff = okSig(i.sig.staff);
  const { error } = await supabase.from("client_forms").update({
    data, signatures, staff_name: i.staffName.slice(0, 80), staff_id: await staffIdByName(supabase, i.staffName), status: "completed", updated_at: new Date().toISOString(),
  }).eq("id", f.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/panel/musteriler/${f.customer_id}`);
  return { ok: true };
}

export async function deleteClientForm(formId: string): Promise<Res> {
  const { supabase } = await requireManager();
  const { data: f } = await supabase.from("client_forms").select("customer_id").eq("id", formId).maybeSingle();
  if (!f) return { ok: false, error: "Form bulunamadı." };
  const { error } = await supabase.from("client_forms").delete().eq("id", formId);
  if (error) return { ok: false, error: error.message };
  await recomputeHealthFlags(supabase, f.customer_id);
  revalidatePath(`/panel/musteriler/${f.customer_id}`);
  return { ok: true };
}

/** Danışanın kendi telefonundan doldurup imzalayacağı bağlantı (otel, yat, ön kayıt). Mesaj otomatik gönderilmez. */
export async function createFormLink(i: { customerId: string; visitId: string | null; formKey: string; lang: string }): Promise<Res<{ url: string; phone: string; name: string }>> {
  const { supabase, user } = await internal();
  if (!isFormKey(i.formKey)) return { ok: false, error: "form" };
  if (FORMS[i.formKey].staffForm) return { ok: false, error: "Bu form uzman tarafından doldurulur." };
  const { data: c } = await supabase.from("customers").select("first_name, last_name, phone, email, birth_date, nationality").eq("id", i.customerId).maybeSingle();
  if (!c) return { ok: false, error: "Müşteri bulunamadı." };
  const lang = ["tr", "en", "ru"].includes(i.lang) ? i.lang : "tr";
  // aynı form için bekleyen bağlantı varsa onu kullan
  const { data: ex } = await supabase.from("client_forms").select("token").eq("customer_id", i.customerId).eq("form_key", i.formKey).eq("status", "pending").limit(1);
  let token = ex?.[0]?.token ?? null;
  if (token) await supabase.from("client_forms").update({ lang, visit_id: i.visitId || null }).eq("token", token);
  else {
    const { data: row, error } = await supabase.from("client_forms").insert({
      customer_id: i.customerId, visit_id: i.visitId || null, form_key: i.formKey, status: "pending", lang, data: prefillFromCustomer(i.formKey, c), created_by: user.id,
    }).select("token").single();
    if (error || !row?.token) return { ok: false, error: error?.message ?? "bağlantı" };
    token = row.token;
  }
  revalidatePath(`/panel/musteriler/${i.customerId}`);
  return { ok: true, url: `${SITE}/form/${token}?lang=${lang}`, phone: c.phone, name: c.first_name };
}

export async function addClientSession(i: { customerId: string; visitId: string | null; kind: string; date: string; fields: Record<string, string>; staffName: string }): Promise<Res> {
  const { supabase, user } = await internal();
  const T = SESSIONS[i.kind]; if (!T) return { ok: false, error: "tür" };
  const fields: Record<string, string> = {};
  for (const [k] of T.fields) if (i.fields[k]?.trim()) fields[k] = i.fields[k].trim().slice(0, 200);
  const { error } = await supabase.from("client_sessions").insert({ customer_id: i.customerId, visit_id: i.visitId || null, kind: i.kind, session_date: /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : new Date().toISOString().slice(0, 10), fields, staff_name: i.staffName.slice(0, 80), created_by: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/panel/musteriler/${i.customerId}`);
  return { ok: true };
}

export async function deleteClientSession(id: string, customerId: string): Promise<Res> {
  const { supabase } = await internal();
  const { error } = await supabase.from("client_sessions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/panel/musteriler/${customerId}`);
  return { ok: true };
}

export async function recordGuide(i: { customerId: string; visitId: string | null; key: string }): Promise<Res> {
  const { supabase, user } = await internal();
  if (!GUIDES[i.key]) return { ok: false, error: "rehber" };
  const { error } = await supabase.from("care_guides_given").insert({ customer_id: i.customerId, visit_id: i.visitId || null, guide_key: i.key, created_by: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/panel/musteriler/${i.customerId}`);
  return { ok: true };
}

export async function cancelFormLink(formId: string): Promise<Res> {
  const { supabase } = await internal();
  const { data: f } = await supabase.from("client_forms").select("customer_id, status").eq("id", formId).maybeSingle();
  if (!f || f.status !== "pending") return { ok: false, error: "Form bulunamadı." };
  await supabase.from("client_forms").delete().eq("id", formId);
  revalidatePath(`/panel/musteriler/${f.customer_id}`);
  return { ok: true };
}
