import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getSlots } from "@/lib/booking/availability";
import { localToIso, normalizePhone } from "@/lib/format";

type Body = {
  serviceId: string; staffId: string | null; date: string; time: string;
  firstName: string; lastName: string; phone: string; email: string; notes: string; locale: string; consent: boolean;
};

export async function POST(req: NextRequest) {
  let b: Body;
  try { b = (await req.json()) as Body; } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }

  const firstName = String(b.firstName ?? "").trim().slice(0, 80);
  const lastName = String(b.lastName ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(b.phone ?? ""));
  if (!firstName) return Response.json({ error: "name" }, { status: 422 });
  if (!/^\+\d{8,15}$/.test(phone)) return Response.json({ error: "phone" }, { status: 422 });
  if (!/^[0-9a-f-]{36}$/.test(b.serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !/^\d{2}:\d{2}$/.test(b.time)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = createHash("sha256").update(ip + "bamboo").digest("hex").slice(0, 32);
  const db = createAdminClient();

  // Basit hız sınırı: aynı IP'den son 10 dakikada en fazla 5 talep
  const since = new Date(Date.now() - 10 * 60000).toISOString();
  const { count } = await db.from("booking_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= 5) return Response.json({ error: "rate" }, { status: 429 });

  // Saat hâlâ uygun mu?
  const { slots, error } = await getSlots({ serviceId: b.serviceId, staffId: b.staffId || null, date: b.date });
  if (error === "closed") return Response.json({ error: "closed" }, { status: 403 });
  const slot = slots.find((s) => s.time === b.time);
  if (!slot) return Response.json({ error: "slot" }, { status: 409 });
  const staffId = b.staffId && slot.staffIds.includes(b.staffId) ? b.staffId : slot.staffIds[0] ?? null;

  const startsAt = localToIso(b.date, b.time);
  const { data: settings } = await db.from("settings").select("online_requires_approval").eq("id", 1).single();
  const locale = ["tr", "en", "ru", "de"].includes(b.locale) ? b.locale : "tr";

  const { data: reqRow, error: insErr } = await db
    .from("booking_requests")
    .insert({
      first_name: firstName, last_name: lastName, phone, email: String(b.email ?? "").trim().slice(0, 120), locale,
      service_id: b.serviceId, staff_id: staffId, starts_at: startsAt, notes: String(b.notes ?? "").trim().slice(0, 500), ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (insErr || !reqRow) return Response.json({ error: "generic" }, { status: 500 });

  // Onay gerekmiyorsa doğrudan takvime işle
  if (settings && !settings.online_requires_approval) {
    const { data: svc } = await db.from("services").select("id, name_tr, duration_min, buffer_min, price").eq("id", b.serviceId).single();
    let customerId: string | null = null;
    const { data: ex } = await db.from("customers").select("id").eq("phone", phone).maybeSingle();
    if (ex) customerId = ex.id;
    else {
      const { data: c } = await db.from("customers").insert({ first_name: firstName, last_name: lastName, phone, locale, source: "online", consent_marketing: !!b.consent, consent_at: b.consent ? new Date().toISOString() : null }).select("id").single();
      customerId = c?.id ?? null;
    }
    let visitId: string | null = null;
    if (customerId) {
      const { data: v } = await db.from("visits").select("id").eq("customer_id", customerId).eq("visit_date", b.date).neq("status", "cancelled").maybeSingle();
      visitId = v?.id ?? null;
    }
    if (!visitId) {
      const { data: v } = await db.from("visits").insert({ customer_id: customerId, visit_date: b.date, status: "confirmed", source: "online", notes: b.notes ?? "" }).select("id").single();
      visitId = v?.id ?? null;
    }
    if (svc && visitId) {
      const ends = new Date(new Date(startsAt).getTime() + (svc.duration_min + svc.buffer_min) * 60000).toISOString();
      const { error: itemErr } = await db.from("visit_items").insert({ visit_id: visitId, service_id: svc.id, service_name: svc.name_tr, staff_id: staffId, starts_at: startsAt, ends_at: ends, price: Number(svc.price), status: "confirmed" });
      if (!itemErr) {
        await db.from("booking_requests").update({ status: "approved", visit_id: visitId }).eq("id", reqRow.id);
        return Response.json({ ok: true, confirmed: true });
      }
    }
  }
  return Response.json({ ok: true, confirmed: false });
}
