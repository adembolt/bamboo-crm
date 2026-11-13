"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

export async function saveLoyalty(fd: FormData) {
  const { supabase } = await requireManager();
  const n = (k: string, d: number) => { const v = Number(String(fd.get(k) ?? "").replace(",", ".")); return Number.isFinite(v) && v >= 0 ? v : d; };
  await supabase.from("settings").update({ loyalty_earn_percent: n("loyalty_earn_percent", 0), loyalty_point_value: n("loyalty_point_value", 1), package_default_months: Math.round(n("package_default_months", 6)) || 6 }).eq("id", 1);
  revalidatePath("/panel/musteriler/sadakat");
}
