import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fullName, money } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";
import type { CashAccount } from "@/lib/database.types";

export async function generateMetadata() { return { title: (await getT())("Nakit akışı") }; }

const KIND_OF: Record<string, "cash" | "bank" | null> = { cash: "cash", card: "bank", transfer: "bank", online: "bank" };
const METHOD: Record<string, string> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online" };
type Move = { date: string; type: "in" | "out" | "adj"; label: string; who: string; account: "cash" | "bank"; method: string; amount: number; href?: string };

async function all<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = []; for (let i = 0; i < 300000; i += 1000) { const { data } = await q(i, i + 999); out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out;
}

/* DIKIDI "Cash flow": dönem başı bakiye + gelir − gider = dönem sonu, nakit ve banka ayrı; tüm hareketler tek listede */
export default async function CashFlowPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "day");
  const typeF = sp.tur === "in" || sp.tur === "out" ? sp.tur : "";
  const { supabase } = await requireManager();
  const t = await getT();
  const { data: accs } = await supabase.from("cash_accounts").select("*").eq("is_active", true).order("sort_order");
  const accounts = (accs ?? []) as CashAccount[];
  const since = accounts.reduce((m, a) => (a.opening_date < m ? a.opening_date : m), period.from);
  type P = { method: string; amount: number; sale: { sale_date: string; customer: { first_name: string; last_name: string } | null; id: string } };
  const [pays, exps, payouts, adjs, tips, { data: staff }] = await Promise.all([
    all<P>((a, b) => supabase.from("sale_payments").select("method, amount, sale:sales!inner(id, sale_date, customer:customers(first_name, last_name))").gte("sale.sale_date", since).lte("sale.sale_date", period.to).range(a, b) as unknown as PromiseLike<{ data: P[] | null }>),
    all<{ method: string; amount: number; expense_date: string; category: string; description: string; staff_id: string | null }>((a, b) => supabase.from("expenses").select("method, amount, expense_date, category, description, staff_id").gte("expense_date", since).lte("expense_date", period.to).range(a, b)),
    all<{ method: string; amount: number; paid_at: string; staff_id: string; notes: string }>((a, b) => supabase.from("staff_payouts").select("method, amount, paid_at, staff_id, notes").gte("paid_at", since).lte("paid_at", period.to).range(a, b)),
    all<{ account_id: string; amount: number; adj_date: string; note: string }>((a, b) => supabase.from("cash_adjustments").select("account_id, amount, adj_date, note").gte("adj_date", since).lte("adj_date", period.to).range(a, b)),
    all<{ method: string; amount: number; tip_date: string; staff_id: string }>((a, b) => supabase.from("tips").select("method, amount, tip_date, staff_id").eq("to_payroll", true).gte("tip_date", since).lte("tip_date", period.to).range(a, b)),
    supabase.from("staff").select("id, full_name"),
  ]);
  const sn = (id: string | null) => staff?.find((s) => s.id === id)?.full_name ?? "";
  const accKind = (id: string) => accounts.find((a) => a.id === id)?.kind as "cash" | "bank" | undefined;
  const moves: Move[] = [];
  for (const p of pays) { const k = KIND_OF[p.method]; if (k) moves.push({ date: p.sale.sale_date, type: "in", label: t("Satış"), who: p.sale.customer ? fullName(p.sale.customer) : t("Anonim"), account: k, method: p.method, amount: Number(p.amount) }); }
  for (const x of tips) { const k = KIND_OF[x.method]; if (k) moves.push({ date: x.tip_date, type: "in", label: t("Bahşiş"), who: sn(x.staff_id), account: k, method: x.method, amount: Number(x.amount) }); }
  for (const e of exps) { const k = KIND_OF[e.method]; if (k) moves.push({ date: e.expense_date, type: "out", label: t(e.category), who: [sn(e.staff_id), e.description].filter(Boolean).join(" · "), account: k, method: e.method, amount: -Number(e.amount) }); }
  for (const e of payouts) { const k = KIND_OF[e.method]; if (k) moves.push({ date: e.paid_at.slice(0, 10), type: "out", label: t("Maaş ödemesi"), who: [sn(e.staff_id), e.notes].filter(Boolean).join(" · "), account: k, method: e.method, amount: -Number(e.amount) }); }
  for (const a of adjs) { const k = accKind(a.account_id); if (k) moves.push({ date: a.adj_date, type: "adj", label: Number(a.amount) >= 0 ? t("Kasaya giriş / düzeltme") : t("Kasadan çıkış / düzeltme"), who: a.note, account: k, method: "", amount: Number(a.amount) }); }

  const summary = accounts.map((a) => {
    const mine = moves.filter((m) => m.account === a.kind && m.date >= a.opening_date);
    const before = mine.filter((m) => m.date < period.from).reduce((s, m) => s + m.amount, 0);
    const inPer = mine.filter((m) => m.date >= period.from);
    const inc = inPer.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const out = inPer.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);
    const open = period.from > a.opening_date ? Number(a.opening_balance) + before : Number(a.opening_balance);
    return { a, open, inc, out, close: open + inc + out };
  });
  const tot = summary.reduce((s, r) => ({ open: s.open + r.open, inc: s.inc + r.inc, out: s.out + r.out, close: s.close + r.close }), { open: 0, inc: 0, out: 0, close: 0 });
  const list = moves.filter((m) => m.date >= period.from && (!typeF || (typeF === "in" ? m.amount > 0 : m.amount < 0))).sort((a, b) => b.date.localeCompare(a.date));
  const keep = { tur: typeF || undefined };
  const card = (label: string, v: number, cls = "") => (
    <section className="panel grid gap-1 content-start">
      <span className="text-sm text-muted">{label}</span><b className={`num text-xl ${cls}`}>{money(v)}</b>
      {label === t("Dönem başı bakiye") ? summary.map((r) => <span key={r.a.id} className="text-xs text-muted flex justify-between"><span>{t(r.a.name)}</span><span className="num">{money(r.open)}</span></span>)
        : label === t("Dönem sonu bakiye") ? summary.map((r) => <span key={r.a.id} className="text-xs text-muted flex justify-between"><span>{t(r.a.name)}</span><span className="num">{money(r.close)}</span></span>)
        : label === t("Gelir") ? summary.map((r) => <span key={r.a.id} className="text-xs text-muted flex justify-between"><span>{t(r.a.name)}</span><span className="num">{money(r.inc)}</span></span>)
        : summary.map((r) => <span key={r.a.id} className="text-xs text-muted flex justify-between"><span>{t(r.a.name)}</span><span className="num">{money(-r.out)}</span></span>)}
    </section>
  );
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Nakit akışı")}</h1>
        <span className="ml-auto flex gap-2">
          <Link className="btn ghost sm" href={`/panel/kasa?d=${period.to}`}>+ {t("Gider")}</Link>
          <Link className="btn ghost sm" href="/panel/kasa/hesaplar">{t("Transfer / sayım")}</Link>
        </span>
      </header>
      <PeriodBar base="/panel/finans/akis" period={period} keep={keep} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {card(t("Dönem başı bakiye"), tot.open)}{card(t("Gelir"), tot.inc, "text-good")}{card(t("Gider"), -tot.out, "text-bad")}{card(t("Dönem sonu bakiye"), tot.close)}
      </div>
      <div className="flex gap-1.5">
        {[["", t("Tümü")], ["in", t("Gelir")], ["out", t("Gider")]].map(([k, l]) => (
          <Link key={k} className={`pill ${typeF === k ? "good" : ""}`} href={`/panel/finans/akis?p=${period.p}&d=${period.d}${k ? `&tur=${k}` : ""}`}>{l}</Link>
        ))}
      </div>
      <section className="panel grid gap-0.5">
        <div className="hidden sm:grid grid-cols-[90px_150px_minmax(0,1fr)_110px_120px] gap-3 text-xs text-muted font-semibold pb-1 border-b border-line"><span>{t("Tarih")}</span><span>{t("İşlem")}</span><span>{t("Açıklama")}</span><span>{t("Hesap")}</span><span className="text-right">{t("Tutar")}</span></div>
        {!list.length && <p className="text-sm text-muted py-2">{t("Bu dönemde hareket yok.")}</p>}
        {list.slice(0, 1500).map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[90px_150px_minmax(0,1fr)_110px_120px] gap-x-3 items-center text-sm py-1 border-b border-dashed border-line">
            <span className="num text-xs text-muted">{fmtDate(m.date)}</span>
            <span className="font-semibold">{m.label}</span>
            <span className="truncate text-muted">{m.who || "—"}</span>
            <span className="text-xs">{t(m.account === "cash" ? "Kasa (nakit)" : "Banka / POS")}{m.method && m.method !== "cash" ? ` · ${t(METHOD[m.method] ?? m.method)}` : ""}</span>
            <b className={`num text-right ${m.amount < 0 ? "text-bad" : "text-good"}`}>{m.amount > 0 ? "+" : ""}{money(m.amount)}</b>
          </div>
        ))}
        {list.length > 1500 && <p className="text-xs text-muted">{t("İlk 1500 hareket gösteriliyor; tamamı için Rapor indir.")}</p>}
      </section>
      <p className="text-xs text-muted">{t("Hediye çeki, puan ve bakiye ile yapılan ödemeler para girişi olmadığı için burada yer almaz.")}</p>
    </div>
  );
}
