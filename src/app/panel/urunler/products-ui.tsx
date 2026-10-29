"use client";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { money, todayIso, fmtDate } from "@/lib/format";
import type { PayMethod } from "@/lib/database.types";
import { saveProduct, stockMove, sellProducts } from "./actions";
import { useT } from "@/lib/i18n/client";

type Prod = { id: string; name: string; brand: string; category: string; barcode: string; unit: string; sale_price: number; cost_price: number; stock_qty: number; min_stock: number; is_retail: boolean; is_active: boolean; notes: string };
type Move = { id: string; product_id: string; kind: string; qty: number; unit_cost: number | null; note: string; created_at: string; staff_name: string | null };
const KIND: Record<string, string> = { purchase: "Alış", sale: "Satış", use: "Kullanım", adjust: "Sayım/düzeltme", return: "İade" };
const PAY: Partial<Record<PayMethod, string>> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online" };

export function ProductsUI({ products, staff, moves, canWrite, initialFilter }: { products: Prod[]; staff: { id: string; full_name: string }[]; moves: Move[]; canWrite: boolean; initialFilter: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(initialFilter || "active");
  const [edit, setEdit] = useState<Prod | "new" | null>(null);
  const [move, setMove] = useState<{ p: Prod; kind: "purchase" | "use" | "adjust" } | null>(null);
  const [hist, setHist] = useState<Prod | null>(null);
  const [sell, setSell] = useState(false);
  const cats = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const shown = products.filter((p) => {
    if (filter === "active" && !p.is_active) return false;
    if (filter === "low" && !(p.is_active && p.min_stock > 0 && p.stock_qty <= p.min_stock)) return false;
    if (filter === "retail" && !(p.is_active && p.is_retail)) return false;
    if (filter === "use" && !(p.is_active && !p.is_retail)) return false;
    if (filter === "passive" && p.is_active) return false;
    if (filter.startsWith("cat:") && p.category !== filter.slice(4)) return false;
    const s = q.trim().toLocaleLowerCase("tr");
    return !s || `${p.name} ${p.brand} ${p.barcode} ${p.category}`.toLocaleLowerCase("tr").includes(s);
  });

  return (
    <section className="grid gap-3">
      <div className="flex gap-2 flex-wrap items-center">
        <span className="inp min-w-[220px] flex-1"><input placeholder={t("Ürün, marka, barkod ara…")} value={q} onChange={(e) => setQ(e.target.value)} /></span>
        <span className="inp"><select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="active">{t("Aktif ürünler")}</option><option value="low">{t("Kritik stok")}</option><option value="retail">{t("Satışa açık")}</option><option value="use">{t("Salon kullanımı")}</option><option value="passive">{t("Pasif")}</option><option value="all">{t("Tümü")}</option>
          {cats.map((c) => <option key={c} value={`cat:${c}`}>{t("Kategori: {c}", { c })}</option>)}
        </select></span>
        {canWrite && <button className="btn ghost sm" onClick={() => setSell(true)}>₺ {t("Ürün sat")}</button>}
        {canWrite && <button className="btn sm" onClick={() => setEdit("new")}>{t("+ Yeni ürün")}</button>}
      </div>

      <div className="panel p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="text-[11px] uppercase tracking-wide text-muted bg-sunk"><tr>
            <th className="text-left px-3 py-2">{t("Ürün")}</th><th className="text-left px-3 py-2">{t("Kategori")}</th><th className="text-right px-3 py-2">{t("Stok")}</th><th className="text-right px-3 py-2">{t("Alış")}</th><th className="text-right px-3 py-2">{t("Satış")}</th><th className="px-3 py-2" />
          </tr></thead>
          <tbody className="divide-y divide-line">
            {shown.map((p) => {
              const low = p.min_stock > 0 && p.stock_qty <= p.min_stock;
              return (
                <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                  <td className="px-3 py-2"><button className="font-semibold hover:underline text-left" onClick={() => canWrite && setEdit(p)}>{p.name}</button><div className="text-[11px] text-muted">{[p.brand, p.barcode, p.is_retail ? t("satışta") : t("salon kullanımı")].filter(Boolean).join(" · ")}</div></td>
                  <td className="px-3 py-2 text-muted">{p.category || "—"}</td>
                  <td className={`px-3 py-2 text-right num font-bold ${p.stock_qty <= 0 ? "text-bad" : low ? "text-warn" : ""}`}>{p.stock_qty} <span className="text-[11px] font-normal text-muted">{p.unit}</span>{low && <div className="text-[10px] font-semibold">{t("min {n}", { n: p.min_stock })}</div>}</td>
                  <td className="px-3 py-2 text-right num text-muted">{money(p.cost_price)}</td>
                  <td className="px-3 py-2 text-right num">{p.is_retail ? money(p.sale_price) : "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canWrite && <><button className="btn ghost sm" onClick={() => setMove({ p, kind: "purchase" })}>{t("+ Alış")}</button> <button className="btn ghost sm" onClick={() => setMove({ p, kind: "use" })}>{t("− Kullanım")}</button> <button className="btn ghost sm" onClick={() => setMove({ p, kind: "adjust" })}>{t("Sayım")}</button> </>}
                    <button className="btn ghost sm" onClick={() => setHist(p)}>{t("Geçmiş")}</button>
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">{products.length ? t("Bu filtrede ürün yok.") : t("Henüz ürün yok. “+ Yeni ürün” ile ekleyin.")}</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && <ProductForm p={edit === "new" ? null : edit} cats={cats} onClose={() => setEdit(null)} />}
      {move && <MoveDialog p={move.p} kind={move.kind} staff={staff} onClose={() => setMove(null)} />}
      {hist && (
        <Modal title={`${t("Hareketler")} · ${hist.name}`} onClose={() => setHist(null)}>
          <div className="grid gap-1 text-sm">
            {moves.filter((m) => m.product_id === hist.id).map((m) => (
              <div key={m.id} className="grid grid-cols-[80px_1fr_auto] gap-2 py-1 border-b border-dashed border-line last:border-0">
                <span className="num text-muted">{fmtDate(m.created_at)}</span>
                <span className="min-w-0 truncate"><b>{KIND[m.kind] ? t(KIND[m.kind]) : m.kind}</b>{m.note && m.note !== KIND[m.kind] ? ` · ${m.note}` : ""}{m.staff_name ? <span className="text-muted"> · {m.staff_name}</span> : null}</span>
                <span className={`num font-bold ${m.qty > 0 ? "text-good" : "text-bad"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
              </div>
            ))}
            {!moves.some((m) => m.product_id === hist.id) && <p className="text-muted">{t("Hareket yok.")}</p>}
          </div>
        </Modal>
      )}
      {sell && <SellDialog products={products.filter((p) => p.is_active && p.is_retail)} staff={staff} onClose={() => setSell(false)} />}
    </section>
  );
}

function ProductForm({ p, cats, onClose }: { p: Prod | null; cats: string[]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState(saveProduct, { error: "" });
  useEffect(() => { if (state.ok) { onClose(); router.refresh(); } }, [state, onClose, router]);
  return (
    <Modal title={p ? t("Ürünü düzenle") : t("Yeni ürün")} onClose={onClose}>
      <form action={action} className="grid gap-3">
        {p && <input type="hidden" name="id" value={p.id} />}
        <label className="f">{t("Ürün adı")}<span className="inp"><input name="name" defaultValue={p?.name} required /></span></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="f">{t("Marka")}<span className="inp"><input name="brand" defaultValue={p?.brand} /></span></label>
          <label className="f">{t("Kategori")}<span className="inp"><input name="category" defaultValue={p?.category} list="prod-cats" placeholder={t("ör. Cilt bakımı")} /></span></label>
          <datalist id="prod-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <label className="f">{t("Barkod / kod")}<span className="inp"><input name="barcode" defaultValue={p?.barcode} /></span></label>
          <label className="f">{t("Birim")}<span className="inp"><input name="unit" defaultValue={p?.unit ?? "adet"} list="prod-units" /></span></label>
          <datalist id="prod-units"><option value="adet" /><option value="ml" /><option value="gr" /><option value="kutu" /><option value="şişe" /></datalist>
          <label className="f">{t("Alış fiyatı")}<span className="inp"><input name="cost_price" inputMode="decimal" defaultValue={p?.cost_price ?? ""} /></span></label>
          <label className="f">{t("Satış fiyatı")}<span className="inp"><input name="sale_price" inputMode="decimal" defaultValue={p?.sale_price ?? ""} /></span></label>
          <label className="f">{t("Minimum stok (uyarı)")}<span className="inp"><input name="min_stock" inputMode="decimal" defaultValue={p?.min_stock ?? ""} /></span></label>
          {!p && <label className="f">{t("Başlangıç stoğu")}<span className="inp"><input name="initial_stock" inputMode="decimal" placeholder="0" /></span></label>}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_retail" defaultChecked={p ? p.is_retail : true} /> {t("Müşteriye satılır (işaretsizse sadece salonda kullanım)")}</label>
        {p && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" value="off" defaultChecked={!p.is_active} /> {t("Pasif (listeden kaldır)")}</label>}
        <label className="f">{t("Not")}<span className="inp"><input name="notes" defaultValue={p?.notes} /></span></label>
        {state.error && <p className="pill bad">{state.error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn ghost" onClick={onClose}>{t("Vazgeç")}</button><button className="btn" disabled={pending}>{pending ? "…" : t("Kaydet")}</button></div>
      </form>
    </Modal>
  );
}

function MoveDialog({ p, kind, staff, onClose }: { p: Prod; kind: "purchase" | "use" | "adjust"; staff: { id: string; full_name: string }[]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [qty, setQty] = useState(kind === "adjust" ? String(p.stock_qty) : "");
  const [cost, setCost] = useState(p.cost_price ? String(p.cost_price) : "");
  const [note, setNote] = useState("");
  const [staffId, setStaffId] = useState("");
  const [addExp, setAddExp] = useState(true);
  const [method, setMethod] = useState<PayMethod>("cash");
  const title = kind === "purchase" ? t("Stok girişi (alış)") : kind === "use" ? t("Salonda kullanım") : t("Sayım / düzeltme");
  const submit = () => { setErr(""); start(async () => {
    const r = await stockMove({ productId: p.id, kind, qty: Number(qty) || 0, countTo: kind === "adjust" ? Number(qty) : undefined, unitCost: kind === "purchase" ? Number(cost) || undefined : undefined, note: note || undefined, staffId: staffId || null, addExpense: kind === "purchase" && addExp, method, date: todayIso() });
    if (!r.ok) setErr(r.error); else { onClose(); router.refresh(); }
  }); };
  return (
    <Modal title={`${title} · ${p.name}`} onClose={onClose}>
      <div className="grid gap-3">
        <p className="text-sm text-muted">{t("Mevcut stok:")} <b className="text-ink num">{p.stock_qty} {p.unit}</b></p>
        <div className="grid grid-cols-2 gap-2">
          <label className="f">{kind === "adjust" ? t("Sayılan miktar") : t("Miktar")}<span className="inp"><input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></span></label>
          {kind === "purchase" && <label className="f">{t("Birim alış fiyatı")}<span className="inp"><input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></span></label>}
          {kind === "use" && <label className="f">{t("Kullanan personel")}<span className="inp"><select value={staffId} onChange={(e) => setStaffId(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>}
        </div>
        {kind === "purchase" && (
          <div className="grid grid-cols-[auto_1fr] gap-2 items-center text-sm">
            <input type="checkbox" checked={addExp} onChange={(e) => setAddExp(e.target.checked)} id="addexp" />
            <label htmlFor="addexp">{t("Kasaya gider olarak yaz ({amount})", { amount: money((Number(qty) || 0) * (Number(cost) || 0)) })}</label>
            {addExp && <span className="inp col-span-2"><select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{(Object.keys(PAY) as PayMethod[]).filter((m) => m !== "online").map((m) => <option key={m} value={m}>{t(PAY[m] ?? m)}</option>)}</select></span>}
          </div>
        )}
        {kind === "adjust" && <p className="text-xs text-muted">{t("Fark:")} <b className="num">{((Number(qty) || 0) - p.stock_qty).toFixed(2).replace(/\.00$/, "")}</b> {p.unit}</p>}
        <label className="f">{t("Not")}<span className="inp"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "purchase" ? t("ör. tedarikçi / fatura no") : ""} /></span></label>
        {err && <p className="pill bad">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn ghost" onClick={onClose}>{t("Vazgeç")}</button><button className="btn" disabled={pending || qty === ""} onClick={submit}>{pending ? "…" : t("Kaydet")}</button></div>
      </div>
    </Modal>
  );
}

function SellDialog({ products, staff, onClose }: { products: Prod[]; staff: { id: string; full_name: string }[]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [staffId, setStaffId] = useState("");
  const [lines, setLines] = useState<{ productId: string; qty: string; price: string }[]>([{ productId: "", qty: "1", price: "" }]);
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const [pays, setPays] = useState<{ method: PayMethod; amount: string }[]>([{ method: "cash", amount: "" }]);
  const effPays = pays.length === 1 && pays[0].amount.trim() === "" ? [{ ...pays[0], amount: String(total) }] : pays; const paid = effPays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.round((total - paid) * 100) / 100;
  const setLine = (k: number, patch: Partial<{ productId: string; qty: string; price: string }>) => setLines(lines.map((x, j) => (j === k ? { ...x, ...patch } : x)));
  const setPay = (i: number, patch: Partial<{ method: PayMethod; amount: string }>) => setPays(pays.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const submit = () => { setErr(""); start(async () => {
    const r = await sellProducts({ customerId: customer?.id ?? null, saleDate: todayIso(), lines: lines.map((l) => ({ productId: l.productId, qty: Number(l.qty) || 0, unitPrice: Number(l.price) || 0, staffId: staffId || null })), payments: effPays.map((p) => ({ method: p.method, amount: Number(p.amount) || 0 })) });
    if (!r.ok) setErr(r.error); else { onClose(); router.refresh(); }
  }); };
  return (
    <Modal title={t("Ürün sat")} onClose={onClose}>
      <div className="grid gap-3">
        <label className="f">{t("Müşteri (isteğe bağlı)")}<CustomerPicker value={customer} onChange={setCustomer} onNew={() => {}} /></label>
        {lines.map((l, k) => { const p = products.find((x) => x.id === l.productId); return (
          <div key={k} className="grid grid-cols-[1fr_60px_90px_auto] gap-2 items-center">
            <span className="inp"><select value={l.productId} onChange={(e) => { const np = products.find((x) => x.id === e.target.value); setLine(k, { productId: e.target.value, price: np ? String(np.sale_price) : l.price }); }}>
              <option value="">{t("Ürün seç…")}</option>{products.map((c) => <option key={c.id} value={c.id}>{c.name}{c.brand ? ` · ${c.brand}` : ""} ({c.stock_qty} {c.unit})</option>)}
            </select></span>
            <span className="inp"><input inputMode="decimal" value={l.qty} onChange={(e) => setLine(k, { qty: e.target.value })} className="text-right" aria-label={t("Adet")} /></span>
            <span className="inp"><input inputMode="decimal" value={l.price} onChange={(e) => setLine(k, { price: e.target.value })} className="text-right" aria-label={t("Birim fiyat")} /></span>
            <button type="button" className="btn ghost sm" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== k) : [{ productId: "", qty: "1", price: "" }])} aria-label={t("Kaldır")}>✕</button>
            {p && Number(l.qty) > p.stock_qty && <span className="col-span-4 text-[11px] text-warn">{t("Stokta {qty} {unit} var.", { qty: p.stock_qty, unit: p.unit })}</span>}
          </div>
        ); })}
        <button type="button" className="btn ghost sm justify-self-start" onClick={() => setLines([...lines, { productId: "", qty: "1", price: "" }])}>{t("+ Ürün")}</button>
        <label className="f">{t("Satışı yapan (ürün primi)")}<span className="inp"><select value={staffId} onChange={(e) => setStaffId(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
        <div className="flex justify-between items-baseline border-t border-line pt-2"><span className="text-sm text-muted">{t("Toplam")}</span><b className="font-display text-2xl num">{money(total)}</b></div>
        {pays.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <span className="inp"><select value={p.method} onChange={(e) => setPay(i, { method: e.target.value as PayMethod })}>{(Object.keys(PAY) as PayMethod[]).map((m) => <option key={m} value={m}>{t(PAY[m] ?? m)}</option>)}</select></span>
            <span className="inp"><input inputMode="decimal" placeholder={String(Math.max(0, remaining + (Number(p.amount) || 0)))} value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} /></span>
            <button type="button" className="btn ghost sm" onClick={() => setPay(i, { amount: String(Math.max(0, remaining + (Number(p.amount) || 0))) })}>↵</button>
          </div>
        ))}
        <div className="flex gap-2 items-center"><button type="button" className="btn ghost sm" onClick={() => setPays([...pays, { method: "card", amount: "" }])}>{t("+ Karışık ödeme")}</button><span className={`ml-auto text-sm num ${Math.abs(remaining) < 0.5 ? "text-good" : "text-bad"}`}>{Math.abs(remaining) < 0.5 ? t("Tutar eşleşti") : t("Kalan {amount}", { amount: money(remaining) })}</span></div>
        {err && <p className="pill bad">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn ghost" onClick={onClose}>{t("Vazgeç")}</button><button className="btn" disabled={pending || !(total > 0) || Math.abs(remaining) >= 0.5} onClick={submit}>{pending ? "…" : t("Sat ve kasaya işle")}</button></div>
      </div>
    </Modal>
  );
}
