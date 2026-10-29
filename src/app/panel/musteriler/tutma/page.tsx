import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT, getLang } from "@/lib/i18n/server";
import { fmtMonthYear, todayIso, fullName } from "@/lib/format";

export async function generateMetadata() { return { title: (await getT())("Müşteri tutma") }; }

const shift = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
const endOf = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/* DIKIDI "Retention" gibi: önceki dönemde gelen müşterilerin kaçı bu dönemde geri geldi, kaçı kayıp; yeni müşteriler; uzman bazında */
export default async function RetentionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const len = sp.p === "q" ? 3 : sp.p === "h" ? 6 : 1;
  const endM = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : todayIso().slice(0, 7);
  const curFrom = `${shift(endM, -(len - 1))}-01`, curTo = endOf(endM);
  const prevFrom = `${shift(endM, -(2 * len - 1))}-01`, prevTo = endOf(shift(endM, -len));
  const { supabase } = await requireSession();
  const [t, lang] = [await getT(), await getLang()];

  type V = { customer_id: string; visit_date: string; items: { staff_id: string | null; status: string }[] };
  const all: V[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await supabase.from("visits").select("customer_id, visit_date, items:visit_items(staff_id, status)").in("status", ["completed", "arrived"]).not("customer_id", "is", null).lte("visit_date", curTo).order("visit_date").range(from, from + 999);
    all.push(...((data ?? []) as unknown as V[])); if (!data || data.length < 1000) break;
  }
  const { data: staff } = await supabase.from("staff").select("id, full_name, color").eq("is_active", true).order("sort_order");
  const first = new Map<string, string>();
  for (const v of all) if (!first.has(v.customer_id)) first.set(v.customer_id, v.visit_date);
  const inPrev = all.filter((v) => v.visit_date >= prevFrom && v.visit_date <= prevTo);
  const inCur = all.filter((v) => v.visit_date >= curFrom && v.visit_date <= curTo);
  const prevSet = new Set(inPrev.map((v) => v.customer_id)), curSet = new Set(inCur.map((v) => v.customer_id));
  const returned = [...prevSet].filter((c) => curSet.has(c));
  const lost = [...prevSet].filter((c) => !curSet.has(c));
  const fresh = [...curSet].filter((c) => (first.get(c) ?? "") >= curFrom);
  // yeni müşterinin ikinci kez gelmesi (dönem içinde)
  const curCount = new Map<string, number>(); for (const v of inCur) curCount.set(v.customer_id, (curCount.get(v.customer_id) ?? 0) + 1);
  const freshRepeat = fresh.filter((c) => (curCount.get(c) ?? 0) > 1);

  const staffRows = (staff ?? []).map((s) => {
    const served = new Set(inPrev.filter((v) => v.items.some((i) => i.staff_id === s.id && i.status !== "cancelled")).map((v) => v.customer_id));
    const back = [...served].filter((c) => curSet.has(c));
    const backSame = [...served].filter((c) => inCur.some((v) => v.customer_id === c && v.items.some((i) => i.staff_id === s.id)));
    const newHere = new Set(inCur.filter((v) => (first.get(v.customer_id) ?? "") >= curFrom && v.items.some((i) => i.staff_id === s.id)).map((v) => v.customer_id));
    return { s, served: served.size, back: back.length, backSame: backSame.length, lost: served.size - back.length, newHere: newHere.size };
  }).filter((r) => r.served || r.newHere);

  const { data: lostCs } = lost.length ? await supabase.from("customers").select("id, first_name, last_name, phone").in("id", lost.slice(0, 300)) : { data: [] };
  const lastVisit = new Map<string, string>(); for (const v of inPrev) lastVisit.set(v.customer_id, v.visit_date);
  const lostList = (lostCs ?? []).sort((a, b) => (lastVisit.get(b.id) ?? "").localeCompare(lastVisit.get(a.id) ?? "")).slice(0, 60);
  const label = (from: string, to: string) => len === 1 ? fmtMonthYear(from, lang) : `${fmtMonthYear(from, lang)} – ${fmtMonthYear(to, lang)}`;
  const q = (p: string, m: string) => `/panel/musteriler/tutma?p=${p}&m=${m}`;
  const pKey = len === 3 ? "q" : len === 6 ? "h" : "m";

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/musteriler">‹</Link>
        <h1 className="text-xl font-bold">{t("Müşteri tutma")}</h1>
        <nav className="flex gap-1 bg-sunk p-1 rounded-lg">
          {([["m", "Ay"], ["q", "3 ay"], ["h", "6 ay"]] as const).map(([k, l]) => <Link key={k} href={q(k, endM)} className={`px-3 py-1 rounded-md text-sm font-semibold ${pKey === k ? "bg-surface shadow-card" : "text-muted"}`}>{t(l)}</Link>)}
        </nav>
        <span className="flex items-center gap-1 ml-auto"><Link className="btn ghost sm" href={q(pKey, shift(endM, -len))}>‹</Link><b className="min-w-[150px] text-center text-sm">{label(curFrom, curTo)}</b><Link className="btn ghost sm" href={q(pKey, shift(endM, len))}>›</Link></span>
      </header>
      <p className="text-sm text-muted">{t("Önceki dönem ({p}) gelen müşterilerin bu dönemde ({c}) kaçının tekrar geldiği.", { p: label(prevFrom, prevTo), c: label(curFrom, curTo) })}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={t("Önceki dönem müşterisi")} value={String(prevSet.size)} sub={t("{n} bu dönem", { n: curSet.size })} />
        <Kpi label={t("Geri gelen")} value={`${returned.length}`} sub={`%${pct(returned.length, prevSet.size)}`} good />
        <Kpi label={t("Kaybedilen")} value={`${lost.length}`} sub={`%${pct(lost.length, prevSet.size)}`} warn={lost.length > 0} />
        <Kpi label={t("Yeni müşteri")} value={`${fresh.length}`} sub={t("{n} tanesi dönemde 2+ kez geldi", { n: freshRepeat.length })} />
      </div>
      <section className="panel overflow-x-auto">
        <h2 className="font-bold mb-2">{t("Uzman bazında")}</h2>
        <table className="w-full text-sm min-w-[600px]">
          <thead className="text-[11px] uppercase tracking-wide text-muted bg-sunk"><tr><th className="text-left px-3 py-2">{t("Uzman")}</th><th className="text-right px-3 py-2">{t("Önceki dönem")}</th><th className="text-right px-3 py-2">{t("Geri gelen")}</th><th className="text-right px-3 py-2">{t("Aynı uzmana")}</th><th className="text-right px-3 py-2">{t("Kaybedilen")}</th><th className="text-right px-3 py-2">{t("Yeni")}</th></tr></thead>
          <tbody className="divide-y divide-line">
            {staffRows.map((r) => (
              <tr key={r.s.id}>
                <td className="px-3 py-2"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: r.s.color }} /><b>{r.s.full_name}</b></td>
                <td className="px-3 py-2 text-right num">{r.served}</td>
                <td className="px-3 py-2 text-right num">{r.back} <span className="text-muted">%{pct(r.back, r.served)}</span></td>
                <td className="px-3 py-2 text-right num">{r.backSame} <span className="text-muted">%{pct(r.backSame, r.served)}</span></td>
                <td className="px-3 py-2 text-right num text-warn">{r.lost}</td>
                <td className="px-3 py-2 text-right num">{r.newHere}</td>
              </tr>
            ))}
            {!staffRows.length && <tr><td colSpan={6} className="px-3 py-3 text-muted">{t("Bu dönem için veri yok.")}</td></tr>}
          </tbody>
        </table>
      </section>
      <section className="panel grid gap-1">
        <div className="flex items-center gap-2"><h2 className="font-bold">{t("Kaybedilen müşteriler")}</h2><Link className="btn ghost sm ml-auto" href="/panel/mesajlar?k=winback">{t("Geri kazanım mesajları")} →</Link></div>
        {lostList.map((c) => (
          <Link key={c.id} href={`/panel/musteriler/${c.id}`} className="grid grid-cols-[1fr_auto] gap-2 text-sm border-b border-dashed border-line py-1 hover:bg-sunk rounded px-1">
            <span><b>{fullName(c)}</b> <span className="text-muted">{c.phone}</span></span>
            <span className="text-muted text-xs">{t("son")}: {lastVisit.get(c.id)}</span>
          </Link>
        ))}
        {!lostList.length && <p className="text-sm text-muted">{t("Kayıp yok.")}</p>}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, good, warn }: { label: string; value: string; sub: string; good?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-3 grid gap-1 border ${good ? "bg-green-soft border-green/30" : warn ? "bg-warn-bg border-warn/30" : "bg-surface border-line"}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-display text-xl num">{value}</b>
      <span className="text-[11px] text-muted">{sub}</span>
    </div>
  );
}
