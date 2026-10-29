import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT, getLang } from "@/lib/i18n/server";
import { computePayroll } from "@/lib/payroll";
import { money, fmtDate, fmtMonthYear, todayIso } from "@/lib/format";
import type { Staff } from "@/lib/database.types";
import { PayoutForm } from "../ay/payout-form";
import { LedgerForms } from "./ledger-forms";

export async function generateMetadata() { return { title: (await getT())("Personel hesaplaşma") }; }

const addDaysIso = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const shift = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
const PAID_CATS = ["avans", "prim", "maaş"];

export default async function PayrollLedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const today = todayIso();
  const m = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const ms = `${m}-01`, me = addDaysIso(`${shift(m, 1)}-01`, -1);
  const { supabase } = await requireManager();
  const [t, lang] = [await getT(), await getLang()];
  const { data: st } = await supabase.from("settings").select("payroll_start").eq("id", 1).single();
  const ps = st?.payroll_start ?? ms;
  const from = ms > ps ? ms : ps, to = me < today ? me : today;
  const [{ data: staff }, before, month, { data: payouts }, { data: exps }, { data: adjs }] = await Promise.all([
    supabase.from("staff").select("*").eq("is_active", true).order("sort_order"),
    ms > ps ? computePayroll(supabase, ps, addDaysIso(ms, -1)) : Promise.resolve(new Map()),
    from <= to ? computePayroll(supabase, from, to) : Promise.resolve(new Map()),
    supabase.from("staff_payouts").select("id, staff_id, amount, method, notes, paid_at").gte("paid_at", ps).lte("paid_at", me).order("paid_at"),
    supabase.from("expenses").select("id, staff_id, amount, category, description, expense_date").not("staff_id", "is", null).in("category", PAID_CATS).gte("expense_date", ps).lte("expense_date", me),
    supabase.from("staff_adjustments").select("*").gte("adj_date", ps).lte("adj_date", me).order("adj_date"),
  ]);
  const sum = <T,>(rows: T[] | null | undefined, f: (r: T) => boolean, v: (r: T) => number) => (rows ?? []).filter(f).reduce((a, r) => a + v(r), 0);
  const rows = ((staff ?? []) as Staff[]).map((s) => {
    const inMonth = (d: string) => d >= ms && d <= me;
    const earnedBefore = before.get(s.id)?.total ?? 0;
    const paidBefore = sum(payouts, (p) => p.staff_id === s.id && p.paid_at < ms, (p) => Number(p.amount)) + sum(exps, (e) => e.staff_id === s.id && e.expense_date < ms, (e) => Number(e.amount));
    const adjBefore = sum(adjs, (a) => a.staff_id === s.id && a.adj_date < ms, (a) => Number(a.amount));
    const carry = ms > ps ? earnedBefore + adjBefore - paidBefore : 0;
    const earned = month.get(s.id)?.total ?? 0;
    const adj = sum(adjs, (a) => a.staff_id === s.id && inMonth(a.adj_date), (a) => Number(a.amount));
    const paid = sum(payouts, (p) => p.staff_id === s.id && inMonth(p.paid_at), (p) => Number(p.amount)) + sum(exps, (e) => e.staff_id === s.id && inMonth(e.expense_date), (e) => Number(e.amount));
    return { s, carry, earned, adj, paid, balance: carry + earned + adj - paid };
  });
  const moves = [
    ...(payouts ?? []).filter((p) => p.paid_at >= ms).map((p) => ({ id: p.id, kind: "payout" as const, staff_id: p.staff_id, date: p.paid_at, amount: -Number(p.amount), note: p.notes || t("Maaş ödemesi") })),
    ...(exps ?? []).filter((e) => e.expense_date >= ms).map((e) => ({ id: e.id, kind: "expense" as const, staff_id: e.staff_id!, date: e.expense_date, amount: -Number(e.amount), note: `${t(e.category)}${e.description ? ` · ${e.description}` : ""}` })),
    ...(adjs ?? []).filter((a) => a.adj_date >= ms).map((a) => ({ id: a.id, kind: "adj" as const, staff_id: a.staff_id, date: a.adj_date, amount: Number(a.amount), note: a.note || (Number(a.amount) > 0 ? t("Prim") : t("Kesinti")) })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const name = (id: string) => (staff ?? []).find((x) => x.id === id)?.full_name ?? "—";
  const total = rows.reduce((a, r) => a + r.balance, 0);
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href={`/panel/kasa/maas?m=${shift(m, -1)}`}>‹</Link>
        <h1 className="text-xl font-bold">{t("Personel hesaplaşma")} · {fmtMonthYear(ms, lang)}</h1>
        <Link className="btn ghost sm" href={`/panel/kasa/maas?m=${shift(m, 1)}`}>›</Link>
        <Link className="btn ghost sm ml-auto" href={`/panel/kasa/ay?m=${m}`}>{t("Ay özeti")}</Link>
      </header>
      <p className="text-sm text-muted">{t("Kalan = devir + bu ay hak ediş + prim − kesinti − ödenenler (maaş ödemesi, avans). Hesaplaşma {d} tarihinden başlar; öncesi kapanmış sayılır.", { d: fmtDate(ps) })}</p>
      <section className="panel overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="text-[11px] uppercase tracking-wide text-muted bg-sunk"><tr>
            <th className="text-left px-3 py-2">{t("Personel")}</th><th className="text-right px-3 py-2">{t("Devir")}</th><th className="text-right px-3 py-2">{t("Hak ediş")}</th><th className="text-right px-3 py-2">{t("Prim / kesinti")}</th><th className="text-right px-3 py-2">{t("Ödenen")}</th><th className="text-right px-3 py-2">{t("Kalan")}</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.s.id}>
                <td className="px-3 py-2 font-semibold">{r.s.full_name}</td>
                <td className="px-3 py-2 text-right num text-muted">{money(r.carry)}</td>
                <td className="px-3 py-2 text-right num">{money(r.earned)}</td>
                <td className={`px-3 py-2 text-right num ${r.adj < 0 ? "text-bad" : r.adj > 0 ? "text-good" : "text-muted"}`}>{money(r.adj)}</td>
                <td className="px-3 py-2 text-right num text-muted">{money(r.paid)}</td>
                <td className={`px-3 py-2 text-right num font-bold ${r.balance > 0.5 ? "text-warn" : r.balance < -0.5 ? "text-bad" : "text-good"}`}>{money(r.balance)}</td>
              </tr>
            ))}
            <tr className="bg-sunk"><td className="px-3 py-2 font-bold" colSpan={5}>{t("Toplam ödenecek")}</td><td className="px-3 py-2 text-right num font-bold">{money(total)}</td></tr>
          </tbody>
        </table>
      </section>
      <section className="panel grid gap-3">
        <h2 className="font-bold">{t("Ödeme kaydet")}</h2>
        <PayoutForm staff={(staff ?? []) as Staff[]} start={ms} end={to < ms ? ms : to} />
      </section>
      <LedgerForms staff={((staff ?? []) as Staff[]).map((s) => ({ id: s.id, name: s.full_name }))} today={today} payrollStart={ps} />
      <section className="panel grid gap-1">
        <h2 className="font-bold">{t("Bu ayın hareketleri")}</h2>
        {!moves.length && <p className="text-sm text-muted">{t("Hareket yok.")}</p>}
        {moves.map((mv) => (
          <div key={`${mv.kind}${mv.id}`} className="grid grid-cols-[84px_1fr_auto] gap-2 text-sm border-b border-dashed border-line py-1">
            <span className="num text-muted">{fmtDate(mv.date)}</span>
            <span className="min-w-0 truncate"><b>{name(mv.staff_id)}</b> · {mv.note}</span>
            <span className={`num font-bold ${mv.amount < 0 ? "text-muted" : "text-good"}`}>{mv.amount > 0 ? "+" : ""}{money(mv.amount)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
