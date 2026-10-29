import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadKasaDay, summarize } from "@/lib/queries/kasa";
import { computePayroll } from "@/lib/payroll";
import { todayIso, addDays, fmtDateLong, money } from "@/lib/format";
import { KasaDay } from "./kasa-day";
import { getT, getLang } from "@/lib/i18n/server";

export async function generateMetadata() { return { title: (await getT())("Kasa") }; }

export default async function KasaPage({ searchParams }: PageProps<"/panel/kasa">) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayIso();
  const { supabase, profile } = await requireSession();
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const [day, earn] = await Promise.all([loadKasaDay(supabase, d), computePayroll(supabase, d, d)]);
  const [t, lang] = [await getT(), await getLang()];
  const sum = summarize(day.visits, day.expenses, Number(day.settings.kdv_rate), day.otherSales);

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href={`/panel/kasa?d=${addDays(d, -1)}`} aria-label={t("Önceki gün")}>‹</Link>
        <h1 className="text-xl font-bold">{fmtDateLong(d, lang)}</h1>
        <Link className="btn ghost sm" href={`/panel/kasa?d=${addDays(d, 1)}`} aria-label={t("Sonraki gün")}>›</Link>
        {d !== todayIso() && <Link className="btn ghost sm" href="/panel/kasa">{t("Bugün")}</Link>}
        {isManager ? <Link className="btn ghost sm ml-auto" href="/panel/kasa/hesaplar">{t("Kasa ve banka")}</Link> : null}
        <Link className={`btn ghost sm${isManager ? "" : " ml-auto"}`} href="/panel/kasa/hediye">{t("Hediye çekleri")}</Link>
        <Link className="btn ghost sm" href={`/panel/kasa/rapor?p=day&from=${d}`}>{t("Grafikler")}</Link>
        <Link className="btn ghost sm" href={`/panel/kasa/ay?m=${d.slice(0, 7)}`}>{t("Ay özeti →")}</Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label={t("Günün cirosu")} value={money(sum.gross)} sub={t("KDV {kdv} · net {net}", { kdv: money(sum.kdv), net: money(sum.net) })} accent />
        <Kpi label={t("Nakit")} value={money(sum.byMethod.cash ?? 0)} sub={t("kasada {amount}", { amount: money(sum.cashNet) })} />
        <Kpi label={t("Kart")} value={money(sum.byMethod.card ?? 0)} sub={t("havale {amount}", { amount: money(sum.byMethod.transfer ?? 0) })} />
        <Kpi label={t("Bekleyen")} value={money(sum.expected)} sub={t("{n} açık ziyaret", { n: day.visits.filter((v) => !v.sale).length })} warn={sum.expected > 0} />
        <Kpi label={t("Gider")} value={money(sum.expenses)} sub={`${t("{n} kayıt", { n: day.expenses.length })}${(sum.byMethod.gift_card || sum.byMethod.points) ? ` · ${t("çek/puan {amount}", { amount: money((sum.byMethod.gift_card ?? 0) + (sum.byMethod.points ?? 0)) })}` : ""}`} />
      </div>

      <KasaDay
        date={d}
        visits={day.visits}
        otherSales={day.otherSales}
        expenses={day.expenses.map((e) => ({ ...e, staff_name: e.staff?.full_name ?? null }))}
        staff={day.staff}
        earnings={Object.fromEntries([...earn.entries()].filter(([, e]) => e.total > 0 || e.serviceSales + e.productSales > 0).map(([id, e]) => [id, { sales: e.serviceSales + e.productSales, pay: e.total, detail: [e.own && `${t("kendi")} ${money(e.own)}`, e.company && `${t("şirket")} ${money(e.company)}`, e.booking && `${t("randevu primi")} ${money(e.booking)}`, e.fixed && `${t("günlük")} ${money(e.fixed)}`, e.guarantee && `${t("garanti farkı")} ${money(e.guarantee)}`].filter(Boolean).join(" · ") }]))}
        canWrite={canWrite}
        isManager={isManager}
      />
    </div>
  );
}

function Kpi({ label, value, sub, accent, warn }: { label: string; value: string; sub: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-3 grid gap-1 border ${accent ? "bg-green-soft border-green/30" : warn ? "bg-warn-bg border-warn/30" : "bg-surface border-line"}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-display text-xl num">{value}</b>
      <span className="text-[11px] text-muted truncate">{sub}</span>
    </div>
  );
}
