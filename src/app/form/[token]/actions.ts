"use server";
import { createAdminClient } from "@/lib/supabase/server";
import { formFlags, isFormKey, missingFields, type FormData, type Signatures } from "@/lib/forms/schemas";
import { applyFormToCustomer, staffFieldIds } from "@/lib/forms/server";

/** Danışanın kendi telefonundan doldurduğu form: giriş yok, forma özel bağlantı; bir kez imzalanır. */
export async function submitRemoteForm(token: string, data: FormData, sig: Signatures) {
  if (!/^[0-9a-f]{20,64}$/.test(token)) return { ok: false as const, error: "link" };
  const db = createAdminClient();
  const { data: f } = await db.from("client_forms").select("id, customer_id, form_key, status, data").eq("token", token).maybeSingle();
  if (!f || !isFormKey(f.form_key)) return { ok: false as const, error: "link" };
  if (f.status !== "pending") return { ok: false as const, error: "done" };
  const staffIds = staffFieldIds(f.form_key);
  const clean: FormData = {};
  for (const [k, v] of Object.entries(JSON.parse(JSON.stringify(data ?? {})) as FormData)) if (!staffIds.has(k)) clean[k] = v;
  const client = typeof sig?.client === "string" && sig.client.startsWith("data:image/png;base64,") && sig.client.length < 200_000 ? sig.client : undefined;
  const s: Signatures = client ? { client } : {};
  if (missingFields(f.form_key, clean, s, { skipStaff: true }).length) return { ok: false as const, error: "missing" };
  const { error } = await db.from("client_forms").update({
    data: clean, signatures: s, flags: formFlags(f.form_key, clean), status: "signed", signed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", f.id).eq("status", "pending");
  if (error) return { ok: false as const, error: "save" };
  await applyFormToCustomer(db, f.customer_id, f.form_key, clean);
  return { ok: true as const };
}
