"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

export async function saveResource(i: { id?: string | null; name: string; kind: "room" | "device" | "other"; capacity: number; active: boolean; categoryIds: string[] }) {
  const { supabase } = await requireManager();
  const name = i.name.trim(); if (!name) return { ok: false as const, error: "name" };
  const row = { name, kind: i.kind, capacity: Math.max(1, Math.min(20, Math.round(i.capacity) || 1)), is_active: i.active };
  let id = i.id ?? null;
  if (id) { const { error } = await supabase.from("resources").update(row).eq("id", id); if (error) return { ok: false as const, error: error.message }; }
  else { const { data, error } = await supabase.from("resources").insert(row).select("id").single(); if (error || !data) return { ok: false as const, error: error?.message ?? "insert" }; id = data.id; }
  // kategoriye göre atama: seçili kategorilerdeki tüm hizmetler bu kaynağı kullanır
  await supabase.from("service_resources").delete().eq("resource_id", id);
  if (i.categoryIds.length) {
    const { data: svcs } = await supabase.from("services").select("id").in("category_id", i.categoryIds);
    const rows = (svcs ?? []).map((s) => ({ service_id: s.id, resource_id: id! }));
    for (let k = 0; k < rows.length; k += 500) { const { error } = await supabase.from("service_resources").insert(rows.slice(k, k + 500)); if (error) return { ok: false as const, error: error.message }; }
  }
  revalidatePath("/panel/hizmetler/kaynaklar"); revalidatePath("/panel/takvim");
  return { ok: true as const };
}
export async function deleteResource(id: string) {
  const { supabase } = await requireManager();
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/hizmetler/kaynaklar"); return { ok: true as const };
}
