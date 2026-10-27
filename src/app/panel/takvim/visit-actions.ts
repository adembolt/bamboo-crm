"use server";
import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { localToIso, todayIso, normalizePhone } from "@/lib/format";
import type { VisitStatus } from "@/lib/database.types";

const ISTANBUL = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date(iso));
const HHMM = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }).format(new Date(iso));

/** Düzenleme ekranı için ziyaretin tüm ayrıntıları */
export async function getVisitDetail(visitId: string) {
  const { supabase } = await requireOps();
  const { data: v } = await supabase.from("visits")
    .select("id, visit_date, status, source, notes, color, is_anonymous, remind_offsets, remind_confirm, review_request, promo_code, discount_percent, created_at, customer:customers(id, first_name, last_name, phone, email, notes, health_notes, no_show_count, balance, loyalty_points, tags, locale), items:visit_items(id, service_id, service_name, staff_id, starts_at, ends_at, price, discount, status, break_min, package_id, service:services(duration_min))")
    .eq("id", visitId).single();
  if (!v) return { ok: false as const, error: "Ziyaret bulunamadı." };
  const cid = v.customer?.id;
  const [{ data: hist }, { data: msgs }, { data: files }, { data: audit }, { data: sale }] = await Promise.all([
    cid ? supabase.from("visits").select("id, visit_date, status, items:visit_items(service_name, price, discount, staff:staff(full_name))").eq("customer_id", cid).neq("id", visitId).order("visit_date", { ascending: false }).limit(12) : Promise.resolve({ data: [] as never[] }),
    supabase.from("message_log").select("kind, channel, body, sent_at").eq("visit_id", visitId).order("sent_at", { ascending: false }),
    supabase.from("visit_files").select("id, file_name, storage_path, mime, size_bytes, created_at").eq("visit_id", visitId).order("created_at"),
    supabase.from("audit_log").select("action, diff, created_at, actor_id").eq("entity", "visit").eq("entity_id", visitId).order("created_at", { ascending: false }).limit(30),
    supabase.from("sales").select("id, total").eq("visit_id", visitId).maybeSingle(),
  ]);
  const signed = await Promise.all((files ?? []).map(async (f) => {
    const { data } = await supabase.storage.from("visit-files").createSignedUrl(f.storage_path, 3600);
    return { ...f, url: data?.signedUrl ?? null };
  }));
  const actorIds = [...new Set((audit ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const items = [...v.items].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((i) => ({
    id: i.id, serviceId: i.service_id, serviceName: i.service_name, staffId: i.staff_id, time: HHMM(i.starts_at),
    duration: Math.max(5, Math.round((new Date(i.ends_at).getTime() - new Date(i.starts_at).getTime()) / 60000) - (i.break_min ?? 0)),
    price: Number(i.price), discount: Number(i.discount), status: i.status as VisitStatus, breakMin: i.break_min ?? 0, packageId: i.package_id,
  }));
  return {
    ok: true as const,
    visit: { id: v.id, date: v.visit_date, status: v.status as VisitStatus, source: v.source, notes: v.notes, color: v.color, isAnonymous: v.is_anonymous, remindOffsets: v.remind_offsets ?? [], remindConfirm: v.remind_confirm, reviewRequest: v.review_request, promoCode: v.promo_code, createdAt: v.created_at },
    customer: v.customer ? { ...v.customer, balance: Number(v.customer.balance) } : null,
    items,
    history: (hist ?? []).map((h) => ({ id: h.id, date: h.visit_date, status: h.status, services: h.items.map((i) => i.service_name).join(", "), staff: [...new Set(h.items.map((i) => i.staff?.full_name).filter(Boolean))].join(", "), total: h.items.reduce((s, i) => s + Number(i.price) - Number(i.discount), 0) })),
    messages: msgs ?? [],
    files: signed,
    audit: (audit ?? []).map((a) => ({ ...a, actor: actors?.find((x) => x.id === a.actor_id)?.full_name ?? "" })),
    sale: sale ? { id: sale.id, total: Number(sale.total) } : null,
  };
}

export type SaveLine = { id?: string; serviceId: string | null; serviceName: string; staffId: string | null; time: string; duration: number; price: number; discount: number };
export type SaveVisitInput = {
  visitId: string; date: string; lines: SaveLine[]; customerId: string | null; isAnonymous: boolean;
  status: VisitStatus; notes: string; color: string; remindOffsets: number[]; remindConfirm: boolean; reviewRequest: string; promoCode: string; breakMin: number;
};

async function audit(action: string, visitId: string, diff: unknown) {
  const { supabase, user } = await requireOps();
  await supabase.from("audit_log").insert({ actor_id: user.id, action, entity: "visit", entity_id: visitId, diff });
}

export async function saveVisit(input: SaveVisitInput) {
  const { supabase } = await requireOps();
  const lines = input.lines.filter((l) => l.serviceName.trim());
  if (!lines.length) return { ok: false as const, error: "En az bir hizmet olmalı." };
  for (const l of lines) if (!/^\d{2}:\d{2}$/.test(l.time) || !(l.duration > 0)) return { ok: false as const, error: "Saat ve süre geçerli olmalı." };

  const { data: before } = await supabase.from("visits").select("visit_date, status, customer_id, notes, color, items:visit_items(id, service_name, staff_id, starts_at, price, discount)").eq("id", input.visitId).single();
  if (!before) return { ok: false as const, error: "Ziyaret bulunamadı." };

  const { error: ve } = await supabase.from("visits").update({
    visit_date: input.date, customer_id: input.isAnonymous ? null : input.customerId, is_anonymous: input.isAnonymous, status: input.status,
    notes: input.notes, color: input.color, remind_offsets: input.remindOffsets, remind_confirm: input.remindConfirm,
    review_request: input.reviewRequest, promo_code: input.promoCode.trim().toUpperCase(),
  }).eq("id", input.visitId);
  if (ve) return { ok: false as const, error: ve.message.includes("visits_one_per_customer_day") ? "Bu müşterinin o gün başka bir ziyareti var; hizmeti oraya ekleyin." : ve.message };

  // Son satıra mola eklenir (ends_at uzar → çakışma kontrolü molayı da kapsar)
  const order = lines.map((l, i) => ({ l, i })).sort((a, b) => a.l.time.localeCompare(b.l.time));
  const lastIdx = order[order.length - 1].i;
  const keep = new Set(lines.filter((l) => l.id).map((l) => l.id!));
  const removed = (before.items ?? []).filter((i) => !keep.has(i.id)).map((i) => i.id);
  if (removed.length) await supabase.from("visit_items").delete().in("id", removed);
  // Önce mevcut kalemleri geçici olarak çakışma kontrolü dışına al (yer değiştirmelerde birbirleriyle çakışmasın)
  if (keep.size) await supabase.from("visit_items").update({ status: "cancelled" }).in("id", [...keep]);
  const itemStatus: VisitStatus = input.status === "cancelled" ? "cancelled" : input.status;
  for (const [i, l] of lines.entries()) {
    const brk = i === lastIdx ? Math.max(0, input.breakMin) : 0;
    const starts = localToIso(input.date, l.time);
    const ends = new Date(new Date(starts).getTime() + (l.duration + brk) * 60000).toISOString();
    const row = { service_id: l.serviceId, service_name: l.serviceName.trim().slice(0, 200), staff_id: l.staffId, starts_at: starts, ends_at: ends, price: Math.max(0, l.price), discount: Math.max(0, Math.min(l.price, l.discount)), break_min: brk, status: itemStatus };
    const { error } = l.id ? await supabase.from("visit_items").update(row).eq("id", l.id) : await supabase.from("visit_items").insert({ ...row, visit_id: input.visitId });
    if (error) {
      // geri al: kalanları eski durumlarına döndür
      if (keep.size) await supabase.from("visit_items").update({ status: before.status as VisitStatus }).in("id", [...keep]).eq("status", "cancelled");
      return { ok: false as const, error: /overlap|23P01/.test(error.message + error.code) ? `${l.time} — bu personelin o saatte başka randevusu var.` : error.message };
    }
  }

  const changes: string[] = [];
  if (before.visit_date !== input.date) changes.push(`tarih ${before.visit_date} → ${input.date}`);
  if (before.status !== input.status) changes.push(`durum ${before.status} → ${input.status}`);
  if ((before.notes ?? "") !== input.notes) changes.push("yorum değişti");
  if (before.customer_id !== (input.isAnonymous ? null : input.customerId)) changes.push("müşteri değişti");
  const bItems = (before.items ?? []).map((i) => `${HHMM(i.starts_at)} ${i.service_name} ${Number(i.price) - Number(i.discount)}`).sort().join(" | ");
  const aItems = lines.map((l) => `${l.time} ${l.serviceName} ${l.price - l.discount}`).sort().join(" | ");
  if (bItems !== aItems) changes.push(`hizmetler: ${aItems}`);
  if (removed.length) changes.push(`${removed.length} kalem silindi`);
  if (changes.length) await audit("güncellendi", input.visitId, changes);

  revalidatePath("/panel/takvim"); revalidatePath("/panel");
  return { ok: true as const };
}

export async function setVisitFlag(visitId: string, status: VisitStatus) {
  const { supabase } = await requireOps();
  const { data: v } = await supabase.from("visits").select("status, customer_id").eq("id", visitId).single();
  const { error } = await supabase.from("visits").update({ status }).eq("id", visitId);
  if (error) return { ok: false as const, error: error.message };
  await supabase.from("visit_items").update({ status }).eq("visit_id", visitId).neq("status", "cancelled");
  if (status === "no_show" && v?.status !== "no_show" && v?.customer_id) {
    const { data: c } = await supabase.from("customers").select("no_show_count").eq("id", v.customer_id).single();
    await supabase.from("customers").update({ no_show_count: (c?.no_show_count ?? 0) + 1 }).eq("id", v.customer_id);
  }
  await audit({ confirmed: "onaylandı", pending: "onay bekliyor", arrived: "geldi", no_show: "gelmedi", cancelled: "iptal edildi", completed: "tamamlandı" }[status] ?? status, visitId, { from: v?.status, to: status });
  revalidatePath("/panel/takvim"); revalidatePath("/panel");
  return { ok: true as const };
}

/** Aynı hizmetleri başka tarihe kopyalar (aynı saat, aynı personel) */
export async function repeatVisit(visitId: string, targetDate: string) {
  const { supabase, user } = await requireOps();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return { ok: false as const, error: "Tarih geçersiz." };
  const { data: v } = await supabase.from("visits").select("customer_id, notes, color, remind_offsets, remind_confirm, review_request, items:visit_items(service_id, service_name, staff_id, starts_at, ends_at, price, discount, status, break_min)").eq("id", visitId).single();
  if (!v) return { ok: false as const, error: "Ziyaret bulunamadı." };
  let target: string | null = null;
  if (v.customer_id) { const { data: ex } = await supabase.from("visits").select("id").eq("customer_id", v.customer_id).eq("visit_date", targetDate).neq("status", "cancelled").maybeSingle(); target = ex?.id ?? null; }
  if (!target) {
    const { data: nv, error } = await supabase.from("visits").insert({ customer_id: v.customer_id, visit_date: targetDate, status: "confirmed", source: "salon", notes: v.notes, color: v.color, remind_offsets: v.remind_offsets, remind_confirm: v.remind_confirm, review_request: v.review_request, created_by: user.id }).select("id").single();
    if (error || !nv) return { ok: false as const, error: error?.message ?? "Ziyaret açılamadı" };
    target = nv.id;
  }
  for (const i of v.items.filter((x) => x.status !== "cancelled")) {
    const starts = localToIso(targetDate, HHMM(i.starts_at));
    const ends = new Date(new Date(starts).getTime() + (new Date(i.ends_at).getTime() - new Date(i.starts_at).getTime())).toISOString();
    const { error } = await supabase.from("visit_items").insert({ visit_id: target, service_id: i.service_id, service_name: i.service_name, staff_id: i.staff_id, starts_at: starts, ends_at: ends, price: Number(i.price), discount: Number(i.discount), break_min: i.break_min, status: "confirmed" });
    if (error) return { ok: false as const, error: /overlap|23P01/.test(error.message + error.code) ? `${targetDate} ${HHMM(i.starts_at)} — personel o saatte dolu.` : error.message };
  }
  await audit("tekrarlandı", visitId, { to: targetDate, visit: target });
  revalidatePath("/panel/takvim");
  return { ok: true as const, visitId: target, date: targetDate };
}

export async function checkPromo(code: string) {
  const { supabase } = await requireOps();
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false as const, error: "Kod girin." };
  const { data } = await supabase.from("promo_codes").select("percent, description, valid_until, is_active").eq("code", c).maybeSingle();
  if (!data || !data.is_active) return { ok: false as const, error: "Geçersiz kod." };
  if (data.valid_until && data.valid_until < todayIso()) return { ok: false as const, error: "Kodun süresi dolmuş." };
  return { ok: true as const, percent: Number(data.percent), description: data.description };
}

export async function addVisitFile(input: { visitId: string; customerId: string | null; path: string; name: string; mime: string; size: number }) {
  const { supabase, user } = await requireOps();
  const { error } = await supabase.from("visit_files").insert({ visit_id: input.visitId, customer_id: input.customerId, storage_path: input.path, file_name: input.name.slice(0, 200), mime: input.mime, size_bytes: input.size, created_by: user.id });
  if (error) return { ok: false as const, error: error.message };
  await audit("dosya eklendi", input.visitId, { file: input.name });
  return { ok: true as const };
}

export async function deleteVisitFile(id: string) {
  const { supabase } = await requireOps();
  const { data: f } = await supabase.from("visit_files").select("visit_id, storage_path, file_name").eq("id", id).single();
  if (!f) return { ok: false as const, error: "Dosya yok." };
  await supabase.storage.from("visit-files").remove([f.storage_path]);
  await supabase.from("visit_files").delete().eq("id", id);
  await audit("dosya silindi", f.visit_id, { file: f.file_name });
  return { ok: true as const };
}

/** Müşterinin o gün için boş zamanı hesaplamak için personelin gün içi kalemleri */
export async function staffDayItems(date: string) {
  const { supabase } = await requireOps();
  const s = new Date(`${date}T00:00:00+03:00`).toISOString(), e = new Date(`${date}T23:59:59+03:00`).toISOString();
  const { data } = await supabase.from("visit_items").select("id, staff_id, starts_at, ends_at, status").gte("starts_at", s).lte("starts_at", e).not("status", "in", "(cancelled,no_show)");
  return (data ?? []).map((i) => ({ id: i.id, staffId: i.staff_id, start: HHMM(i.starts_at), end: HHMM(i.ends_at), day: ISTANBUL(i.starts_at) }));
}


/** Düzenleme ekranında yeni müşteri: telefon kayıtlıysa onu döndürür */
export async function quickCustomer(input: { first_name: string; last_name: string; phone: string }) {
  const { supabase } = await requireOps();
  const first = input.first_name.trim();
  if (!first) return { ok: false as const, error: "Ad gerekli." };
  const phone = normalizePhone(input.phone ?? "");
  if (phone) {
    const { data: ex } = await supabase.from("customers").select("id, first_name, last_name, phone").eq("phone", phone).maybeSingle();
    if (ex) return { ok: true as const, customer: ex };
  }
  const { data, error } = await supabase.from("customers").insert({ first_name: first, last_name: input.last_name.trim(), phone, source: "salon" }).select("id, first_name, last_name, phone").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Müşteri oluşturulamadı" };
  return { ok: true as const, customer: data };
}
