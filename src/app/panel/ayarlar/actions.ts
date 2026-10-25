"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";

export async function saveSettings(formData: FormData) {
  const { supabase } = await requireManager();
  const num = (k: string, d: number) => Number(formData.get(k) ?? d) || d;
  const { error } = await supabase.from("settings").update({
    business_name: String(formData.get("business_name") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    whatsapp_number: String(formData.get("whatsapp_number") ?? ""),
    google_review_url: String(formData.get("google_review_url") ?? ""),
    instagram_url: String(formData.get("instagram_url") ?? ""),
    kdv_rate: num("kdv_rate", 0.2),
    loyalty_earn_percent: Number(formData.get("loyalty_earn_percent") ?? 0) || 0,
    loyalty_point_value: num("loyalty_point_value", 1),
    package_default_months: num("package_default_months", 6),
    open_time: String(formData.get("open_time") ?? "10:00"),
    close_time: String(formData.get("close_time") ?? "21:00"),
    slot_minutes: num("slot_minutes", 15),
    open_days: formData.getAll("open_days").map(Number),
    online_booking_enabled: formData.get("online_booking_enabled") === "on",
    online_requires_approval: formData.get("online_requires_approval") === "on",
    online_min_notice_minutes: num("online_min_notice_minutes", 120),
    online_max_days_ahead: num("online_max_days_ahead", 60),
    online_cancel_limit_minutes: num("online_cancel_limit_minutes", 240),
  }).eq("id", 1);
  if (error) redirect(`/panel/ayarlar?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/panel", "layout");
  redirect("/panel/ayarlar?saved=1");
}
