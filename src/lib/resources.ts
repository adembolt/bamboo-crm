import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/* Kabin / cihaz (kaynak) kontrolü: hizmete kaynak atanmışsa randevu o kaynaklardan boş olanına yazılır.
   Kaynak atanmamış hizmette kontrol yok (eski davranış). */
export async function pickResource(db: SupabaseClient<Database>, serviceId: string | null, startsAt: string, endsAt: string, excludeItemId?: string | null, prefer?: string | null): Promise<{ ok: true; resourceId: string | null } | { ok: false; names: string }> {
  if (!serviceId) return { ok: true, resourceId: null };
  const { data: links } = await db.from("service_resources").select("resource_id, resource:resources(id, name, capacity, is_active, sort_order)").eq("service_id", serviceId);
  const res = ((links ?? []) as unknown as { resource: { id: string; name: string; capacity: number; is_active: boolean; sort_order: number } | null }[])
    .map((l) => l.resource).filter((r): r is NonNullable<typeof r> => !!r && r.is_active).sort((a, b) => a.sort_order - b.sort_order);
  if (!res.length) return { ok: true, resourceId: null };
  let q = db.from("visit_items").select("id, resource_id").in("resource_id", res.map((r) => r.id)).lt("starts_at", endsAt).gt("ends_at", startsAt).not("status", "in", "(cancelled,no_show)");
  if (excludeItemId) q = q.neq("id", excludeItemId);
  const { data: busy } = await q;
  const used = new Map<string, number>();
  for (const b of busy ?? []) if (b.resource_id) used.set(b.resource_id, (used.get(b.resource_id) ?? 0) + 1);
  const order = prefer ? [...res.filter((r) => r.id === prefer), ...res.filter((r) => r.id !== prefer)] : res;
  const free = order.find((r) => (used.get(r.id) ?? 0) < Math.max(1, r.capacity));
  return free ? { ok: true, resourceId: free.id } : { ok: false, names: res.map((r) => r.name).join(" / ") };
}
