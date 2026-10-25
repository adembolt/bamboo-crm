"use client";
import { useMemo, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Staff, PayMethod } from "@/lib/database.types";
import type { DayVisit, OtherSale } from "@/lib/queries/kasa";
import { money, fmtTime, fullName } from "@/lib/format";
import { closeVisit, voidSale, addExpense, deleteExpense } from "./actions";
import { Modal } from "@/app/panel/takvim/day-calendar";

const METHOD: Record<PayMethod, string> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online", balance: "Bakiye", gift_card: "Hediye çeki", points: "Puan", package: "Paket", other: "Diğer" };
const CATS = ["malzeme", "kira", "fatura", "maaş", "avans", "prim", "pazarlama", "temizlik", "yemek", "diğer"];

type Expense = { id: string; category: string; description: string; amount: number; method: PayMethod; staff_id: string | null; staff_name: string | null };

export function KasaDay(props: { date: string; visits: DayVisit[]; otherSales: OtherSale[]; expenses: Expense[]; staff: Staff[]; earnings: Record<string, { service: number; product: number }>; canWrite: boolean; isManager: boolean }) {
  const { visits, staff, canWrite } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [closing, setClosing] = useState<DayVisit | null>(null);
  const [err, setErr] = useState("");
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? "—";
  const open = visits.filter((v) => !v.sale);
  const closed = visits.filter((v) => v.sale);

  function run(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    setErr("");
    start(async () => { const r = await fn(); if (r && !r.ok) setErr(r.error ?? "Hata"); else router.refresh(); });
  }

  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
      <div className="grid gap-4">
        <section className="panel grid gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Açık ziyaretler</h2><span className="text-xs text-muted">{open.length}</span></div>
          {!open.length && <p className="text-sm text-muted">Kapatılacak ziyaret yok.</p>}
          {open.map((v) => <VisitRow key={v.id} v={v} staffName={staffName} action={canWrite ? <button className="btn sm" onClick={() => setClosing(v)}>Ödeme al</button> : null} />)}
        </section>
        <section className="panel grid gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Kapatılan</h2><span className="text-xs text-muted">{closed.length}</span></div>
          {!closed.length && <p className="text-sm text-muted">Henüz ödeme alınmadı.</p>}
          {closed.map((v) => (
            <VisitRow key={v.id} v={v} staffName={staffName} action={
              <div className="text-right">
                <div className="num font-bold">{money(v.sale!.total)}</div>
                <div className="text-[11px] text-muted">{v.sale!.payments.map((p) => `${METHOD[p.method]} ${money(p.amount)}`).join(" + ")}</div>
                {props.isManager && <button className="text-[11px] text-bad hover:underline" disabled={pending} onClick={() => { if (confirm("Satış iptal edilsin mi? Ziyaret tekrar açılır.")) run(() => voidSale(v.sale!.id)); }}>iptal et</button>}
              </div>
            } />
          ))}
        </section>
        {props.otherSales.length > 0 && (
          <section className="panel grid gap-2">
            <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Paket / çek satışları</h2><span className="text-xs text-muted">{props.otherSales.length}</span></div>
            {props.otherSales.map((o) => (
              <div key={o.id} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-xl bg-sunk px-3 py-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{o.customer ? fullName(o.customer) : "Müşterisiz"} <span className="text-muted font-normal text-xs">· {o.items.map((i) => i.name).join(", ")}</span></div>
                  <div className="text-[11px] text-muted">{o.payments.map((p) => `${METHOD[p.method]} ${money(p.amount)}`).join(" + ")}</div>
                </div>
                <div className="text-right"><div className="num font-bold">{money(o.total)}</div>{props.isManager && <button className="text-[11px] text-bad hover:underline" disabled={pending} onClick={() => { if (confirm("Satış iptal edilsin mi?")) run(() => voidSale(o.id)); }}>iptal et</button>}</div>
              </div>
            ))}
          </section>
        )}
        {err && <p className="pill bad">{err}</p>}
      </div>

      <div className="grid gap-4">
        <section className="panel grid gap-2">
          <h2 className="text-lg font-bold">Personel hak edişi (gün)</h2>
          <div className="grid gap-1">
            {staff.map((s) => {
              const e = props.earnings[s.id] ?? { service: 0, product: 0 };
              const pay = e.service * Number(s.pay_percent) / 100 + e.product * Number(s.product_percent) / 100;
              if (!e.service && !e.product) return null;
              return (
                <div key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm py-1 border-b border-dashed border-line last:border-0">
                  <span className="min-w-0"><b className="block truncate">{s.full_name}</b><span className="text-[11px] text-muted">{s.pay_model === "daily_prim" ? "günlük prim" : s.pay_model === "percent" ? "ay sonu" : "sabit"} · %{s.pay_percent}</span></span>
                  <span className="num text-muted">{money(e.service + e.product)}</span>
                  <span className="num font-bold">{money(pay)}</span>
                </div>
              );
            })}
            {!Object.keys(props.earnings).length && <p className="text-sm text-muted">Bugün kapatılan satış yok.</p>}
          </div>
        </section>

        <section className="panel grid gap-3">
          <h2 className="text-lg font-bold">Giderler</h2>
          {canWrite && <ExpenseForm date={props.date} staff={staff} />}
          <div className="grid gap-1">
            {props.expenses.map((e) => (
              <div key={e.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center text-sm py-1 border-b border-dashed border-line last:border-0">
                <span className="pill">{e.category}</span>
                <span className="min-w-0 truncate">{e.description || "—"}{e.staff_name ? <span className="text-muted"> · {e.staff_name}</span> : null}</span>
                <span className="num font-bold">{money(e.amount)}</span>
                {canWrite && <button className="text-[11px] text-bad hover:underline" disabled={pending} onClick={() => run(() => deleteExpense(e.id))}>sil</button>}
              </div>
            ))}
            {!props.expenses.length && <p className="text-sm text-muted">Gider yok.</p>}
          </div>
        </section>
      </div>

      {closing && <CloseDialog v={closing} staffName={staffName} onClose={() => setClosing(null)} onDone={() => { setClosing(null); router.refresh(); }} />}
    </div>
  );
}

function VisitRow({ v, staffName, action }: { v: DayVisit; staffName: (id: string | null) => string; action: React.ReactNode }) {
  const items = v.items.filter((i) => i.status !== "cancelled").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const sub = items.reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-xl bg-sunk px-3 py-2">
      <div className="min-w-0">
        <div className="font-semibold truncate">{v.customer ? fullName(v.customer) : "Müşterisiz"} <span className="text-muted font-normal text-xs">· {items.length} hizmet · {money(sub)}</span></div>
        <div className="text-xs text-muted truncate">{items.map((i) => `${fmtTime(i.starts_at)} ${i.service_name} (${staffName(i.staff_id).split(" ")[0]})`).join(" · ")}</div>
      </div>
      {action}
    </div>
  );
}

function CloseDialog({ v, staffName, onClose, onDone }: { v: DayVisit; staffName: (id: string | null) => string; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const items = v.items.filter((i) => i.status !== "cancelled");
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, String(Number(i.price))])));
  const [disc, setDisc] = useState(String(v.discount_percent || 0));
  const [pkgUse, setPkgUse] = useState<Record<string, string>>({});
  const pkgs = v.packages ?? [];
  const pkgFor = (i: DayVisit["items"][number]) => pkgs.filter((p) => !p.service_id || p.service_id === i.service_id);
  const pkgRemaining = (pid: string) => { const p = pkgs.find((x) => x.id === pid)!; return p.total_sessions - p.used_sessions - Object.values(pkgUse).filter((x) => x === pid).length; };
  const subtotal = useMemo(() => items.reduce((s, i) => s + (pkgUse[i.id] ? 0 : (Number(prices[i.id]) || 0) - Number(i.discount)), 0), [items, prices, pkgUse]);
  const total = Math.round(subtotal * (1 - (Number(disc) || 0) / 100));
  const [pays, setPays] = useState<{ method: PayMethod; amount: string; ref?: string }[]>([{ method: "cash", amount: "" }]);
  const points = v.customer?.loyalty_points ?? 0;
  const balance = Number(v.customer?.balance ?? 0);
  // Bir paketi, eşleşen tüm kalemlere uygula (ödeme bölümünden)
  function applyPackage(pid: string) {
    const p = pkgs.find((x) => x.id === pid); if (!p) return;
    const n = { ...pkgUse }; let left = p.total_sessions - p.used_sessions - Object.values(n).filter((x) => x === pid).length;
    for (const i of items) { if (n[i.id] || left <= 0) continue; if (!p.service_id || p.service_id === i.service_id) { n[i.id] = pid; left--; } }
    setPkgUse(n);
  }
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;

  function setPay(i: number, patch: Partial<{ method: PayMethod; amount: string; ref: string }>) { setPays(pays.map((p, k) => (k === i ? { ...p, ...patch } : p))); }
  function fillRemaining(i: number) { setPay(i, { amount: String(Math.max(0, remaining + (Number(pays[i].amount) || 0))) }); }

  function submit() {
    setErr("");
    start(async () => {
      const r = await closeVisit({
        visitId: v.id, discountPercent: Number(disc) || 0,
        payments: pays.map((p) => ({ method: p.method, amount: Number(p.amount) || 0, ref: p.ref })),
        itemOverrides: Object.fromEntries(items.map((i) => [i.id, Number(prices[i.id]) || 0])),
        packageUse: pkgUse,
      });
      if (!r.ok) setErr(r.error); else onDone();
    });
  }

  return (
    <Modal title={`Ödeme al · ${v.customer ? fullName(v.customer) : "Müşterisiz"}`} onClose={onClose}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          {items.map((i) => (
            <div key={i.id} className="grid grid-cols-[1fr_110px] gap-2 items-center">
              <span className="min-w-0"><span className="font-semibold block truncate">{i.service_name}</span><span className="text-[11px] text-muted">{fmtTime(i.starts_at)} · {staffName(i.staff_id)}</span>
                {pkgFor(i).length > 0 && (
                  <label className="flex items-center gap-1 text-xs mt-1">
                    <input type="checkbox" checked={!!pkgUse[i.id]} onChange={(e) => { const pid = pkgFor(i).find((p) => pkgRemaining(p.id) > 0 || pkgUse[i.id] === p.id)?.id; const n = { ...pkgUse }; if (e.target.checked && pid) n[i.id] = pid; else delete n[i.id]; setPkgUse(n); }} />
                    Paketten düş {pkgUse[i.id] ? <span className="text-muted">({pkgs.find((p) => p.id === pkgUse[i.id])?.name} · kalan {pkgRemaining(pkgUse[i.id])})</span> : <span className="text-muted">({pkgFor(i).map((p) => `${p.name} ${p.total_sessions - p.used_sessions}`).join(", ")})</span>}
                  </label>
                )}
              </span>
              {pkgUse[i.id] ? <span className="text-right text-sm text-good font-semibold">paket</span> : <span className="inp"><input inputMode="decimal" value={prices[i.id]} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} className="text-right" /></span>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-center border-t border-line pt-3">
          <label className="f">İndirim %<span className="inp"><input inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value)} /></span></label>
          <div className="text-right"><div className="text-xs text-muted">Toplam</div><div className="font-display text-2xl font-bold num">{money(total)}</div></div>
        </div>
        <div className="grid gap-2">
          <div className="eyebrow">Ödeme</div>
          {(balance > 0 || pkgs.length > 0 || points > 0) && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {balance > 0 && <button type="button" className="pill gold hover:brightness-95" onClick={() => { const i = pays.findIndex((x) => x.method === "balance"); const amt = String(Math.min(balance, Math.max(0, remaining + (i >= 0 ? Number(pays[i].amount) || 0 : 0)))); if (i >= 0) setPay(i, { amount: amt }); else setPays([{ method: "balance", amount: amt }, ...pays.filter((x) => x.amount)]); }}>Bakiye {money(balance)} → kullan</button>}
              {pkgs.map((p) => { const used = Object.values(pkgUse).filter((x) => x === p.id).length; const left = p.total_sessions - p.used_sessions - used; return <button key={p.id} type="button" className={`pill ${used ? "good" : ""} hover:brightness-95`} disabled={left <= 0 && !used} onClick={() => used ? setPkgUse(Object.fromEntries(Object.entries(pkgUse).filter(([, x]) => x !== p.id))) : applyPackage(p.id)}>Paket: {p.name} · kalan {left}{used ? ` · ${used} kalem düşüldü ✓` : " → düş"}</button>; })}
              {points > 0 && <span className="pill">{points} puan</span>}
            </div>
          )}
          {pays.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <span className="inp"><select value={p.method} onChange={(e) => setPay(i, { method: e.target.value as PayMethod })}>{(Object.keys(METHOD) as PayMethod[]).filter((m) => m !== "package").map((m) => <option key={m} value={m}>{METHOD[m]}{m === "points" ? ` (${points})` : m === "balance" ? ` (${money(balance)})` : ""}</option>)}</select></span>
              <span className="inp"><input inputMode="decimal" placeholder={String(Math.max(0, remaining + (Number(p.amount) || 0)))} value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} /></span>
              <button type="button" className="btn ghost sm" onClick={() => fillRemaining(i)} title="Kalanı doldur">↵</button>
              {p.method === "gift_card" && <span className="inp col-span-3"><input placeholder="Hediye çeki kodu (BB-XXXX-XXXX)" value={p.ref ?? ""} onChange={(e) => setPay(i, { ref: e.target.value.toUpperCase() })} /></span>}
            </div>
          ))}
          <div className="flex gap-2 items-center">
            <button type="button" className="btn ghost sm" onClick={() => setPays([...pays, { method: "card", amount: "" }])}>+ Karışık ödeme</button>
            <span className={`ml-auto text-sm num ${Math.abs(remaining) < 0.5 ? "text-good" : "text-bad"}`}>{Math.abs(remaining) < 0.5 ? "Tutar eşleşti" : `Kalan ${money(remaining)}`}</span>
          </div>
        </div>
        {err && <p className="pill bad">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn" disabled={pending || Math.abs(remaining) >= 0.5 || total < 0} onClick={submit}>{pending ? "Kaydediliyor…" : "Ödemeyi kaydet"}</button>
        </div>
      </div>
    </Modal>
  );
}

function ExpenseForm({ date, staff }: { date: string; staff: Staff[] }) {
  const [state, action, pending] = useActionState(addExpense, { error: "" });
  return (
    <form action={action} className="grid grid-cols-2 sm:grid-cols-[1fr_1.4fr_1fr_1fr_auto] gap-2 items-end">
      <input type="hidden" name="date" value={date} />
      <label className="f">Kategori<span className="inp"><select name="category" defaultValue="malzeme">{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></span></label>
      <label className="f">Açıklama<span className="inp"><input name="description" placeholder="ör. masaj yağı" /></span></label>
      <label className="f">Tutar<span className="inp"><input name="amount" inputMode="decimal" required /></span></label>
      <label className="f">Ödeme<span className="inp"><select name="method" defaultValue="cash"><option value="cash">Nakit</option><option value="card">Kart</option><option value="transfer">Havale</option></select></span></label>
      <label className="f col-span-2 sm:col-span-1">Personel (avans/prim)<span className="inp"><select name="staff_id" defaultValue=""><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
      <button className="btn sm col-span-2 sm:col-span-5 justify-self-end" disabled={pending}>Gider ekle</button>
      {state.error && <p className="pill bad col-span-full">{state.error}</p>}
    </form>
  );
}
