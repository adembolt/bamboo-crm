import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadKasaDay, summarize, staffEarnings } from "@/lib/queries/kasa";
import { todayIso, addDays, fmtDateLong, money } from "@/lib/format";
import { KasaDay } from "./kasa-day";

export const metadata = { title: "Kasa" };

export default async function KasaPage({ searchParams }: PageProps<"/panel/kasa">) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayIso();
  const { supabase, profile } = await requireSession();
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const [day, earn] = await Promise.all([loadKasaDay(supabase, d), staffEarnings(supabase, d, d)]);
  const sum = summarize(day.visits, day.expenses, Number(day.settings.kdv_rate));

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href={`/panel/kasa?d=${addDays(d, -1)}`} aria-label="Önceki gün">‹</Link>
        <h1 className="text-xl font-bold capitalize">{fmtDateLong(d)}</h1>
        <Link className="btn ghost sm" href={`/panel/kasa?d=${addDays(d, 1)}`} aria-label="Sonraki gün">›</Link>
        {d !== todayIso() && <Link className="btn ghost sm" href="/panel/kasa">Bugün</Link>}
        <Link className="btn ghost sm ml-auto" href={`/panel/kasa/ay?m=${d.slice(0, 7)}`}>Ay özeti →</Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Günün cirosu" value={money(sum.gross)} sub={`KDV ${money(sum.kdv)} · net ${money(sum.net)}`} accent />
        <Kpi label="Nakit" value={money(sum.byMethod.cash ?? 0)} sub={`kasada ${money(sum.cashNet)}`} />
        <Kpi label="Kart" value={money(sum.byMethod.card ?? 0)} sub={`havale ${money(sum.byMethod.transfer ?? 0)}`} />
        <Kpi label="Bekleyen" value={money(sum.expected)} sub={`${day.visits.filter((v) => !v.sale).length} açık ziyaret`} warn={sum.expected > 0} />
        <Kpi label="Gider" value={money(sum.expenses)} sub={`${day.expenses.length} kayıt`} />
      </div>

      <KasaDay
        date={d}
        visits={day.visits}
        expenses={day.expenses.map((e) => ({ ...e, staff_name: e.staff?.full_name ?? null }))}
        staff={day.staff}
        earnings={Object.fromEntries([...earn.entries()])}
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
