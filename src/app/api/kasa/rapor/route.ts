import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { computePayroll } from "@/lib/payroll";

/* Kasa raporu indirme: Excel (tüm sayfalar) veya tek sayfa CSV.
   GET /api/kasa/rapor?from=2026-10-01&to=2026-10-31&format=xlsx|csv&sheet=satislar */

export const maxDuration = 60;

const METHOD: Record<string, string> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online", package: "Paket", gift_card: "Hediye çeki", points: "Puan", balance: "Bakiye", other: "Diğer" };
const KIND: Record<string, string> = { service: "Hizmet", product: "Ürün", package: "Paket", gift_card: "Hediye çeki", balance: "Bakiye yükleme" };
const NOT_MONEY = ["gift_card", "points", "balance"];
const iso = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const r2 = (n: number) => Math.round(n * 100) / 100;
const trDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const hhmm = (ts: string) => new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(ts));

type Col = { header: string; key: string; width?: number; money?: boolean };
type Sheet = { key: string; name: string; cols: Col[]; rows: Record<string, string | number | null>[]; total?: string[] };

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || !["owner", "manager"].includes(prof.role)) return NextResponse.json({ error: "Bu rapor için yönetici yetkisi gerekir." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const from = iso(sp.get("from")), to = iso(sp.get("to"));
  if (!from || !to || from > to) return NextResponse.json({ error: "Tarih aralığı hatalı." }, { status: 400 });
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";

  // Supabase tek sorguda 1000 satır döner → sayfalayarak hepsini al
  async function all<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; ; i += 1000) { const { data } = await q(i, i + 999); out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
    return out;
  }

  type SaleRow = { id: string; sale_date: string; created_at: string; subtotal: number; discount: number; total: number; notes: string; customer: { first_name: string; last_name: string; phone: string } | null;
    items: { kind: string; name: string; staff_id: string | null; staff_name: string; qty: number; unit_price: number; discount: number; total: number; material_cost: number }[];
    payments: { method: string; amount: number }[] };
  const [sales, exps, { data: staff }, payouts, { data: settings }, payroll] = await Promise.all([
    all<SaleRow>((a, b) => supabase.from("sales").select("id, sale_date, created_at, subtotal, discount, total, notes, customer:customers(first_name, last_name, phone), items:sale_items(kind, name, staff_id, staff_name, qty, unit_price, discount, total, material_cost), payments:sale_payments(method, amount)").gte("sale_date", from).lte("sale_date", to).order("sale_date").order("created_at").range(a, b) as unknown as PromiseLike<{ data: SaleRow[] | null; error: unknown }>),
    all<{ expense_date: string; category: string; description: string; amount: number; method: string; staff_id: string | null }>((a, b) => supabase.from("expenses").select("expense_date, category, description, amount, method, staff_id").gte("expense_date", from).lte("expense_date", to).order("expense_date").range(a, b)),
    supabase.from("staff").select("id, full_name, is_active").order("sort_order"),
    all<{ staff_id: string; amount: number; paid_at: string; method: string; notes: string }>((a, b) => supabase.from("staff_payouts").select("staff_id, amount, paid_at, method, notes").gte("paid_at", `${from}T00:00:00+03:00`).lte("paid_at", `${to}T23:59:59+03:00`).range(a, b)),
    supabase.from("settings").select("kdv_rate, business_name").eq("id", 1).single(),
    computePayroll(supabase, from, to),
  ]);
  const staffName = (id: string | null) => staff?.find((s) => s.id === id)?.full_name ?? "";
  const cust = (s: SaleRow) => (s.customer ? `${s.customer.first_name} ${s.customer.last_name}`.trim() : "Anonim");
  const kdvRate = Number(settings?.kdv_rate ?? 0.2);

  // ---- hesaplar
  const byMethod: Record<string, number> = {};
  const byDay = new Map<string, { n: number; m: Record<string, number>; exp: number }>();
  const day = (d: string) => { if (!byDay.has(d)) byDay.set(d, { n: 0, m: {}, exp: 0 }); return byDay.get(d)!; };
  let materials = 0;
  for (const s of sales) {
    const D = day(s.sale_date); D.n++;
    for (const p of s.payments) { byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount); D.m[p.method] = (D.m[p.method] ?? 0) + Number(p.amount); }
    for (const i of s.items) materials += Number(i.material_cost ?? 0);
  }
  const byCat: Record<string, number> = {};
  for (const e of exps) { byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount); day(e.expense_date).exp += Number(e.amount); }
  const gross = Object.entries(byMethod).filter(([k]) => !NOT_MONEY.includes(k)).reduce((a, [, v]) => a + v, 0);
  const expTotal = exps.reduce((a, e) => a + Number(e.amount), 0);
  const payTotal = [...payroll.values()].reduce((a, p) => a + p.total, 0);
  const net = gross / (1 + kdvRate);

  const sheets: Sheet[] = [];
  sheets.push({
    key: "ozet", name: "Özet", cols: [{ header: "Kalem", key: "k", width: 42 }, { header: "Tutar (₺)", key: "v", width: 18, money: true }],
    rows: [
      { k: `${settings?.business_name || "Bamboo Beauty Lifes"} — ${trDate(from)} – ${trDate(to)}`, v: null },
      { k: "Satış sayısı", v: sales.length },
      { k: "Ciro (gerçek tahsilat)", v: r2(gross) },
      ...Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k: `  • ${METHOD[k] ?? k}${NOT_MONEY.includes(k) ? " (ciroya dahil değil)" : ""}`, v: r2(v) })),
      { k: `KDV (%${Math.round(kdvRate * 100)})`, v: r2(gross - net) },
      { k: "KDV hariç ciro", v: r2(net) },
      { k: "Malzeme / sarf maliyeti", v: r2(materials) },
      { k: "Giderler", v: r2(expTotal) },
      ...Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k: `  • ${k}`, v: r2(v) })),
      { k: "Personel hak edişi (hesaplanan)", v: r2(payTotal) },
      { k: "Personele yapılan ödemeler", v: r2(payouts.reduce((a, p) => a + Number(p.amount), 0)) },
      { k: "Tahmini kâr (KDV hariç ciro − malzeme − personel hak edişi − giderler*)", v: r2(net - materials - payTotal - (expTotal - exps.filter((e) => ["avans", "prim", "maaş"].includes(e.category)).reduce((a, e) => a + Number(e.amount), 0))) },
      { k: "* Avans / prim / maaş giderleri hak edişin içinde sayıldığı için tekrar düşülmedi.", v: null },
    ],
  });
  const methods = ["cash", "card", "transfer", "online", "other"];
  sheets.push({
    key: "gunluk", name: "Günlük", total: ["n", "ciro", ...methods, "diger_odeme", "gider", "kalan"],
    cols: [{ header: "Tarih", key: "d", width: 12 }, { header: "Satış", key: "n", width: 8 }, { header: "Ciro", key: "ciro", width: 14, money: true },
      ...methods.map((m) => ({ header: METHOD[m], key: m, width: 13, money: true })), { header: "Çek/Puan/Bakiye", key: "diger_odeme", width: 15, money: true },
      { header: "Gider", key: "gider", width: 13, money: true }, { header: "Ciro − Gider", key: "kalan", width: 14, money: true }],
    rows: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => {
      const ciro = Object.entries(v.m).filter(([k]) => !NOT_MONEY.includes(k)).reduce((a, [, x]) => a + x, 0);
      return { d: trDate(d), n: v.n, ciro: r2(ciro), ...Object.fromEntries(methods.map((m) => [m, r2(v.m[m] ?? 0)])), diger_odeme: r2(NOT_MONEY.reduce((a, k) => a + (v.m[k] ?? 0), 0)), gider: r2(v.exp), kalan: r2(ciro - v.exp) };
    }),
  });
  sheets.push({
    key: "satislar", name: "Satışlar", total: ["ara", "indirim", "toplam"],
    cols: [{ header: "Tarih", key: "d", width: 12 }, { header: "Saat", key: "h", width: 7 }, { header: "Müşteri", key: "c", width: 24 }, { header: "Telefon", key: "tel", width: 16 },
      { header: "Kalemler", key: "it", width: 50 }, { header: "Uzman", key: "st", width: 18 }, { header: "Ara toplam", key: "ara", width: 13, money: true }, { header: "İndirim", key: "indirim", width: 11, money: true },
      { header: "Toplam", key: "toplam", width: 13, money: true }, { header: "Ödeme", key: "pay", width: 30 }, { header: "Not", key: "not", width: 24 }],
    rows: sales.map((s) => ({
      d: trDate(s.sale_date), h: hhmm(s.created_at), c: cust(s), tel: s.customer?.phone ?? "", it: s.items.map((i) => `${i.name}${Number(i.qty) > 1 ? ` ×${i.qty}` : ""}`).join(", "),
      st: [...new Set(s.items.map((i) => staffName(i.staff_id) || i.staff_name).filter(Boolean))].join(", "),
      ara: r2(Number(s.subtotal)), indirim: r2(Number(s.discount)), toplam: r2(Number(s.total)),
      pay: s.payments.map((p) => `${METHOD[p.method] ?? p.method} ${r2(Number(p.amount))}`).join(" + "), not: s.notes ?? "",
    })),
  });
  sheets.push({
    key: "kalemler", name: "Hizmet ve ürünler", total: ["adet", "toplam", "malzeme"],
    cols: [{ header: "Tarih", key: "d", width: 12 }, { header: "Müşteri", key: "c", width: 24 }, { header: "Tür", key: "k", width: 12 }, { header: "Hizmet / ürün", key: "n", width: 36 },
      { header: "Uzman", key: "st", width: 18 }, { header: "Adet", key: "adet", width: 7 }, { header: "Birim fiyat", key: "bf", width: 12, money: true }, { header: "İndirim", key: "ind", width: 11, money: true },
      { header: "Toplam", key: "toplam", width: 12, money: true }, { header: "Malzeme", key: "malzeme", width: 11, money: true }],
    rows: sales.flatMap((s) => s.items.map((i) => ({ d: trDate(s.sale_date), c: cust(s), k: KIND[i.kind] ?? i.kind, n: i.name, st: staffName(i.staff_id) || i.staff_name, adet: Number(i.qty), bf: r2(Number(i.unit_price)), ind: r2(Number(i.discount)), toplam: r2(Number(i.total)), malzeme: r2(Number(i.material_cost ?? 0)) }))),
  });
  sheets.push({
    key: "odemeler", name: "Ödemeler", total: ["t"],
    cols: [{ header: "Tarih", key: "d", width: 12 }, { header: "Saat", key: "h", width: 7 }, { header: "Müşteri", key: "c", width: 24 }, { header: "Yöntem", key: "m", width: 14 }, { header: "Tutar", key: "t", width: 13, money: true }],
    rows: sales.flatMap((s) => s.payments.map((p) => ({ d: trDate(s.sale_date), h: hhmm(s.created_at), c: cust(s), m: METHOD[p.method] ?? p.method, t: r2(Number(p.amount)) }))),
  });
  sheets.push({
    key: "giderler", name: "Giderler", total: ["t"],
    cols: [{ header: "Tarih", key: "d", width: 12 }, { header: "Kategori", key: "k", width: 18 }, { header: "Açıklama", key: "a", width: 40 }, { header: "Yöntem", key: "m", width: 12 }, { header: "Personel", key: "p", width: 18 }, { header: "Tutar", key: "t", width: 13, money: true }],
    rows: exps.map((e) => ({ d: trDate(e.expense_date), k: e.category, a: e.description ?? "", m: METHOD[e.method] ?? e.method, p: staffName(e.staff_id), t: r2(Number(e.amount)) })),
  });
  sheets.push({
    key: "personel", name: "Personel hak edişi", total: ["gun", "hs", "us", "own", "comp", "book", "fix", "gar", "top", "avans", "odenen"],
    cols: [{ header: "Personel", key: "n", width: 22 }, { header: "Çalıştığı gün", key: "gun", width: 12 }, { header: "Hizmet satışı", key: "hs", width: 14, money: true }, { header: "Ürün satışı", key: "us", width: 13, money: true },
      { header: "Kendi prim", key: "own", width: 12, money: true }, { header: "Şirket primi", key: "comp", width: 12, money: true }, { header: "Randevu primi", key: "book", width: 13, money: true },
      { header: "Günlük ücret", key: "fix", width: 12, money: true }, { header: "Garanti farkı", key: "gar", width: 12, money: true }, { header: "Toplam hak ediş", key: "top", width: 15, money: true },
      { header: "Avans/prim/maaş gideri", key: "avans", width: 18, money: true }, { header: "Ödenen", key: "odenen", width: 12, money: true }],
    rows: (staff ?? []).map((s) => ({ s, p: payroll.get(s.id) })).filter(({ s, p }) => s.is_active || (p && p.total > 0)).map(({ s, p }) => ({
      n: s.full_name, gun: p?.days ?? 0, hs: p?.serviceSales ?? 0, us: p?.productSales ?? 0, own: p?.own ?? 0, comp: p?.company ?? 0, book: p?.booking ?? 0, fix: p?.fixed ?? 0, gar: p?.guarantee ?? 0, top: p?.total ?? 0,
      avans: r2(exps.filter((e) => e.staff_id === s.id && ["avans", "prim", "maaş"].includes(e.category)).reduce((a, e) => a + Number(e.amount), 0)),
      odenen: r2(payouts.filter((x) => x.staff_id === s.id).reduce((a, x) => a + Number(x.amount), 0)),
    })),
  });

  const fname = `bamboo-kasa-${from}_${to}`;
  if (format === "csv") {
    const sh = sheets.find((s) => s.key === sp.get("sheet")) ?? sheets.find((s) => s.key === "satislar")!;
    const esc = (v: unknown) => { const s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = "﻿" + [sh.cols.map((c) => esc(c.header)).join(";"), ...sh.rows.map((r) => sh.cols.map((c) => esc(r[c.key])).join(";"))].join("\r\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fname}-${sh.key}.csv"` } });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Bamboo CRM"; wb.created = new Date();
  const only = sp.get("sheet");
  for (const sh of sheets.filter((s) => !only || s.key === only || s.key === "ozet")) {
    const ws = wb.addWorksheet(sh.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = sh.cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14, style: c.money ? { numFmt: '#,##0.00 "₺"' } : {} }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5D3A" } };
    ws.addRows(sh.rows);
    if (sh.total && sh.rows.length) {
      const n = sh.rows.length + 1;
      const tr = ws.addRow(Object.fromEntries([[sh.cols[0].key, "TOPLAM"], ...sh.total.map((k) => { const ci = sh.cols.findIndex((c) => c.key === k) + 1; const L = ws.getColumn(ci).letter; return [k, { formula: `SUM(${L}2:${L}${n})` }]; })]));
      tr.font = { bold: true }; tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE1F2E5" } };
    }
    if (sh.key !== "ozet") ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.cols.length } };
    if (sh.key === "ozet") ws.getRow(2).font = { bold: true };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fname}.xlsx"` } });
}
