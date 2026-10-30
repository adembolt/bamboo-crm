"use server";
import { createAdminClient } from "@/lib/supabase/server";

/** Ziyaret sonrası puan: müşteri giriş yapmadan, ziyarete özel bağlantıyla */
export async function submitReview(token: string, rating: number, body: string) {
  if (!/^[0-9a-f]{20,64}$/.test(token)) return { ok: false as const };
  const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
  if (!r) return { ok: false as const };
  const db = createAdminClient();
  const { data: v } = await db.from("visits").select("id, customer_id, customer:customers(first_name, last_name), items:visit_items(staff_id, status)").eq("review_token", token).maybeSingle();
  if (!v) return { ok: false as const };
  const staffId = (v.items ?? []).find((i: { staff_id: string | null; status: string }) => i.staff_id && i.status !== "cancelled")?.staff_id ?? null;
  const cust = v.customer as { first_name: string; last_name: string } | null;
  const row = { visit_id: v.id, customer_id: v.customer_id, author_name: cust ? `${cust.first_name} ${cust.last_name}`.trim() : "", staff_id: staffId, rating: r, body: String(body ?? "").slice(0, 2000), source: "salon", is_public: r >= 4, handled: r >= 4 };
  const { data: ex } = await db.from("reviews").select("id").eq("visit_id", v.id).eq("source", "salon").maybeSingle();
  const { error } = ex ? await db.from("reviews").update(row).eq("id", ex.id) : await db.from("reviews").insert(row);
  if (error) return { ok: false as const };
  const { data: st } = await db.from("settings").select("google_review_url").eq("id", 1).single();
  return { ok: true as const, google: r >= 4 ? st?.google_review_url || null : null };
}
