"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { localToIso } from "@/lib/format";

export async function saveStaff(_prev: { error: string; saved?: boolean }, formData: FormData) {
  const { supabase } = await requireManager();
  const id = String(formData.get("id") ?? "");
  const payload = {
    full_name: String(formData.get("full_name") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    title_en: String(formData.get("title_en") ?? "").trim(),
    title_ru: String(formData.get("title_ru") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    color: String(formData.get("color") ?? "#5E9E6C"),
    languages: String(formData.get("languages") ?? "tr").split(",").map((s) => s.trim()).filter(Boolean),
    online_bookable: formData.get("online_bookable") === "on",
    pay_model: String(formData.get("pay_model") ?? "percent") as "daily_prim" | "percent" | "fixed",
    pay_percent: Number(formData.get("pay_percent") ?? 0) || 0,
    product_percent: Number(formData.get("product_percent") ?? 0) || 0,
    is_active: formData.get("is_active") === "on",
  };
  if (!payload.full_name) return { error: (await getT())("Ad gerekli.") };
  const res = id ? await supabase.from("staff").update(payload).eq("id", id) : await supabase.from("staff").insert(payload);
  if (res.error) return { error: res.error.message };
  revalidatePath("/panel/personel");
  revalidatePath("/panel/takvim");
  return { error: "", saved: true };
}

/** Personelin yapabildiği hizmetleri kaydeder (tam liste ile değiştirir) */
export async function setStaffServices(staffId: string, serviceIds: string[]) {
  const { supabase } = await requireManager();
  const ids = [...new Set(serviceIds)].filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const { data: cur } = await supabase.from("staff_services").select("service_id, price_override, duration_override").eq("staff_id", staffId);
  const keep = new Map((cur ?? []).map((r) => [r.service_id, r]));
  const del = (cur ?? []).filter((r) => !ids.includes(r.service_id)).map((r) => r.service_id);
  if (del.length) {
    const { error } = await supabase.from("staff_services").delete().eq("staff_id", staffId).in("service_id", del);
    if (error) return { ok: false as const, error: error.message };
  }
  const add = ids.filter((id) => !keep.has(id)).map((service_id) => ({ staff_id: staffId, service_id }));
  for (let i = 0; i < add.length; i += 500) {
    const { error } = await supabase.from("staff_services").insert(add.slice(i, i + 500));
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath("/panel/personel"); revalidatePath("/panel/takvim");
  return { ok: true as const, count: ids.length };
}

export async function setStaffPhoto(staffId: string, url: string | null) {
  const { supabase } = await requireManager();
  if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/staff-photos\//.test(url)) return { ok: false as const, error: (await getT())("Geçersiz adres.") };
  const { error } = await supabase.from("staff").update({ photo_url: url }).eq("id", staffId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/takvim"); revalidatePath("/panel/personel");
  return { ok: true as const };
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Haftalık çalışma programı: tam liste ile değiştirir. Boş liste = program yok (salon saatleri geçerli) */
export async function saveSchedule(staffId: string, rows: { weekday: number; start: string; end: string }[]) {
  const { supabase } = await requireManager();
  const t = await getT();
  const clean = rows.filter((r) => r.weekday >= 1 && r.weekday <= 7 && HM.test(r.start) && HM.test(r.end));
  for (const r of clean) if (r.end <= r.start) return { ok: false as const, error: t("Bitiş saati başlangıçtan sonra olmalı.") };
  // aynı günde çakışan aralık olmasın
  for (let d = 1; d <= 7; d++) {
    const day = clean.filter((r) => r.weekday === d).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < day.length; i++) if (day[i].start < day[i - 1].end) return { ok: false as const, error: t("Aynı gün içindeki saat aralıkları çakışıyor.") };
  }
  const { error: delErr } = await supabase.from("staff_schedules").delete().eq("staff_id", staffId);
  if (delErr) return { ok: false as const, error: delErr.message };
  if (clean.length) {
    const { error } = await supabase.from("staff_schedules").insert(clean.map((r) => ({ staff_id: staffId, weekday: r.weekday, start_time: r.start, end_time: r.end })));
    if (error) return { ok: false as const, error: error.message };
  }
  await supabase.from("staff").update({ schedule_mode: "weekly" }).eq("id", staffId);
  revalidatePath("/panel/personel"); revalidatePath("/panel/takvim");
  return { ok: true as const };
}

/** İzin / kapalı saat ekler. Tam gün: from..to tarihleri dahil; değilse tek günde saat aralığı */
export async function addTimeOff(input: { staffId: string; from: string; to: string; allDay: boolean; start?: string; end?: string; reason: string }) {
  const { supabase } = await requireManager();
  const t = await getT();
  const D = /^\d{4}-\d{2}-\d{2}$/;
  if (!D.test(input.from) || !D.test(input.to) || input.to < input.from) return { ok: false as const, error: t("Tarihleri kontrol edin.") };
  let startsAt: string, endsAt: string;
  if (input.allDay) {
    startsAt = localToIso(input.from, "00:00");
    endsAt = new Date(new Date(localToIso(input.to, "00:00")).getTime() + 24 * 3600 * 1000).toISOString();
  } else {
    if (!HM.test(input.start ?? "") || !HM.test(input.end ?? "") || input.end! <= input.start!) return { ok: false as const, error: t("Saatleri kontrol edin.") };
    startsAt = localToIso(input.from, input.start!); endsAt = localToIso(input.from, input.end!);
  }
  const { error } = await supabase.from("staff_time_off").insert({ staff_id: input.staffId, starts_at: startsAt, ends_at: endsAt, reason: input.reason.trim().slice(0, 80) });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/personel"); revalidatePath("/panel/takvim");
  return { ok: true as const };
}

export async function deleteTimeOff(id: string) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("staff_time_off").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/personel"); revalidatePath("/panel/takvim");
  return { ok: true as const };
}

/* ---------------- maaş şemaları ---------------- */
export type SchemeInput = {
  id?: string | null; staffId: string; validFrom: string;
  servicePercent: number; productPercent: number; serviceDeductDiscount: boolean; productDeductDiscount: boolean; serviceDeductMaterials: boolean;
  companyServicePercent: number; companyProductPercent: number; companyDeductDiscount: boolean; companyExcludeOwn: boolean; companyOnlyOnShift: boolean;
  bookingServicePercent: number; bookingProductPercent: number; bookingExcludeOwn: boolean;
  dailyWage: number; dailyGuarantee: number; notes: string;
};
export async function savePayScheme(i: SchemeInput) {
  const { supabase } = await requireManager();
  const t = await getT();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.validFrom)) return { ok: false as const, error: t("Başlangıç tarihi geçersiz.") };
  const pc = (n: number) => Math.max(0, Math.min(100, Number(n) || 0));
  const row = {
    staff_id: i.staffId, valid_from: i.validFrom,
    service_percent: pc(i.servicePercent), product_percent: pc(i.productPercent), service_deduct_discount: !!i.serviceDeductDiscount, product_deduct_discount: !!i.productDeductDiscount, service_deduct_materials: !!i.serviceDeductMaterials,
    company_service_percent: pc(i.companyServicePercent), company_product_percent: pc(i.companyProductPercent), company_deduct_discount: !!i.companyDeductDiscount, company_exclude_own: !!i.companyExcludeOwn, company_only_on_shift: !!i.companyOnlyOnShift,
    booking_service_percent: pc(i.bookingServicePercent), booking_product_percent: pc(i.bookingProductPercent), booking_exclude_own: !!i.bookingExcludeOwn,
    daily_wage: Math.max(0, Number(i.dailyWage) || 0), daily_guarantee: Math.max(0, Number(i.dailyGuarantee) || 0), notes: String(i.notes ?? "").slice(0, 300),
  };
  const { error } = i.id ? await supabase.from("staff_pay_schemes").update(row).eq("id", i.id) : await supabase.from("staff_pay_schemes").insert(row);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/personel"); revalidatePath("/panel/kasa");
  return { ok: true as const };
}
export async function deletePayScheme(id: string) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("staff_pay_schemes").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/personel"); revalidatePath("/panel/kasa");
  return { ok: true as const };
}
