"use server";
import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import type { PayMethod } from "@/lib/database.types";

const num = (v: FormDataEntryValue | null, d = 0) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : d; };

export async function saveProduct(_prev: { error: string; ok?: boolean }, fd: FormData) {
  const { supabase } = await requireOps();
  const id = String(fd.get("id") ?? "");
  const row = {
    name: String(fd.get("name") ?? "").trim(),
    brand: String(fd.get("brand") ?? "").trim(),
    category: String(fd.get("category") ?? "").trim(),
    barcode: String(fd.get("barcode") ?? "").trim(),
    unit: String(fd.get("unit") ?? "adet").trim() || "adet",
    sale_price: num(fd.get("sale_price")),
    cost_price: num(fd.get("cost_price")),
    min_stock: num(fd.get("min_stock")),
    is_retail: fd.get("is_retail") === "on",
    is_active: fd.get("is_active") !== "off",
    notes: String(fd.get("notes") ?? ""),
    updated_at: new Date().toISOString(),
  };
  if (!row.name) return { error: "Ürün adı gerekli." };
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const initial = num(fd.get("initial_stock"));
    const { data, error } = await supabase.from("products").insert({ ...row, stock_qty: 0 }).select("id").single();
    if (error || !data) return { error: error?.message ?? "Kaydedilemedi" };
    if (initial) await applyMove(data.id, "adjust", initial, row.cost_price || null, "Açılış stoğu");
  }
  revalidatePath("/panel/urunler");
  return { error: "", ok: true };
}

/** Stok hareketi yazar ve ürün stoğunu günceller */
async function applyMove(productId: string, kind: "purchase" | "sale" | "use" | "adjust" | "return", qty: number, unitCost: number | null, note: string, extra?: { saleId?: string | null; staffId?: string | null }) {
  const { supabase, user } = await requireOps();
  const { data: p } = await supabase.from("products").select("stock_qty").eq("id", productId).single();
  if (!p) return { ok: false as const, error: "Ürün bulunamadı." };
  await supabase.from("stock_moves").insert({ product_id: productId, kind, qty, unit_cost: unitCost, note, sale_id: extra?.saleId ?? null, staff_id: extra?.staffId ?? null, created_by: user.id });
  const patch: { stock_qty: number; cost_price?: number; updated_at: string } = { stock_qty: Math.round((Number(p.stock_qty) + qty) * 100) / 100, updated_at: new Date().toISOString() };
  if (kind === "purchase" && unitCost && unitCost > 0) patch.cost_price = unitCost;
  await supabase.from("products").update(patch).eq("id", productId);
  return { ok: true as const };
}

export async function stockMove(input: { productId: string; kind: "purchase" | "use" | "adjust"; qty: number; unitCost?: number; note?: string; staffId?: string | null; countTo?: number; addExpense?: boolean; method?: PayMethod; date?: string }) {
  const { supabase, user } = await requireOps();
  let qty = Number(input.qty) || 0;
  if (input.kind === "adjust" && input.countTo !== undefined) {
    const { data: p } = await supabase.from("products").select("stock_qty").eq("id", input.productId).single();
    qty = Number(input.countTo) - Number(p?.stock_qty ?? 0);
    if (!qty) return { ok: true as const };
  }
  if (input.kind === "use") qty = -Math.abs(qty);
  if (input.kind === "purchase") qty = Math.abs(qty);
  if (!qty) return { ok: false as const, error: "Miktar gerekli." };
  const note = input.note ?? (input.kind === "adjust" ? "Sayım düzeltmesi" : "");
  const r = await applyMove(input.productId, input.kind, qty, input.unitCost ?? null, note, { staffId: input.staffId ?? null });
  if (!r.ok) return r;
  // Alışı gider olarak da kasaya yaz
  if (input.kind === "purchase" && input.addExpense && input.unitCost && input.unitCost > 0) {
    const { data: p } = await supabase.from("products").select("name").eq("id", input.productId).single();
    await supabase.from("expenses").insert({ expense_date: input.date ?? new Date().toISOString().slice(0, 10), category: "malzeme", description: `${p?.name ?? "Ürün"} × ${qty}`, amount: Math.round(qty * input.unitCost * 100) / 100, method: input.method ?? "cash", created_by: user.id });
    revalidatePath("/panel/kasa");
  }
  revalidatePath("/panel/urunler");
  return { ok: true as const };
}

export type ProductLine = { productId: string; qty: number; unitPrice: number; staffId: string | null };

/** Ürün satış kalemlerini satışa ekler ve stoktan düşer (kasa kapanışı ve doğrudan satış ortak) */
export async function addProductLines(saleId: string, lines: ProductLine[]) {
  const { supabase } = await requireOps();
  const valid = lines.filter((l) => l.productId && l.qty > 0);
  if (!valid.length) return;
  const { data: prods } = await supabase.from("products").select("id, name").in("id", valid.map((l) => l.productId));
  await supabase.from("sale_items").insert(valid.map((l) => ({ sale_id: saleId, kind: "product" as const, product_id: l.productId, name: prods?.find((p) => p.id === l.productId)?.name ?? "Ürün", staff_id: l.staffId, qty: l.qty, unit_price: l.unitPrice, discount: 0, total: Math.round(l.qty * l.unitPrice * 100) / 100 })));
  for (const l of valid) await applyMove(l.productId, "sale", -l.qty, null, "Satış", { saleId, staffId: l.staffId });
  revalidatePath("/panel/urunler");
}

/** Satış iptalinde stokları geri al */
export async function restockSale(saleId: string) {
  const { supabase } = await requireOps();
  const { data: moves } = await supabase.from("stock_moves").select("product_id, qty").eq("sale_id", saleId).eq("kind", "sale");
  for (const m of moves ?? []) await applyMove(m.product_id, "return", -Number(m.qty), null, "Satış iptali");
}

/** Ziyaretsiz doğrudan ürün satışı */
export async function sellProducts(input: { customerId: string | null; lines: ProductLine[]; payments: { method: PayMethod; amount: number; ref?: string }[]; saleDate: string; notes?: string }) {
  const { supabase, user } = await requireOps();
  const lines = input.lines.filter((l) => l.productId && l.qty > 0);
  if (!lines.length) return { ok: false as const, error: "En az bir ürün seçin." };
  const total = Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;
  const paid = input.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (Math.abs(paid - total) > 0.5) return { ok: false as const, error: `Ödeme toplamı (${paid}) tutarla (${total}) eşleşmiyor.` };
  if (input.payments.some((p) => ["gift_card", "points", "balance", "package"].includes(p.method) && Number(p.amount) > 0)) return { ok: false as const, error: "Doğrudan ürün satışında nakit/kart/havale kullanın; bakiye/çek için ziyaret üzerinden ödeme alın." };
  const { data: sale, error } = await supabase.from("sales").insert({ customer_id: input.customerId, sale_date: input.saleDate, subtotal: total, discount: 0, total, notes: input.notes ?? "Ürün satışı", created_by: user.id }).select("id").single();
  if (error || !sale) return { ok: false as const, error: error?.message ?? "Satış oluşturulamadı" };
  await addProductLines(sale.id, lines);
  const pays = input.payments.filter((p) => Number(p.amount) > 0).map((p) => ({ sale_id: sale.id, method: p.method, amount: Number(p.amount), ref: "" }));
  if (pays.length) await supabase.from("sale_payments").insert(pays);
  revalidatePath("/panel/kasa"); revalidatePath("/panel/urunler");
  return { ok: true as const, total };
}

/** Satış ekranları için aktif, satışa açık ürünler */
export async function listProductsForSale() {
  const { supabase } = await requireOps();
  const { data } = await supabase.from("products").select("id, name, brand, sale_price, stock_qty, unit").eq("is_active", true).eq("is_retail", true).order("name");
  return (data ?? []).map((p) => ({ ...p, sale_price: Number(p.sale_price), stock_qty: Number(p.stock_qty) }));
}
