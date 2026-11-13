import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { computePayroll } from "@/lib/payroll";
import { fmtDate, money, todayIso } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";

export async function generateMetadata() { return { title: (await getT())("Tahakkuklar") }; }

/* DIKIDI "Accruals": gün gün, personel personel tahakkuk eden hak ediş (+ bahşiş, prim, kesinti) */
export default async function AccrualsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "month");
  const staffF = typeof sp.s === "string" ? sp.s : "";
  const onlyWorking = sp.w !== "0";
  const { supabase } = await requireManager();
  const t = await getT();
  const to = period.to > todayIso() ? todayIso() : period.to;
  const [{ data: staff }, pay, { data: tips }, { data: adjs }] = await Promise.all([
    supabase.from("staff").select("id, full_name, is_active").order("sort_order"),
    period.from <= to ? computePayroll(supabase, period.from, to) : Promise.resolve(new Map()),
    supabase.from("tips").select("staff_id, amount, tip_date, note").eq("to_payroll", true).gte("tip_date", period.from).lte("tip_date", to),
    supabase.from("staff_adjustments").select("staff_id, amount, adj_date, note").gte("adj_date", period.from).lte("adj_date", to),
  ]);
  const name = (id: string) => staff?.find((s) => s.id === id)?.full_name ?? "—";
  type Row = { day: string; staff: string; type: string; amount: number; note: string };
  const rows: Row[] = [];
  for (const [sid, p] of pay) for (const d of p.byDay) if (!onlyWorking || d.worked || d.total > 0) if (d.total > 0) rows.push({ day: d.day, staff: sid, type: t("Tahakkuk"), amount: d.total, note: t("Maaş şemasına göre") });
  for (const x of tips ?? []) rows.push({ day: x.tip_date, staff: x.staff_id, type: t("Bahşiş"), amount: Number(x.amount), note: x.note });
  for (const x of adjs ?? []) rows.push({ day: x.adj_date, staff: x.staff_id, type: Number(x.amount) >= 0 ? t("Prim") : t("Kesinti"), amount: Number(x.amount), note: x.note });
  const list = rows.filter((r) => !staffF || r.staff === staffF).sort((a, b) => b.day.localeCompare(a.day) || name(a.staff).localeCompare(name(b.staff)));
  const total = list.reduce((a, r) => a + r.amount, 0);
  const keep = { s: staffF || undefined, w: onlyWorking ? undefined : "0" };
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Tahakkuklar")}</h1>
        <span className="ml-auto flex gap-2">
          <Link className="btn ghost sm" href={`/panel/kasa/maas?m=${period.d.slice(0, 7)}`}>{t("Prim / kesinti ekle")}</Link>
          <Link className="btn sm" href={`/panel/kasa/maas?m=${period.d.slice(0, 7)}`}>{t("Maaş öde")}</Link>
        </span>
      </header>
      <div className="flex gap-3 flex-wrap items-center">
        <PeriodBar base="/panel/maas/tahakkuklar" period={period} keep={keep} />
        <form className="flex gap-2 items-center flex-wrap"><input type="hidden" name="p" value={period.p} /><input type="hidden" name="d" value={period.d} />
          <span className="inp"><select name="s" defaultValue={staffF}><option value="">{t("Tüm personel")}</option>{(staff ?? []).filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span>
          <span className="inp"><select name="w" defaultValue={onlyWorking ? "1" : "0"}><option value="1">{t("Sadece çalışılan günler")}</option><option value="0">{t("Tüm günler")}</option></select></span>
          <button className="btn ghost sm">{t("Uygula")}</button></form>
      </div>
      <section className="panel grid gap-0.5">
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)_110px_100px] gap-3 text-xs text-muted font-semibold pb-1 border-b border-line"><span>{t("Personel")}</span><span>{t("Tür")}</span><span>{t("Not")}</span><span className="text-right">{t("Tutar")}</span><span className="text-right">{t("Tarih")}</span></div>
        {!list.length && <p className="text-sm text-muted py-2">{t("Bu dönemde tahakkuk yok.")}</p>}
        {list.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)_110px_100px] gap-x-3 items-center text-sm py-1 border-b border-dashed border-line">
            <b className="truncate">{name(r.staff)}</b>
            <span className="text-xs">{r.type}</span>
            <span className="text-xs text-muted truncate">{r.note || "—"}</span>
            <b className={`num text-right ${r.amount < 0 ? "text-bad" : ""}`}>{money(r.amount)}</b>
            <span className="num text-xs text-muted text-right">{fmtDate(r.day)}</span>
          </div>
        ))}
        {list.length > 0 && <div className="flex justify-between pt-2 font-bold text-sm"><span>{t("Toplam")}</span><span className="num">{money(total)}</span></div>}
      </section>
    </div>
  );
}
