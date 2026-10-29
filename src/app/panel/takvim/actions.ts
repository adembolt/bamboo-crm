"use server";
import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { localToIso, normalizePhone } from "@/lib/format";
import type { VisitStatus } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";

type Result = { ok: true; visitId: string; itemId: string } | { ok: false; error: string };

export type NewItemInput = {
  date: string;            // YYYY-MM-DD
  startHHMM: string;       // HH:MM (İstanbul)
  staffId: string | null;
  serviceId: string;
  price?: number;
  notes?: string;
  customerId?: string | null;
  newCustomer?: { first_name: string; last_name: string; phone: string; locale?: string } | null;
  visitId?: string | null; // mevcut ziyarete ekle
};

/**
 * Bir hizmet kalemi ekler. Aynı müşterinin aynı gün ziyareti varsa ona eklenir;
 * yoksa yeni ziyaret açılır. Böylece müşterinin gün içindeki tüm hizmetleri tek kartta toplanır.
 */
export async function addVisitItem(input: NewItemInput): Promise<Result> {
  const { supabase, user } = await requireOps();
  const t = await getT();

  const { data: service } = await supabase
    .from("services")
    .select("id, name_tr, duration_min, buffer_min, price")
    .eq("id", input.serviceId)
    .single();
  if (!service) return { ok: false, error: t("Hizmet bulunamadı.") };
  // uzmana özel süre / fiyat (DIKIDI'den aktarılan)
  if (input.staffId) {
    const { data: ov } = await supabase.from("staff_services").select("price_override, duration_override").eq("staff_id", input.staffId).eq("service_id", service.id).maybeSingle();
    if (ov?.duration_override) service.duration_min = ov.duration_override;
    if (ov?.price_override !== null && ov?.price_override !== undefined) service.price = ov.price_override;
  }

  // Müşteri
  let customerId = input.customerId ?? null;
  if (!customerId && input.newCustomer?.first_name) {
    const phone = normalizePhone(input.newCustomer.phone ?? "");
    if (phone) {
      const { data: existing } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
      if (existing) customerId = existing.id;
    }
    if (!customerId) {
      const { data: c, error } = await supabase
        .from("customers")
        .insert({
          first_name: input.newCustomer.first_name.trim(),
          last_name: (input.newCustomer.last_name ?? "").trim(),
          phone,
          locale: input.newCustomer.locale ?? "tr",
          source: "salon",
        })
        .select("id")
        .single();
      if (error || !c) return { ok: false, error: t("Müşteri oluşturulamadı: {msg}", { msg: error?.message ?? "" }) };
      customerId = c.id;
    }
  }

  // Ziyaret: verilen, ya da (müşteri, gün) için mevcut, ya da yeni
  let visitId = input.visitId ?? null;
  if (!visitId && customerId) {
    const { data: v } = await supabase
      .from("visits")
      .select("id")
      .eq("customer_id", customerId)
      .eq("visit_date", input.date)
      .neq("status", "cancelled")
      .maybeSingle();
    if (v) visitId = v.id;
  }
  if (!visitId) {
    const { data: v, error } = await supabase
      .from("visits")
      .insert({ customer_id: customerId, visit_date: input.date, status: "confirmed", source: "salon", created_by: user.id })
      .select("id")
      .single();
    if (error || !v) return { ok: false, error: t("Ziyaret açılamadı: {msg}", { msg: error?.message ?? "" }) };
    visitId = v.id;
  }

  const startsAt = localToIso(input.date, input.startHHMM);
  const endsAt = new Date(new Date(startsAt).getTime() + (service.duration_min + service.buffer_min) * 60000).toISOString();

  const { data: item, error } = await supabase
    .from("visit_items")
    .insert({
      visit_id: visitId,
      service_id: service.id,
      service_name: service.name_tr,
      staff_id: input.staffId,
      starts_at: startsAt,
      ends_at: endsAt,
      price: input.price ?? Number(service.price),
      notes: input.notes ?? "",
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error || !item) {
    const msg = error?.message.includes("visit_items_no_staff_overlap")
      ? t("Bu personelin o saatte başka bir randevusu var.")
      : t("Kalem eklenemedi: {msg}", { msg: error?.message ?? "" });
    return { ok: false, error: msg };
  }

  revalidatePath("/panel/takvim");
  revalidatePath("/panel");
  return { ok: true, visitId, itemId: item.id };
}

export async function setItemStatus(itemId: string, status: VisitStatus) {
  const { supabase } = await requireOps();
  const { error } = await supabase.from("visit_items").update({ status }).eq("id", itemId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/takvim");
  return { ok: true as const };
}

export async function setVisitStatus(visitId: string, status: VisitStatus) {
  const { supabase } = await requireOps();
  const { error } = await supabase.from("visits").update({ status }).eq("id", visitId);
  if (error) return { ok: false as const, error: error.message };
  // tamamlandı / gelmedi / iptal: kalemlere de yansıt
  if (["completed", "no_show", "cancelled", "arrived"].includes(status)) {
    await supabase.from("visit_items").update({ status }).eq("visit_id", visitId).neq("status", "cancelled");
  }
  if (status === "no_show") {
    const { data: v } = await supabase.from("visits").select("customer_id").eq("id", visitId).single();
    if (v?.customer_id) {
      const { data: c } = await supabase.from("customers").select("no_show_count").eq("id", v.customer_id).single();
      await supabase.from("customers").update({ no_show_count: (c?.no_show_count ?? 0) + 1 }).eq("id", v.customer_id);
    }
  }
  revalidatePath("/panel/takvim");
  revalidatePath("/panel");
  return { ok: true as const };
}

export async function deleteItem(itemId: string) {
  const { supabase } = await requireOps();
  const { data: item } = await supabase.from("visit_items").select("visit_id").eq("id", itemId).single();
  const { error } = await supabase.from("visit_items").delete().eq("id", itemId);
  if (error) return { ok: false as const, error: error.message };
  if (item) {
    const { count } = await supabase.from("visit_items").select("id", { count: "exact", head: true }).eq("visit_id", item.visit_id);
    if (!count) await supabase.from("visits").delete().eq("id", item.visit_id);
  }
  revalidatePath("/panel/takvim");
  return { ok: true as const };
}

export async function moveItem(itemId: string, date: string, startHHMM: string, staffId: string | null) {
  const { supabase } = await requireOps();
  const t = await getT();
  const { data: item } = await supabase.from("visit_items").select("starts_at, ends_at, visit_id").eq("id", itemId).single();
  if (!item) return { ok: false as const, error: t("Kalem bulunamadı.") };
  const { count } = await supabase.from("sales").select("id", { count: "exact", head: true }).eq("visit_id", item.visit_id);
  if (count) return { ok: false as const, error: t("Ödemesi alınmış randevu taşınamaz. Önce kasadan satışı iptal edin.") };
  const dur = new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime();
  const startsAt = localToIso(date, startHHMM);
  const endsAt = new Date(new Date(startsAt).getTime() + dur).toISOString();
  const { error } = await supabase.from("visit_items").update({ starts_at: startsAt, ends_at: endsAt, staff_id: staffId }).eq("id", itemId);
  if (error) {
    return { ok: false as const, error: error.message.includes("overlap") ? t("O saatte personel dolu.") : error.message };
  }
  await supabase.from("visits").update({ visit_date: date }).eq("id", item.visit_id);
  revalidatePath("/panel/takvim");
  return { ok: true as const };
}

/** Takvimde kartın alt kenarından sürükleyerek süre değiştirme */
export async function resizeItem(itemId: string, durationMin: number) {
  const { supabase } = await requireOps();
  const t = await getT();
  if (!(durationMin >= 5 && durationMin <= 12 * 60)) return { ok: false as const, error: t("Süre geçersiz.") };
  const { data: item } = await supabase.from("visit_items").select("starts_at, visit_id").eq("id", itemId).single();
  if (!item) return { ok: false as const, error: t("Kalem bulunamadı.") };
  const { count } = await supabase.from("sales").select("id", { count: "exact", head: true }).eq("visit_id", item.visit_id);
  if (count) return { ok: false as const, error: t("Ödemesi alınmış randevu değiştirilemez. Önce kasadan satışı iptal edin.") };
  const endsAt = new Date(new Date(item.starts_at).getTime() + durationMin * 60000).toISOString();
  const { error } = await supabase.from("visit_items").update({ ends_at: endsAt }).eq("id", itemId);
  if (error) return { ok: false as const, error: error.message.includes("overlap") ? t("O saatte personel dolu.") : error.message };
  revalidatePath("/panel/takvim");
  return { ok: true as const };
}

export async function updateVisitNotes(visitId: string, notes: string, internal: string) {
  const { supabase } = await requireOps();
  const { error } = await supabase.from("visits").update({ notes, internal_notes: internal }).eq("id", visitId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/takvim");
  return { ok: true as const };
}

/** Önce hizmet seç → önümüzdeki günlerde tüm uzmanlarda boş saatler */
export async function findFreeSlots(input: { serviceId: string; staffId: string | null; from: string; days: number }) {
  await requireOps();
  const { getSlots } = await import("@/lib/booking/availability");
  const { addDays } = await import("@/lib/format");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from)) return { ok: false as const, error: "date" };
  const days = Math.max(1, Math.min(14, input.days || 7));
  const out: { date: string; slots: { time: string; staffIds: string[] }[] }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(input.from, i);
    const r = await getSlots({ serviceId: input.serviceId, staffId: input.staffId, date, panel: true });
    out.push({ date, slots: r.slots });
  }
  return { ok: true as const, days: out };
}
