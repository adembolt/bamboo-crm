import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fullName, money } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";
import { TipForm, DeleteTip } from "./tip-ui";

export async function generateMetadata() { return { title: (await getT())("Bahşişler") }; }
const METHOD: Record<string, string> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online" };

export default async function TipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "month");
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  type Tip = { id: string; tip_date: string; staff_id: string; amount: number; method: string; to_payroll: boolean; note: string; customer: { id: string; first_name: string; last_name: string } | null };
  const [{ data: staff }, { data: tips }] = await Promise.all([
    supabase.from("staff").select("id, full_name").eq("is_active", true).order("sort_order"),
    supabase.from("tips").select("id, tip_date, staff_id, amount, method, to_payroll, note, customer:customers(id, first_name, last_name)").gte("tip_date", period.from).lte("tip_date", period.to).order("tip_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const list = (tips ?? []) as unknown as Tip[];
  const name = (id: string) => staff?.find((s) => s.id === id)?.full_name ?? "—";
  const per = new Map<string, { total: number; payroll: number; n: number }>();
  for (const x of list) { const r = per.get(x.staff_id) ?? { total: 0, payroll: 0, n: 0 }; r.total += Number(x.amount); if (x.to_payroll) r.payroll += Number(x.amount); r.n++; per.set(x.staff_id, r); }
  const total = list.reduce((a, x) => a + Number(x.amount), 0);
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-bold">{t("Bahşişler")}</h1>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="grid gap-3">
          <PeriodBar base="/panel/musteriler/bahsisler" period={period} />
          <section className="panel grid gap-1">
            <div className="flex justify-between"><h2 className="font-bold">{t("Personele göre")}</h2><b className="num">{money(total)}</b></div>
            {![...per].length && <p className="text-sm text-muted">{t("Bu dönemde bahşiş yok.")}</p>}
            {[...per].sort((a, b) => b[1].total - a[1].total).map(([sid, r]) => (
              <div key={sid} className="flex justify-between text-sm"><span>{name(sid)} <span className="text-xs text-muted">· {t("{n} kez", { n: r.n })}</span></span><span className="num">{money(r.total)}{r.payroll ? <span className="text-xs text-muted"> · {t("maaşa {amount}", { amount: money(r.payroll) })}</span> : null}</span></div>
            ))}
          </section>
          <section className="panel grid gap-0.5">
            {list.map((x) => (
              <div key={x.id} className="grid grid-cols-[84px_minmax(0,1fr)_auto_auto] gap-x-3 items-center text-sm border-b border-dashed border-line py-1">
                <span className="num text-xs text-muted">{fmtDate(x.tip_date)}</span>
                <span className="min-w-0 truncate"><b>{name(x.staff_id)}</b><span className="text-muted"> · {t(METHOD[x.method] ?? x.method)}{x.to_payroll ? ` · ${t("maaşla ödenecek")}` : ` · ${t("elden verildi")}`}{x.customer ? <> · <Link className="hover:underline" href={`/panel/musteriler/${x.customer.id}`}>{fullName(x.customer)}</Link></> : null}{x.note ? ` · ${x.note}` : ""}</span></span>
                <b className="num">{money(x.amount)}</b>
                {isManager ? <DeleteTip id={x.id} /> : <span />}
              </div>
            ))}
          </section>
        </div>
        {canWrite && <TipForm staff={staff ?? []} />}
      </div>
      <p className="text-xs text-muted">{t("“Maaşla ödenecek” işaretli bahşişler salonun kasasına/bankasına girer ve personelin hesaplaşmasına alacak olarak eklenir. Elden verilenler yalnızca kayıt içindir.")}</p>
    </div>
  );
}
