import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { computePayroll } from "@/lib/payroll";
import { money, fmtDate, todayIso, fmtMonthYear } from "@/lib/format";
import { getT, getLang } from "@/lib/i18n/server";
import { PayoutForm } from "./payout-form";
import type { Staff } from "@/lib/database.types";

export async function generateMetadata() { return { title: (await getT())("Ay özeti") }; }

function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const start = `${y}-${String(mo).padStart(2, "0")}-01`;
  const endD = new Date(Date.UTC(y, mo, 0));
  return { start, end: endD.toISOString().slice(0, 10), days: endD.getUTCDate() };
}
function addDaysIso(d: string, n: number) { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function shiftMonth(m: string, n: number) { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); }

export default async function MonthPage({ searchParams }: PageProps<"/panel/kasa/ay">) {
  const sp = await searchParams;
  const m = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : todayIso().slice(0, 7);
  const { start, end } = monthRange(m);
  const { supabase, profile } = await requireSession();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const [t, lang] = [await getT(), await getLang()];

  const prevStart = `${shiftMonth(m, -1)}-01`, prevEnd = addDaysIso(start, -1);
  const [{ data: sales }, { data: pays }, { data: exps }, { data: staff }, { data: payouts }, earn, { data: settings }, { data: mats }, { data: prevPays }] = await Promise.all([
    supabase.from("sales").select("id, sale_date, total").gte("sale_date", start).lte("sale_date", end),
    supabase.from("sale_payments").select("method, amount, sale:sales!inner(sale_date)").gte("sale.sale_date", start).lte("sale.sale_date", end),
    supabase.from("expenses").select("expense_date, category, amount, method, staff_id").gte("expense_date", start).lte("expense_date", end),
    supabase.from("staff").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("staff_payouts").select("*").gte("period_start", start).lte("period_end", end),
    computePayroll(supabase, start, end),
    supabase.from("settings").select("kdv_rate").eq("id", 1).single(),
    supabase.from("sale_items").select("kind, qty, material_cost, product:products(cost_price), sale:sales!inner(sale_date)").gte("sale.sale_date", start).lte("sale.sale_date", end).limit(10000),
    supabase.from("sale_payments").select("method, amount, sale:sales!inner(sale_date)").gte("sale.sale_date", prevStart).lte("sale.sale_date", prevEnd).limit(10000),
  ]);
  // Sarf + satılan ürünlerin alış maliyeti
  const materials = ((mats ?? []) as unknown as { kind: string; qty: number; material_cost: number; product: { cost_price: number } | null }[])
    .reduce((s, i) => s + Number(i.material_cost ?? 0) + (i.kind === "product" && i.product ? Number(i.product.cost_price) * Number(i.qty) : 0), 0);

  // Ciro = gerçek tahsilat (hediye çeki / puan / bakiye ile ödenen kısım, yüklendiği gün zaten sayıldı)
  const NOT_MONEY = ["gift_card", "points", "balance"];
  const byMethod: Record<string, number> = {};
  for (const p of pays ?? []) byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  const gross = (pays ?? []).filter((p) => !NOT_MONEY.includes(p.method)).reduce((s, p) => s + Number(p.amount), 0);
  const prevGross = (prevPays ?? []).filter((p) => !NOT_MONEY.includes(p.method)).reduce((s, p) => s + Number(p.amount), 0);
  const change = prevGross > 0 ? Math.round(((gross - prevGross) / prevGross) * 1000) / 10 : null;
  const expTotal = (exps ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const byCat: Record<string, number> = {};
  for (const e of exps ?? []) byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount);
  const kdv = Number(settings?.kdv_rate ?? 0.2);
  const net = gross / (1 + kdv);
  const byDay = new Map<string, number>();
  for (const p of (pays ?? []) as unknown as { method: string; amount: number; sale: { sale_date: string } }[]) if (!NOT_MONEY.includes(p.method)) byDay.set(p.sale.sale_date, (byDay.get(p.sale.sale_date) ?? 0) + Number(p.amount));
  const maxDay = Math.max(1, ...byDay.values());

  const staffRows = ((staff ?? []) as Staff[]).map((s) => {
    const p = earn.get(s.id);
    const e = { service: p?.serviceSales ?? 0, product: p?.productSales ?? 0 };
    const due = p?.total ?? 0;
    const advances = (exps ?? []).filter((x) => x.staff_id === s.id && ["avans", "prim", "maaş"].includes(x.category)).reduce((a, x) => a + Number(x.amount), 0);
    const paid = (payouts ?? []).filter((p) => p.staff_id === s.id).reduce((a, p) => a + Number(p.amount), 0);
    return { s, e, p, due, advances, paid, remaining: due - advances - paid };
  });
  const totalDue = staffRows.reduce((a, r) => a + r.due, 0);

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href={`/panel/kasa/ay?m=${shiftMonth(m, -1)}`}>‹</Link>
        <h1 className="text-xl font-bold">{fmtMonthYear(start, lang)}</h1>
        <Link className="btn ghost sm" href={`/panel/kasa/ay?m=${shiftMonth(m, 1)}`}>›</Link>
        {isManager && <Link className="btn ghost sm ml-auto" href={`/panel/kasa/maas?m=${m}`}>{t("Personel hesaplaşma")}</Link>}
        <Link className={`btn ghost sm${isManager ? "" : " ml-auto"}`} href={`/panel/kasa/rapor?p=month&from=${start}`}>{t("Grafikler")}</Link>
        <Link className="btn ghost sm" href="/panel/kasa">{t("← Günlük kasa")}</Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label={t("Aylık ciro")} value={money(gross)} sub={`${change === null ? "" : `${change >= 0 ? "▲" : "▼"} %${Math.abs(change)} ${t("geçen aya göre")} · `}${t("{n} satış · net {net}", { n: (sales ?? []).length, net: money(net) })}`} accent />
        <Kpi label={t("Nakit / Kart")} value={`${money(byMethod.cash ?? 0)} / ${money(byMethod.card ?? 0)}`} sub={t("havale {amount}", { amount: money(byMethod.transfer ?? 0) })} />
        <Kpi label={t("Giderler")} value={money(expTotal)} sub={Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${t(k)} ${money(v)}`).join(" · ") || "—"} />
        <Kpi label={t("Personel hak edişi")} value={money(totalDue)} sub={t("maaş şemalarına göre")} />
        <Kpi label={t("Kâr (yaklaşık)")} value={money(gross - expTotal - totalDue - materials)} sub={t("ciro − gider − hak ediş − sarf/ürün maliyeti ({m})", { m: money(materials) })} />
      </div>

      <section className="panel grid gap-2">
        <h2 className="text-lg font-bold">{t("Günlük ciro")}</h2>
        <div className="grid gap-1">
          {[...byDay.entries()].sort().map(([d, v]) => (
            <Link key={d} href={`/panel/kasa?d=${d}`} className="grid grid-cols-[72px_1fr_90px] gap-2 items-center text-sm hover:bg-sunk rounded px-1">
              <span className="num text-muted">{fmtDate(d).slice(0, 5)}</span>
              <span className="h-3 rounded bg-sunk overflow-hidden"><span className="block h-full bg-green" style={{ width: `${(v / maxDay) * 100}%` }} /></span>
              <span className="num font-bold text-right">{money(v)}</span>
            </Link>
          ))}
          {!byDay.size && <p className="text-sm text-muted">{t("Bu ay satış yok.")}</p>}
        </div>
      </section>

      <section className="panel grid gap-3">
        <h2 className="text-lg font-bold">{t("Personel hak edişi")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[11px] uppercase tracking-wide text-muted bg-sunk"><tr><th className="text-left px-3 py-2">{t("Personel")}</th><th className="text-right px-3 py-2">{t("Hizmet cirosu")}</th><th className="text-right px-3 py-2">{t("Ürün")}</th><th className="text-right px-3 py-2">{t("Hak ediş")}</th><th className="text-right px-3 py-2">{t("Avans/prim")}</th><th className="text-right px-3 py-2">{t("Ödenen")}</th><th className="text-right px-3 py-2">{t("Kalan")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {staffRows.map(({ s, e, p, due, advances, paid, remaining }) => (
                <tr key={s.id}>
                  <td className="px-3 py-2"><b>{s.full_name}</b><div className="text-[11px] text-muted">{p?.scheme ? [p.own && `${t("kendi")} ${money(p.own)}`, p.company && `${t("şirket")} ${money(p.company)}`, p.booking && `${t("randevu primi")} ${money(p.booking)}`, p.fixed && `${t("günlük")} ${money(p.fixed)} (${t("{n} gün", { n: p.days })})`, p.guarantee && `${t("garanti farkı")} ${money(p.guarantee)}`].filter(Boolean).join(" · ") || t("maaş şeması") : `%${s.pay_percent}${Number(s.product_percent) ? ` / ${t("ürün %{n}", { n: s.product_percent })}` : ""}`}</div></td>
                  <td className="px-3 py-2 text-right num">{money(e.service)}</td>
                  <td className="px-3 py-2 text-right num">{money(e.product)}</td>
                  <td className="px-3 py-2 text-right num font-bold">{money(due)}</td>
                  <td className="px-3 py-2 text-right num text-muted">{money(advances)}</td>
                  <td className="px-3 py-2 text-right num text-muted">{money(paid)}</td>
                  <td className={`px-3 py-2 text-right num font-bold ${remaining > 0 ? "text-warn" : "text-good"}`}>{money(remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isManager && <PayoutForm staff={(staff ?? []) as Staff[]} start={start} end={end} />}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 grid gap-1 border ${accent ? "bg-green-soft border-green/30" : "bg-surface border-line"}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-display text-lg num leading-tight">{value}</b>
      <span className="text-[11px] text-muted truncate">{sub}</span>
    </div>
  );
}
