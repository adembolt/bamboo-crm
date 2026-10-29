import { requireManager } from "@/lib/auth";
import { addDays, todayIso } from "@/lib/format";

/** Müşteri listesini CSV (Excel uyumlu, UTF-8 BOM, ; ayraçlı) olarak indirir */
export async function GET(req: Request) {
  const { supabase } = await requireManager();
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim(), f = sp.get("f") ?? "";
  const today = todayIso();
  let query = supabase.from("customer_list").select("*").order("first_name").limit(10000);
  if (q) { const like = `%${q.replace(/[%,()]/g, " ")}%`; query = query.or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like}`); }
  if (f === "upcoming") query = query.not("next_visit", "is", null);
  if (f === "lost") query = query.lt("last_visit", addDays(today, -60)).is("next_visit", null);
  if (f === "birthday") query = query.lte("bday_in", 7);
  if (f === "vip") query = query.gt("spent", 0);
  if (f === "balance") query = query.gt("balance", 0);
  if (f === "package") query = query.gt("packages", 0);
  if (f === "noshow") query = query.gt("no_show_count", 0);
  if (f === "new") query = query.gte("created_at", addDays(today, -30));
  const { data } = await query;
  const head = ["Ad", "Soyad", "Telefon", "Dil", "Doğum tarihi", "Son ziyaret", "Sonraki randevu", "Ziyaret", "Harcama", "Bakiye", "Puan", "Aktif paket", "Gelmeme", "Pazarlama izni", "Etiketler"];
  const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = (data ?? []).map((c) => [c.first_name, c.last_name, c.phone, c.locale, c.birth_date, c.last_visit, c.next_visit, c.visits, Number(c.spent).toFixed(2).replace(".", ","), Number(c.balance).toFixed(2).replace(".", ","), c.loyalty_points, c.packages, c.no_show_count, c.consent_marketing ? "evet" : "hayır", (c.tags ?? []).join(", ")].map(esc).join(";"));
  const csv = "﻿" + [head.join(";"), ...lines].join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bamboo-musteriler-${today}.csv"` } });
}
