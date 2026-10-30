import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Customer } from "@/lib/database.types";
import { FORMS, OPTIN_MARKETING, type FormKey, type FormData } from "./schemas";

type DB = SupabaseClient<Database>;

/** Yeni formda müşteri kartından otomatik doldurulan alanlar */
export function prefillFromCustomer(key: FormKey, c: Pick<Customer, "first_name" | "last_name" | "phone" | "email" | "birth_date" | "nationality">): FormData {
  const src: Record<string, string> = {
    name: `${c.first_name} ${c.last_name}`.trim(), phone: c.phone, email: c.email, birth: c.birth_date ?? "", nat: c.nationality,
  };
  const out: FormData = {};
  for (const s of FORMS[key].sections) for (const f of s.fields) if (f.id && f.client && src[f.client]) out[f.id] = src[f.client];
  return out;
}

/** Yalnız salon (staffOnly) bölümlerindeki alan kimlikleri */
export function staffFieldIds(key: FormKey): Set<string> {
  return new Set(FORMS[key].sections.filter((s) => s.staffOnly).flatMap((s) => s.fields.map((f) => f.id).filter(Boolean) as string[]));
}

/** Form kaydedildikten sonra: müşteri kartındaki boş alanları tamamla, pazarlama iznini işle, sağlık uyarılarını yeniden hesapla. */
export async function applyFormToCustomer(db: DB, customerId: string, key: FormKey, data: FormData) {
  const { data: c } = await db.from("customers").select("phone, email, birth_date, nationality, consent_marketing").eq("id", customerId).maybeSingle();
  if (c) {
    const up: Partial<Customer> = {};
    const s = (k: string) => String(data[k] ?? "").trim();
    if (!c.phone && s("phone")) up.phone = s("phone");
    if (!c.email && s("email")) up.email = s("email");
    if (!c.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(s("birth"))) up.birth_date = s("birth");
    if (!c.nationality && s("nat")) up.nationality = s("nat");
    if (key === "intake") {
      const optin = (data.optin ?? []) as number[];
      const wants = optin.includes(OPTIN_MARKETING);
      if (wants !== c.consent_marketing) { up.consent_marketing = wants; up.consent_at = wants ? new Date().toISOString() : null; }
    }
    if (Object.keys(up).length) await db.from("customers").update(up).eq("id", customerId);
  }
  await recomputeHealthFlags(db, customerId);
}

/** Her form türünün en son imzalı kaydındaki uyarıların birleşimi */
export async function recomputeHealthFlags(db: DB, customerId: string) {
  const { data: forms } = await db.from("client_forms").select("form_key, flags, form_date, created_at, status").eq("customer_id", customerId).neq("status", "pending").order("form_date", { ascending: false }).order("created_at", { ascending: false });
  const seen = new Set<string>(), flags = new Set<string>();
  for (const f of forms ?? []) {
    if (seen.has(f.form_key)) continue;
    seen.add(f.form_key);
    (f.flags ?? []).forEach((x) => flags.add(x.replace(/\s*\(.*\)$/, "")));
  }
  await db.from("customers").update({ health_flags: [...flags] }).eq("id", customerId);
}
