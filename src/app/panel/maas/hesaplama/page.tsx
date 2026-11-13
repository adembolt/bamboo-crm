import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { computePayroll } from "@/lib/payroll";
import { money, todayIso } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";

export async function generateMetadata() { return { title: (await getT())("Bordro hesaplama") }; }

/* DIKIDI "Payroll calculation": seçilen dönemde her personelin hak edişi kalem kalem */
export default async function PayrollCalcPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "day");
  const staffF = typeof sp.s === "string" ? sp.s : "";
  const { supabase } = await requireManager();
  const t = await getT();
  const to = period.to > todayIso() ? todayIso() : period.to;
  const [{ data: staff }, pay, { data: tips }] = await Promise.all([
    supabase.from("staff").select("id, full_name, title, is_active").order("sort_order"),
    period.from <= to ? computePayroll(supabase, period.from, to) : Promise.resolve(new Map()),
    supabase.from("tips").select("staff_id, amount").eq("to_payroll", true).gte("tip_date", period.from).lte("tip_date", to),
  ]);
  const rows = (staff ?? []).filter((s) => (!staffF || s.id === staffF)).map((s) => {
    const p = pay.get(s.id);
    const tip = (tips ?? []).filter((x) => x.staff_id === s.id).reduce((a, x) => a + Number(x.amount), 0);
    return { s, p, tip, total: (p?.total ?? 0) + tip };
  }).filter((r) => r.s.is_active || r.total > 0);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const cols: [string, (r: (typeof rows)[number]) => number][] = [
    [t("Hizmet satışı"), (r) => r.p?.serviceSales ?? 0], [t("Ürün satışı"), (r) => r.p?.productSales ?? 0],
    [t("% kendi satış"), (r) => r.p?.own ?? 0], [t("% şirket satışı"), (r) => r.p?.company ?? 0], [t("Randevu primi"), (r) => r.p?.booking ?? 0],
    [t("Günlük ücret"), (r) => r.p?.fixed ?? 0], [t("Garanti farkı"), (r) => r.p?.guarantee ?? 0], [t("Bahşiş"), (r) => r.tip],
  ];
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Bordro hesaplama")}</h1>
        <span className="ml-auto flex gap-2">
          <Link className="btn ghost sm" href="/panel/maas/semalar">{t("Maaş şemaları")}</Link>
          <Link className="btn sm" href={`/panel/kasa/maas?m=${period.d.slice(0, 7)}`}>{t("Hesaplaşma ve ödeme")}</Link>
        </span>
      </header>
      <div className="flex gap-3 flex-wrap items-center">
        <PeriodBar base="/panel/maas/hesaplama" period={period} keep={{ s: staffF || undefined }} />
        <form className="flex gap-2 items-center"><input type="hidden" name="p" value={period.p} /><input type="hidden" name="d" value={period.d} />
          <span className="inp"><select name="s" defaultValue={staffF}><option value="">{t("Tüm personel")}</option>{(staff ?? []).filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span>
          <button className="btn ghost sm">{t("Uygula")}</button></form>
      </div>
      <section className="panel p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted border-b border-line"><th className="text-left p-2">{t("Personel")}</th>{cols.map(([l]) => <th key={l} className="text-right p-2 whitespace-nowrap">{l}</th>)}<th className="text-right p-2">{t("Ödenecek")}</th></tr></thead>
          <tbody>
            <tr className="bg-sunk font-bold"><td className="p-2">{t("Toplam")}</td>{cols.map(([l, f]) => <td key={l} className="p-2 text-right num">{money(sum(f))}</td>)}<td className="p-2 text-right num">{money(sum((r) => r.total))}</td></tr>
            {rows.map((r) => (
              <tr key={r.s.id} className="border-t border-line">
                <td className="p-2"><b>{r.s.full_name}</b><div className="text-[11px] text-muted">{r.s.title}{r.p?.days ? ` · ${t("{n} gün", { n: r.p.days })}` : ""}{!r.p?.scheme ? ` · ${t("şema yok")}` : ""}</div></td>
                {cols.map(([l, f]) => <td key={l} className="p-2 text-right num">{f(r) ? money(f(r)) : "—"}</td>)}
                <td className="p-2 text-right num font-bold">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted">{t("Hak ediş, her personelin o günde geçerli maaş şemasına göre hesaplanır. Bugünden sonraki günler hesaba katılmaz.")}</p>
    </div>
  );
}
