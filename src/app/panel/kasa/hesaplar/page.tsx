import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { money, fmtDate, todayIso } from "@/lib/format";
import type { CashAccount, PayMethod } from "@/lib/database.types";
import { AccountForms } from "./account-forms";

export async function generateMetadata() { return { title: (await getT())("Kasa ve banka") }; }

const KIND_OF: Record<string, "cash" | "bank" | null> = { cash: "cash", card: "bank", transfer: "bank", online: "bank" };

async function sumAll<T>(fetchPage: (from: number) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let from = 0; from < 200000; from += 1000) { const { data } = await fetchPage(from); out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
  return out;
}

export default async function AccountsPage() {
  const { supabase } = await requireManager();
  const t = await getT();
  const { data: accs } = await supabase.from("cash_accounts").select("*").eq("is_active", true).order("sort_order");
  const accounts = (accs ?? []) as CashAccount[];
  const since = accounts.reduce((m, a) => (a.opening_date < m ? a.opening_date : m), todayIso());
  const [pays, exps, payouts, { data: adjs }] = await Promise.all([
    sumAll((f) => supabase.from("sale_payments").select("method, amount, sale:sales!inner(sale_date)").gte("sale.sale_date", since).range(f, f + 999)),
    sumAll((f) => supabase.from("expenses").select("method, amount, expense_date").gte("expense_date", since).range(f, f + 999)),
    sumAll((f) => supabase.from("staff_payouts").select("method, amount, paid_at").gte("paid_at", since).range(f, f + 999)),
    supabase.from("cash_adjustments").select("*").order("adj_date", { ascending: false }).limit(200),
  ]);
  const rows = accounts.map((a) => {
    const inn = (pays as unknown as { method: PayMethod; amount: number; sale: { sale_date: string } }[]).filter((p) => KIND_OF[p.method] === a.kind && p.sale.sale_date >= a.opening_date).reduce((s, p) => s + Number(p.amount), 0);
    const out1 = (exps as { method: PayMethod; amount: number; expense_date: string }[]).filter((e) => KIND_OF[e.method] === a.kind && e.expense_date >= a.opening_date).reduce((s, e) => s + Number(e.amount), 0);
    const out2 = (payouts as { method: PayMethod; amount: number; paid_at: string }[]).filter((e) => KIND_OF[e.method] === a.kind && e.paid_at >= a.opening_date).reduce((s, e) => s + Number(e.amount), 0);
    const adj = (adjs ?? []).filter((x) => x.account_id === a.id && x.adj_date >= a.opening_date).reduce((s, x) => s + Number(x.amount), 0);
    return { a, inn, out: out1 + out2, adj, balance: Number(a.opening_balance) + inn - out1 - out2 + adj };
  });
  return (
    <div className="grid gap-4 max-w-3xl">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Kasa ve banka")}</h1>
        <Link className="btn ghost sm ml-auto" href="/panel/kasa">{t("← Günlük kasa")}</Link>
      </header>
      <p className="text-sm text-muted">{t("Bakiye = açılış + tahsilatlar − giderler − personel ödemeleri ± düzeltmeler. Nakit tahsilat Kasa'ya, kart/havale Banka'ya yazılır. Gerçek tutarı saydığınızda \"Sayım\" ile düzeltin.")}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map(({ a, inn, out, adj, balance }) => (
          <section key={a.id} className="panel grid gap-1">
            <div className="flex items-center gap-2"><b>{t(a.name)}</b><span className="pill text-[10px] ml-auto">{t("açılış")} {fmtDate(a.opening_date)}</span></div>
            <b className="font-display text-2xl num">{money(balance)}</b>
            <div className="text-xs text-muted grid gap-0.5">
              <span>{t("Açılış")}: {money(a.opening_balance)}</span>
              <span>{t("Tahsilat")}: +{money(inn)}</span>
              <span>{t("Çıkış (gider + maaş)")}: −{money(out)}</span>
              {adj ? <span>{t("Düzeltmeler")}: {adj > 0 ? "+" : ""}{money(adj)}</span> : null}
            </div>
          </section>
        ))}
      </div>
      <AccountForms accounts={rows.map((r) => ({ id: r.a.id, name: r.a.name, balance: Math.round(r.balance * 100) / 100, opening_balance: Number(r.a.opening_balance), opening_date: r.a.opening_date }))} />
      <section className="panel grid gap-1">
        <h2 className="font-bold">{t("Düzeltme geçmişi")}</h2>
        {!(adjs ?? []).length && <p className="text-sm text-muted">{t("Henüz düzeltme yok.")}</p>}
        {(adjs ?? []).map((x) => (
          <div key={x.id} className="grid grid-cols-[90px_1fr_auto] gap-2 text-sm border-b border-dashed border-line py-1">
            <span className="num text-muted">{fmtDate(x.adj_date)}</span>
            <span>{t(accounts.find((a) => a.id === x.account_id)?.name ?? "")} · {x.note || "—"}</span>
            <span className={`num font-bold ${Number(x.amount) < 0 ? "text-bad" : "text-good"}`}>{Number(x.amount) > 0 ? "+" : ""}{money(x.amount)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
