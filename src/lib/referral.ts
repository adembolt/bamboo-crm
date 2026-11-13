import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Davet edilen müşterinin ilk ödemeli ziyaretinde, öneren müşteriye aktif teklifin puanı bir kez yazılır. */
export async function awardReferral(db: SupabaseClient<Database>, inviteeId: string, saleId: string) {
  const { data: c } = await db.from("customers").select("referred_by").eq("id", inviteeId).maybeSingle();
  if (!c?.referred_by || c.referred_by === inviteeId) return;
  const { data: done } = await db.from("referral_rewards").select("id").eq("invitee_id", inviteeId).maybeSingle();
  if (done) return;
  const { count } = await db.from("sales").select("id", { count: "exact", head: true }).eq("customer_id", inviteeId).neq("id", saleId);
  if ((count ?? 0) > 0) return; // ilk ziyaret değil
  const { data: offer } = await db.from("referral_offers").select("id, referrer_points").eq("is_active", true).order("created_at").limit(1).maybeSingle();
  if (!offer || offer.referrer_points <= 0) return;
  const { error } = await db.from("referral_rewards").insert({ invitee_id: inviteeId, referrer_id: c.referred_by, offer_id: offer.id, points: offer.referrer_points, sale_id: saleId });
  if (error) return; // aynı anda ikinci kez yazılmasın (invitee_id tekil)
  const { data: r } = await db.from("customers").select("loyalty_points").eq("id", c.referred_by).single();
  await db.from("customers").update({ loyalty_points: (r?.loyalty_points ?? 0) + offer.referrer_points }).eq("id", c.referred_by);
  await db.from("loyalty_ledger").insert({ customer_id: c.referred_by, points: offer.referrer_points, reason: "Referans ödülü", sale_id: saleId });
}
