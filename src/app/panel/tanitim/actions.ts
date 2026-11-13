"use server";
import { revalidatePath } from "next/cache";
import { requireManager, requireOps } from "@/lib/auth";

type Res = { ok: true } | { ok: false; error: string };

export async function saveOffer(i: { id?: string; name: string; referrerPoints: number; inviteeDiscount: number; isActive: boolean }): Promise<Res> {
  const { supabase } = await requireManager();
  if (!i.name.trim()) return { ok: false, error: "Teklif adı gerekli." };
  const row = { name: i.name.trim(), referrer_points: Math.max(0, Math.round(i.referrerPoints)), invitee_discount: Math.max(0, Math.min(100, i.inviteeDiscount)), is_active: i.isActive };
  const { error } = i.id ? await supabase.from("referral_offers").update(row).eq("id", i.id) : await supabase.from("referral_offers").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/tanitim/referans");
  return { ok: true };
}

export async function setReferrer(customerId: string, referrerId: string | null): Promise<Res> {
  const { supabase } = await requireOps();
  if (referrerId === customerId) return { ok: false, error: "Müşteri kendini öneremez." };
  const { error } = await supabase.from("customers").update({ referred_by: referrerId }).eq("id", customerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/panel/musteriler/${customerId}`); revalidatePath("/panel/tanitim/referans");
  return { ok: true };
}

export type DealInput = { id?: string; title: string; description: string; discountPercent: number | null; price: number | null; oldPrice: number | null; startsOn: string; endsOn: string | null; serviceIds: string[]; isPublished: boolean; isArchived: boolean };
export async function saveDeal(i: DealInput): Promise<Res> {
  const { supabase } = await requireManager();
  if (!i.title.trim()) return { ok: false, error: "Kampanya adı gerekli." };
  const d = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const row = { title: i.title.trim(), description: i.description.trim(), discount_percent: i.discountPercent && i.discountPercent > 0 ? Math.min(100, i.discountPercent) : null, price: i.price && i.price > 0 ? i.price : null, old_price: i.oldPrice && i.oldPrice > 0 ? i.oldPrice : null, starts_on: d(i.startsOn) ?? new Date().toISOString().slice(0, 10), ends_on: d(i.endsOn), service_ids: i.serviceIds, is_published: i.isPublished, is_archived: i.isArchived };
  const { error } = i.id ? await supabase.from("deals").update(row).eq("id", i.id) : await supabase.from("deals").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/tanitim/kampanyalar"); revalidatePath("/randevu");
  return { ok: true };
}
export async function deleteDeal(id: string): Promise<Res> {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/panel/tanitim/kampanyalar"); revalidatePath("/randevu");
  return { ok: true };
}
