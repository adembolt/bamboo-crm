"use client";
import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Staff, PayMethod } from "@/lib/database.types";
import type { DayVisit, OtherSale } from "@/lib/queries/kasa";
import { money, fmtTime, fullName } from "@/lib/format";
import { voidSale, addExpense, deleteExpense } from "./actions";
import { CloseDialog, METHOD } from "./close-dialog";
import { useT } from "@/lib/i18n/client";

const CATS = ["malzeme", "kira", "fatura", "maaş", "avans", "prim", "pazarlama", "temizlik", "yemek", "diğer"];

type Expense = { id: string; category: string; description: string; amount: number; method: PayMethod; staff_id: string | null; staff_name: string | null };

export function KasaDay(props: { date: string; visits: DayVisit[]; otherSales: OtherSale[]; expenses: Expense[]; staff: Staff[]; earnings: Record<string, { sales: number; pay: number; detail: string }>; canWrite: boolean; isManager: boolean }) {
  const { visits, staff, canWrite } = props;
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [closing, setClosing] = useState<DayVisit | null>(null);
  const [err, setErr] = useState("");
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? "—";
  const open = visits.filter((v) => !v.sale);
  const closed = visits.filter((v) => v.sale);

  function run(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    setErr("");
    start(async () => { const r = await fn(); if (r && !r.ok) setErr(r.error ?? t("Hata")); else router.refresh(); });
  }

  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
      <div className="grid gap-4">
        <section className="panel grid gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t("Açık ziyaretler")}</h2><span className="text-xs text-muted">{open.length}</span></div>
          {!open.length && <p className="text-sm text-muted">{t("Kapatılacak ziyaret yok.")}</p>}
          {open.map((v) => <VisitRow key={v.id} v={v} staffName={staffName} action={canWrite ? <button className="btn sm" onClick={() => setClosing(v)}>{t("Ödeme al")}</button> : null} />)}
        </section>
        <section className="panel grid gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t("Kapatılan")}</h2><span className="text-xs text-muted">{closed.length}</span></div>
          {!closed.length && <p className="text-sm text-muted">{t("Henüz ödeme alınmadı.")}</p>}
          {closed.map((v) => (
            <VisitRow key={v.id} v={v} staffName={staffName} action={
              <div className="text-right">
                <div className="num font-bold">{money(v.sale!.total)}</div>
                <div className="text-[11px] text-muted">{v.sale!.payments.map((p) => `${t(METHOD[p.method])} ${money(p.amount)}`).join(" + ")}</div>
                {props.isManager && <button className="text-[11px] text-bad hover:underline" disabled={pending} onClick={() => { if (confirm(t("Satış iptal edilsin mi? Ziyaret tekrar açılır."))) run(() => voidSale(v.sale!.id)); }}>{t("iptal et")}</button>}
              </div>
            } />
          ))}
        </section>
        {props.otherSales.length > 0 && (
          <section className="panel grid gap-2">
            <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t("Paket / çek satışları")}</h2><span className="text-xs text-muted">{props.otherSales.length}</span></div>
            {props.otherSales.map((o) => (
              <div key={o.id} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-xl bg-sunk px-3 py-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{o.customer ? fullName(o.customer) : t("Müşterisiz")} <span className="text-muted font-normal text-xs">· {o.items.map((i) => i.name).join(", ")}</span></div>
                  <div className="text-[11px] text-muted">{o.payments.map((p) => `${t(METHOD[p.method])} ${money(p.amount)}`).join(" + ")}</div>
                </div>
                <div className="text-right"><div className="num font-bold">{money(o.total)}</div>{props.isManager && <button className="text-[11px] text-bad hover:underline" disabled={pending} onClick={() => { if (confirm(t("Satış iptal edilsin mi?"))) run(() => voidSale(o.id)); }}>{t("iptal et")}</button>}</div>
              </div>
            ))}
          </section>
        )}
        {err && <p className="pill bad">{err}</p>}
      </div>

      <div className="grid gap-4">
        <section className="panel grid gap-2">
          <h2 className="text-lg font-bold">{t("Personel hak edişi (gün)")}</h2>
          <div className="grid gap-1">
            {staff.map((s) => {
              const e = props.earnings[s.id];
              if (!e) return null;
              const pay = e.pay;
              return (
                <div key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm py-1 border-b border-dashed border-line last:border-0">
                  <span className="min-w-0"><b className="block truncate">{s.full_name}</b><span className="text-[11px] text-muted">{e.detail || "—"}</span></span>
                  <span className="num text-muted">{money(e.sales)}</span>
                  <span className="num font-bold">{money(pay)}</span>
                </div>
              );
            })}
            {!Object.keys(props.earnings).length && <p className="text-sm text-muted">{t("Bugün kapatılan satış yok.")}</p>}
          </div>
        </section>

        <section className="panel grid gap-3">
          <h2 className="text-lg font-bold">{t("Giderler")}</h2>
          {canWrite && <ExpenseForm date={props.date} staff={staff} />}
          <div className="grid gap-1">
            {props.expenses.map((e) => (
              <div key={e.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center text-sm py-1 border-b border-dashed border-line last:border-0">
                <span className="pill">{t(e.category)}</span>
                <span className="min-w-0 truncate">{e.description || "—"}{e.staff_name ? <span className="text-muted"> · {e.staff_name}</span> : null}</span>
                <span className="num font-bold">{money(e.amount)}</span>
                {canWrite && <button className="text-[11px] text-bad hover:underline" disabled={pending} onClick={() => run(() => deleteExpense(e.id))}>{t("sil")}</button>}
              </div>
            ))}
            {!props.expenses.length && <p className="text-sm text-muted">{t("Gider yok.")}</p>}
          </div>
        </section>
      </div>

      {closing && <CloseDialog v={closing} staffName={staffName} onClose={() => setClosing(null)} onDone={() => { setClosing(null); router.refresh(); }} />}
    </div>
  );
}

function VisitRow({ v, staffName, action }: { v: DayVisit; staffName: (id: string | null) => string; action: React.ReactNode }) {
  const t = useT();
  const items = v.items.filter((i) => i.status !== "cancelled").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const sub = items.reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-xl bg-sunk px-3 py-2">
      <div className="min-w-0">
        <div className="font-semibold truncate">{v.customer ? fullName(v.customer) : t("Müşterisiz")} <span className="text-muted font-normal text-xs">· {t("{n} hizmet", { n: items.length })} · {money(sub)}</span></div>
        <div className="text-xs text-muted truncate">{items.map((i) => `${fmtTime(i.starts_at)} ${i.service_name} (${staffName(i.staff_id).split(" ")[0]})`).join(" · ")}</div>
      </div>
      {action}
    </div>
  );
}


function ExpenseForm({ date, staff }: { date: string; staff: Staff[] }) {
  const t = useT();
  const [state, action, pending] = useActionState(addExpense, { error: "" });
  return (
    <form action={action} className="grid grid-cols-2 sm:grid-cols-[1fr_1.4fr_1fr_1fr_auto] gap-2 items-end">
      <input type="hidden" name="date" value={date} />
      <label className="f">{t("Kategori")}<span className="inp"><select name="category" defaultValue="malzeme">{CATS.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></span></label>
      <label className="f">{t("Açıklama")}<span className="inp"><input name="description" placeholder={t("ör. masaj yağı")} /></span></label>
      <label className="f">{t("Tutar")}<span className="inp"><input name="amount" inputMode="decimal" required /></span></label>
      <label className="f">{t("Ödeme")}<span className="inp"><select name="method" defaultValue="cash"><option value="cash">{t("Nakit")}</option><option value="card">{t("Kart")}</option><option value="transfer">{t("Havale")}</option></select></span></label>
      <label className="f col-span-2 sm:col-span-1">{t("Personel (avans/prim)")}<span className="inp"><select name="staff_id" defaultValue=""><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
      <button className="btn sm col-span-2 sm:col-span-5 justify-self-end" disabled={pending}>{t("Gider ekle")}</button>
      {state.error && <p className="pill bad col-span-full">{state.error}</p>}
    </form>
  );
}
