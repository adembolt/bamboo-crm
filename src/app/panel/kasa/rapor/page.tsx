import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { todayIso, addDays, money, fmtDate, minutesOfDay, fmtMonthYear } from "@/lib/format";
import { Donut, Bars } from "@/components/charts";
import { foldSlices, SERIES } from "@/lib/charts";
import { getT, getLang } from "@/lib/i18n/server";

export async function generateMetadata() { return { title: (await getT())("Raporlar") }; }

type Period = "day" | "week" | "month" | "custom";
const METHOD: Record<string, string> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online", package: "Paket", gift_card: "Hediye çeki", other: "Diğer" };

function range(p: Period, from?: string, to?: string) {
  const t = todayIso();
  if (p === "day") return { start: from ?? t, end: from ?? t };
  if (p === "week") { const d = new Date((from ?? t) + "T12:00:00Z"); const wd = (d.getUTCDay() + 6) % 7; const s = addDays(from ?? t, -wd); return { start: s, end: addDays(s, 6) }; }
  if (p === "month") { const m = (from ?? t).slice(0, 7); const [y, mo] = m.split("-").map(Number); return { start: `${m}-01`, end: new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10) }; }
  return { start: from ?? addDays(t, -29), end: to ?? t };
}

export default async function ReportPage({ searchParams }: PageProps<"/panel/kasa/rapor">) {
  const sp = await searchParams;
  const p = (["day", "week", "month", "custom"].includes(String(sp.p)) ? sp.p : "month") as Period;
  const from = typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : undefined;
  const to = typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : undefined;
  const { start, end } = range(p, from, to);
  const { supabase } = await requireSession();
  const [t, lang] = [await getT(), await getLang()];

  const [{ data: sales }, { data: pays }, { data: items }, { data: exps }, { data: staff }, { data: cats }, { data: settings }] = await Promise.all([
    supabase.from("sales").select("id, sale_date, total, created_at").gte("sale_date", start).lte("sale_date", end),
    supabase.from("sale_payments").select("method, amount, sale:sales!inner(sale_date)").gte("sale.sale_date", start).lte("sale.sale_date", end),
    supabase.from("sale_items").select("staff_id, kind, name, total, visit_item:visit_items(service:services(category_id)), sale:sales!inner(sale_date)").gte("sale.sale_date", start).lte("sale.sale_date", end),
    supabase.from("expenses").select("expense_date, category, amount").gte("expense_date", start).lte("expense_date", end),
    supabase.from("staff").select("id, full_name"),
    supabase.from("service_categories").select("id, name_tr"),
    supabase.from("settings").select("kdv_rate").eq("id", 1).single(),
  ]);

  const gross = (sales ?? []).reduce((a, s) => a + Number(s.total), 0);
  const kdv = Number(settings?.kdv_rate ?? 0.2);
  const expTotal = (exps ?? []).reduce((a, e) => a + Number(e.amount), 0);

  const agg = (rows: { key: string; value: number }[]) => { const m = new Map<string, number>(); for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.value); return [...m.entries()].map(([label, value]) => ({ label, value })); };
  const byMethod = agg((pays ?? []).map((x) => ({ key: METHOD[x.method] ? t(METHOD[x.method]) : x.method, value: Number(x.amount) })));
  const staffName = (id: string | null) => staff?.find((s) => s.id === id)?.full_name ?? t("Atanmamış");
  const catName = (id: string | null | undefined) => cats?.find((c) => c.id === id)?.name_tr ?? t("Diğer");
  const byStaff = agg((items ?? []).map((x) => ({ key: staffName(x.staff_id), value: Number(x.total) })));
  const byCat = agg((items ?? []).map((x) => ({ key: x.kind === "product" ? t("Ürün satışı") : catName(x.visit_item?.service?.category_id), value: Number(x.total) })));
  const byExp = agg((exps ?? []).map((x) => ({ key: t(x.category), value: Number(x.amount) })));
  const topServices = agg((items ?? []).map((x) => ({ key: x.name, value: Number(x.total) }))).sort((a, b) => b.value - a.value).slice(0, 8);

  // Zaman serisi: gün → saat, diğerleri → gün
  let series: { label: string; value: number }[] = [];
  if (p === "day") {
    const hours = new Map<number, number>();
    for (const s of sales ?? []) { const h = Math.floor(minutesOfDay(s.created_at) / 60); hours.set(h, (hours.get(h) ?? 0) + Number(s.total)); }
    const hs = [...hours.keys()]; const lo = hs.length ? Math.min(9, ...hs) : 9, hi = hs.length ? Math.max(21, ...hs) : 21;
    for (let h = lo; h <= hi; h++) series.push({ label: `${h}:00`, value: hours.get(h) ?? 0 });
  } else {
    const days = new Map<string, number>();
    for (let d = start; d <= end; d = addDays(d, 1)) days.set(d, 0);
    for (const s of sales ?? []) days.set(s.sale_date, (days.get(s.sale_date) ?? 0) + Number(s.total));
    series = [...days.entries()].map(([d, v]) => ({ label: fmtDate(d).slice(0, 5), value: v }));
  }

  const q = (pp: Period, f?: string, e?: string) => `/panel/kasa/rapor?p=${pp}${f ? `&from=${f}` : ""}${e ? `&to=${e}` : ""}`;
  const shift = (n: number) => p === "day" ? q("day", addDays(start, n)) : p === "week" ? q("week", addDays(start, 7 * n)) : p === "month" ? q("month", (() => { const [y, m] = start.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); })()) : q("custom", from, to);
  const title = p === "day" ? fmtDate(start) : p === "week" ? `${fmtDate(start)} – ${fmtDate(end)}` : p === "month" ? fmtMonthYear(start, lang) : `${fmtDate(start)} – ${fmtDate(end)}`;

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold">{t("Raporlar")}</h1>
        <nav className="flex gap-1 bg-sunk p-1 rounded-lg">
          {(["day", "week", "month", "custom"] as Period[]).map((pp) => <Link key={pp} href={q(pp)} className={`px-3 py-1 rounded-md text-sm font-semibold ${pp === p ? "bg-surface shadow-card" : "text-muted"}`}>{t({ day: "Gün", week: "Hafta", month: "Ay", custom: "Aralık" }[pp])}</Link>)}
        </nav>
        {p !== "custom" ? (
          <span className="flex items-center gap-1"><Link className="btn ghost sm" href={shift(-1)}>‹</Link><b className="min-w-[140px] text-center">{title}</b><Link className="btn ghost sm" href={shift(1)}>›</Link></span>
        ) : (
          <form className="flex items-center gap-2" action="/panel/kasa/rapor"><input type="hidden" name="p" value="custom" /><span className="inp"><input type="date" name="from" defaultValue={start} /></span><span className="text-muted">–</span><span className="inp"><input type="date" name="to" defaultValue={end} /></span><button className="btn ghost sm">{t("Göster")}</button></form>
        )}
        <Link className="btn ghost sm ml-auto" href="/panel/kasa">{t("Günlük kasa")}</Link>
        <Link className="btn ghost sm" href={`/panel/kasa/ay?m=${start.slice(0, 7)}`}>{t("Ay özeti")}</Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={t("Ciro")} value={money(gross)} sub={t("net {net} · {n} satış", { net: money(gross / (1 + kdv)), n: (sales ?? []).length })} accent />
        <Kpi label={t("Ortalama fiş")} value={(sales ?? []).length ? money(gross / (sales ?? []).length) : "—"} sub={t("satış başına")} />
        <Kpi label={t("Gider")} value={money(expTotal)} sub={t("{n} kayıt", { n: (exps ?? []).length })} />
        <Kpi label={t("Ciro − gider")} value={money(gross - expTotal)} sub={t("hak ediş hariç")} />
      </div>

      <Bars title={p === "day" ? t("Saat bazında ciro") : t("Günlük ciro")} points={series} />

      <div className="grid md:grid-cols-2 gap-4">
        <Donut title={t("Ödeme yöntemi")} slices={foldSlices(byMethod)} />
        <Donut title={t("Kategoriye göre ciro")} slices={foldSlices(byCat, 6)} />
        <Donut title={t("Personele göre ciro")} slices={foldSlices(byStaff, 6)} />
        <Donut title={t("Gider dağılımı")} slices={foldSlices(byExp.map((e, i) => ({ ...e, color: SERIES[(i + 1) % SERIES.length] })), 6)} empty={t("Bu dönemde gider yok")} />
      </div>

      <section className="panel grid gap-2">
        <h2 className="font-bold">{t("En çok ciro getiren hizmetler")}</h2>
        {!topServices.length ? <p className="text-sm text-muted">{t("Veri yok")}</p> : (
          <div className="grid gap-1">
            {topServices.map((s, i) => (
              <div key={s.label} className="grid grid-cols-[1fr_minmax(60px,180px)_90px] gap-3 items-center text-sm">
                <span className="truncate">{i + 1}. {s.label}</span>
                <span className="h-3 rounded bg-sunk overflow-hidden"><span className="block h-full rounded" style={{ width: `${(s.value / topServices[0].value) * 100}%`, background: SERIES[5] }} /></span>
                <span className="num font-bold text-right">{money(s.value)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 grid gap-1 border ${accent ? "bg-green-soft border-green/30" : "bg-surface border-line"}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-display text-xl num">{value}</b>
      <span className="text-[11px] text-muted truncate">{sub}</span>
    </div>
  );
}
