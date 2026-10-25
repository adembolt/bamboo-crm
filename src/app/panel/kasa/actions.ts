"use server";
import { revalidatePath } from "next/cache";
import { requireOps, requireManager } from "@/lib/auth";
import type { PayMethod } from "@/lib/database.types";

export type CloseVisitInput = {
  visitId: string;
  discountPercent: number;
  payments: { method: PayMethod; amount: number; ref?: string }[]; // ref: hediye çeki kodu
  notes?: string;
  itemOverrides?: Record<string, number>; // visit_item_id -> fiyat
  packageUse?: Record<string, string>;    // visit_item_id -> customer_package_id (paketten düş, fiyat 0)
};

/** Ziyareti kapatır: satış + kalemler + ödemeler oluşturur, ziyareti 'completed' yapar. */
export async function closeVisit(input: CloseVisitInput) {
  const { supabase, user } = await requireOps();
  const { data: visit } = await supabase.from("visits").select("id, customer_id, visit_date, status").eq("id", input.visitId).single();
  if (!visit) return { ok: false as const, error: "Ziyaret bulunamadı." };
  const { data: existing } = await supabase.from("sales").select("id").eq("visit_id", visit.id).maybeSingle();
  if (existing) return { ok: false as const, error: "Bu ziyaret zaten kapatılmış." };

  const { data: items } = await supabase.from("visit_items").select("id, service_name, staff_id, price, discount, status").eq("visit_id", visit.id).neq("status", "cancelled");
  const pkgUse = input.packageUse ?? {};
  // Paketten düşülecek kalemler: paket kalan seans kontrolü
  const pkgIds = [...new Set(Object.values(pkgUse))];
  const { data: pkgs } = pkgIds.length ? await supabase.from("customer_packages").select("id, total_sessions, used_sessions, is_active, customer_id").in("id", pkgIds) : { data: [] };
  for (const pid of pkgIds) {
    const p = pkgs?.find((x) => x.id === pid); const need = Object.values(pkgUse).filter((x) => x === pid).length;
    if (!p || !p.is_active || p.customer_id !== visit.customer_id) return { ok: false as const, error: "Paket bulunamadı." };
    if (p.total_sessions - p.used_sessions < need) return { ok: false as const, error: "Pakette yeterli seans yok." };
  }
  const lines = (items ?? []).map((i) => {
    const fromPkg = !!pkgUse[i.id];
    const unit = fromPkg ? 0 : input.itemOverrides?.[i.id] ?? Number(i.price);
    const disc = fromPkg ? 0 : Number(i.discount);
    return { visit_item_id: i.id, kind: "service" as const, name: fromPkg ? `${i.service_name} (paket)` : i.service_name, staff_id: i.staff_id, qty: 1, unit_price: unit, discount: disc, total: unit - disc };
  });
  // Hediye çeki / puan ödemeleri: bakiye kontrolü
  const gcPays = input.payments.filter((p) => p.method === "gift_card" && Number(p.amount) > 0);
  const { data: cards } = gcPays.length ? await supabase.from("gift_cards").select("id, code, balance, expires_at").in("code", gcPays.map((p) => String(p.ref ?? "").trim().toUpperCase())) : { data: [] };
  for (const p of gcPays) {
    const c = cards?.find((x) => x.code === String(p.ref ?? "").trim().toUpperCase());
    if (!c) return { ok: false as const, error: `Hediye çeki bulunamadı: ${p.ref ?? ""}` };
    if (c.expires_at && c.expires_at < visit.visit_date) return { ok: false as const, error: `Hediye çeki süresi dolmuş: ${c.code}` };
    if (Number(c.balance) < Number(p.amount)) return { ok: false as const, error: `Çek bakiyesi yetersiz (${c.code}: ${c.balance}).` };
  }
  const { data: settings } = await supabase.from("settings").select("loyalty_earn_percent, loyalty_point_value").eq("id", 1).single();
  const pointPays = input.payments.filter((p) => p.method === "points" && Number(p.amount) > 0).reduce((s, p) => s + Number(p.amount), 0);
  let customerPoints = 0;
  if (visit.customer_id) { const { data: cu } = await supabase.from("customers").select("loyalty_points").eq("id", visit.customer_id).single(); customerPoints = cu?.loyalty_points ?? 0; }
  const pointValue = Number(settings?.loyalty_point_value ?? 1) || 1;
  const pointsNeeded = Math.ceil(pointPays / pointValue);
  if (pointPays > 0 && (!visit.customer_id || customerPoints < pointsNeeded)) return { ok: false as const, error: `Yeterli puan yok (mevcut ${customerPoints}, gereken ${pointsNeeded}).` };
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discount = Math.round(subtotal * (Math.max(0, Math.min(100, input.discountPercent)) / 100) * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const paid = input.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (Math.abs(paid - total) > 0.5) return { ok: false as const, error: `Ödeme toplamı (${paid}) tutarla (${total}) eşleşmiyor.` };

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({ visit_id: visit.id, customer_id: visit.customer_id, sale_date: visit.visit_date, subtotal, discount, total, notes: input.notes ?? "", created_by: user.id })
    .select("id")
    .single();
  if (error || !sale) return { ok: false as const, error: error?.message ?? "Satış oluşturulamadı" };

  // İndirimi kalemlere oransal dağıt (hak ediş net tutar üzerinden)
  const factor = subtotal > 0 ? total / subtotal : 1;
  await supabase.from("sale_items").insert(lines.map((l) => ({ ...l, sale_id: sale.id, total: Math.round(l.total * factor * 100) / 100 })));
  const pays = input.payments.filter((p) => Number(p.amount) > 0).map((p) => ({ sale_id: sale.id, method: p.method, amount: Number(p.amount), ref: String(p.ref ?? "").trim().toUpperCase() }));
  if (pays.length) await supabase.from("sale_payments").insert(pays);
  // Paket seans düşümü
  for (const [itemId, pid] of Object.entries(pkgUse)) {
    const p = (pkgs ?? []).find((x) => x.id === pid);
    if (!p) continue;
    const used = (p.used_sessions += 1);
    await supabase.from("customer_packages").update({ used_sessions: used, is_active: used < p.total_sessions }).eq("id", pid);
    await supabase.from("visit_items").update({ package_id: pid, price: 0, discount: 0 }).eq("id", itemId);
  }
  // Hediye çeki bakiyesi
  for (const p of gcPays) {
    const c = cards!.find((x) => x.code === String(p.ref ?? "").trim().toUpperCase())!;
    await supabase.from("gift_cards").update({ balance: Number(c.balance) - Number(p.amount) }).eq("id", c.id);
    await supabase.from("gift_card_uses").insert({ gift_card_id: c.id, sale_id: sale.id, amount: Number(p.amount) });
  }
  // Sadakat puanı: kullanım ve kazanım (hediye çeki/paket/puan dışı ödemeler üzerinden)
  if (visit.customer_id) {
    const earnBase = pays.filter((p) => !["gift_card", "points", "package"].includes(p.method)).reduce((s, p) => s + p.amount, 0);
    const earned = Math.floor(earnBase * Number(settings?.loyalty_earn_percent ?? 0) / 100);
    const delta = earned - pointsNeeded;
    if (pointsNeeded) await supabase.from("loyalty_ledger").insert({ customer_id: visit.customer_id, points: -pointsNeeded, reason: "Ödemede kullanıldı", sale_id: sale.id });
    if (earned) await supabase.from("loyalty_ledger").insert({ customer_id: visit.customer_id, points: earned, reason: "Ziyaret kazanımı", sale_id: sale.id });
    if (delta) await supabase.from("customers").update({ loyalty_points: customerPoints + delta }).eq("id", visit.customer_id);
  }
  await supabase.from("visits").update({ status: "completed", discount_percent: input.discountPercent }).eq("id", visit.id);
  await supabase.from("visit_items").update({ status: "completed" }).eq("visit_id", visit.id).neq("status", "cancelled");

  revalidatePath("/panel/kasa"); revalidatePath("/panel/takvim"); revalidatePath("/panel");
  return { ok: true as const, saleId: sale.id, total };
}

export async function voidSale(saleId: string) {
  const { supabase } = await requireManager();
  const { data: sale } = await supabase.from("sales").select("visit_id, customer_id").eq("id", saleId).single();
  // Geri al: paket seansları, hediye çeki bakiyesi, puanlar
  if (sale?.visit_id) {
    const { data: its } = await supabase.from("visit_items").select("id, package_id").eq("visit_id", sale.visit_id).not("package_id", "is", null);
    for (const it of its ?? []) {
      const { data: p } = await supabase.from("customer_packages").select("used_sessions").eq("id", it.package_id!).single();
      if (p) await supabase.from("customer_packages").update({ used_sessions: Math.max(0, p.used_sessions - 1), is_active: true }).eq("id", it.package_id!);
      await supabase.from("visit_items").update({ package_id: null }).eq("id", it.id);
    }
  }
  const { data: uses } = await supabase.from("gift_card_uses").select("gift_card_id, amount").eq("sale_id", saleId);
  for (const u of uses ?? []) { const { data: c } = await supabase.from("gift_cards").select("balance").eq("id", u.gift_card_id).single(); if (c) await supabase.from("gift_cards").update({ balance: Number(c.balance) + Number(u.amount) }).eq("id", u.gift_card_id); }
  const { data: led } = await supabase.from("loyalty_ledger").select("points").eq("sale_id", saleId);
  const back = (led ?? []).reduce((s, l) => s + l.points, 0);
  if (back && sale?.customer_id) { const { data: cu } = await supabase.from("customers").select("loyalty_points").eq("id", sale.customer_id).single(); await supabase.from("customers").update({ loyalty_points: (cu?.loyalty_points ?? 0) - back }).eq("id", sale.customer_id); }
  // Paket / hediye çeki satışı iptal: paket pasife, kullanılmamış çek silinir
  await supabase.from("customer_packages").update({ is_active: false, notes: "Satış iptal edildi" }).eq("sale_id", saleId);
  const { data: gcs } = await supabase.from("gift_cards").select("id, initial_amount, balance").eq("sale_id", saleId);
  for (const g of gcs ?? []) { if (Number(g.balance) === Number(g.initial_amount)) await supabase.from("gift_cards").delete().eq("id", g.id); else await supabase.from("gift_cards").update({ balance: 0, notes: "Satış iptal edildi" }).eq("id", g.id); }
  const { error } = await supabase.from("sales").delete().eq("id", saleId);
  if (error) return { ok: false as const, error: error.message };
  if (sale?.visit_id) await supabase.from("visits").update({ status: "arrived" }).eq("id", sale.visit_id);
  revalidatePath("/panel/kasa"); revalidatePath("/panel/takvim");
  return { ok: true as const };
}

export async function addExpense(_prev: { error: string }, formData: FormData) {
  const { supabase, user } = await requireOps();
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!amount || amount <= 0) return { error: "Tutar gerekli." };
  const { error } = await supabase.from("expenses").insert({
    expense_date: String(formData.get("date")),
    category: String(formData.get("category") ?? "genel"),
    description: String(formData.get("description") ?? "").trim(),
    amount,
    method: String(formData.get("method") ?? "cash") as PayMethod,
    staff_id: String(formData.get("staff_id") ?? "") || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/kasa");
  return { error: "" };
}

export async function deleteExpense(id: string) {
  const { supabase } = await requireOps();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/panel/kasa");
}

export async function addPayout(_prev: { error: string }, formData: FormData) {
  const { supabase, user } = await requireManager();
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!amount) return { error: "Tutar gerekli." };
  const { error } = await supabase.from("staff_payouts").insert({
    staff_id: String(formData.get("staff_id")),
    period_start: String(formData.get("period_start")),
    period_end: String(formData.get("period_end")),
    amount,
    method: String(formData.get("method") ?? "cash") as PayMethod,
    notes: String(formData.get("notes") ?? ""),
    paid_at: String(formData.get("paid_at") || formData.get("period_end")),
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/kasa");
  return { error: "" };
}

/** Seans paketi satışı: kasa satışı + müşteri paketi */
export async function sellPackage(input: { customerId: string; serviceId: string | null; name: string; sessions: number; price: number; expiresAt: string | null; staffId: string | null; saleDate: string; payments: { method: PayMethod; amount: number; ref?: string }[]; notes?: string }) {
  const { supabase, user } = await requireOps();
  if (!input.name.trim() || input.sessions < 1) return { ok: false as const, error: "Paket adı ve seans sayısı gerekli." };
  const paid = input.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (Math.abs(paid - input.price) > 0.5) return { ok: false as const, error: `Ödeme toplamı (${paid}) tutarla (${input.price}) eşleşmiyor.` };
  const { data: sale, error } = await supabase.from("sales").insert({ customer_id: input.customerId, sale_date: input.saleDate, subtotal: input.price, discount: 0, total: input.price, notes: input.notes ?? "Paket satışı", created_by: user.id }).select("id").single();
  if (error || !sale) return { ok: false as const, error: error?.message ?? "Satış oluşturulamadı" };
  await supabase.from("sale_items").insert({ sale_id: sale.id, kind: "package", name: `${input.name} (${input.sessions} seans)`, staff_id: input.staffId, qty: 1, unit_price: input.price, discount: 0, total: input.price });
  const pays = input.payments.filter((p) => Number(p.amount) > 0).map((p) => ({ sale_id: sale.id, method: p.method, amount: Number(p.amount), ref: String(p.ref ?? "").toUpperCase() }));
  if (pays.length) await supabase.from("sale_payments").insert(pays);
  const { error: e2 } = await supabase.from("customer_packages").insert({ customer_id: input.customerId, service_id: input.serviceId, name: input.name.trim(), total_sessions: input.sessions, price_paid: input.price, purchased_at: input.saleDate, expires_at: input.expiresAt, notes: input.notes ?? "", sale_id: sale.id });
  if (e2) return { ok: false as const, error: e2.message };
  revalidatePath("/panel/kasa"); revalidatePath(`/panel/musteriler/${input.customerId}`);
  return { ok: true as const };
}

export async function adjustPackage(id: string, patch: { used_sessions?: number; is_active?: boolean; expires_at?: string | null; notes?: string }) {
  const { supabase } = await requireOps();
  const { error } = await supabase.from("customer_packages").update(patch).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/panel/musteriler");
  return { ok: true as const };
}

/** Hediye çeki satışı */
export async function sellGiftCard(input: { amount: number; buyerName: string; customerId: string | null; expiresAt: string | null; saleDate: string; payments: { method: PayMethod; amount: number }[]; notes?: string }) {
  const { supabase, user } = await requireOps();
  if (!(input.amount > 0)) return { ok: false as const, error: "Tutar gerekli." };
  const paid = input.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (Math.abs(paid - input.amount) > 0.5) return { ok: false as const, error: `Ödeme toplamı (${paid}) tutarla (${input.amount}) eşleşmiyor.` };
  const { data: sale, error } = await supabase.from("sales").insert({ customer_id: input.customerId, sale_date: input.saleDate, subtotal: input.amount, discount: 0, total: input.amount, notes: "Hediye çeki satışı", created_by: user.id }).select("id").single();
  if (error || !sale) return { ok: false as const, error: error?.message ?? "Satış oluşturulamadı" };
  await supabase.from("sale_items").insert({ sale_id: sale.id, kind: "gift_card", name: "Hediye çeki", staff_id: null, qty: 1, unit_price: input.amount, discount: 0, total: input.amount });
  const pays = input.payments.filter((p) => Number(p.amount) > 0).map((p) => ({ sale_id: sale.id, method: p.method, amount: Number(p.amount) }));
  if (pays.length) await supabase.from("sale_payments").insert(pays);
  let code = ""; let tries = 0;
  while (tries++ < 5) {
    code = "BB-" + Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { error: e } = await supabase.from("gift_cards").insert({ code, initial_amount: input.amount, balance: input.amount, buyer_name: input.buyerName.trim(), customer_id: input.customerId, sale_id: sale.id, expires_at: input.expiresAt, notes: input.notes ?? "", created_by: user.id });
    if (!e) break; if (tries >= 5) return { ok: false as const, error: e.message };
  }
  revalidatePath("/panel/kasa"); revalidatePath("/panel/kasa/hediye");
  return { ok: true as const, code };
}

export async function adjustPoints(customerId: string, points: number, reason: string) {
  const { supabase } = await requireManager();
  const { data: cu } = await supabase.from("customers").select("loyalty_points").eq("id", customerId).single();
  await supabase.from("loyalty_ledger").insert({ customer_id: customerId, points, reason: reason || "Elle düzeltme" });
  await supabase.from("customers").update({ loyalty_points: (cu?.loyalty_points ?? 0) + points }).eq("id", customerId);
  revalidatePath(`/panel/musteriler/${customerId}`);
  return { ok: true as const };
}
