import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadDay } from "@/lib/queries/calendar";
import { todayIso, fmtDateLong, fmtTime, money, fullName } from "@/lib/format";

export const metadata = { title: "Bugün" };

export default async function TodayPage() {
  const { supabase, profile } = await requireSession();
  const d = todayIso();
  const day = await loadDay(supabase, d);
  const active = day.items.filter((i) => i.status !== "cancelled");
  const visits = new Map<string, typeof active>();
  for (const i of active) visits.set(i.visit_id, [...(visits.get(i.visit_id) ?? []), i]);
  const expected = active.reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
  const done = active.filter((i) => i.status === "completed").reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
  const [{ count: newReq }, { count: customers }] = await Promise.all([
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="grid gap-4">
      <header>
        <p className="eyebrow">Hoş geldin{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</p>
        <h1 className="text-2xl font-bold capitalize">{fmtDateLong(d)}</h1>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Bugünkü ziyaret" value={String(visits.size)} sub={`${active.length} hizmet kalemi`} />
        <Kpi label="Beklenen ciro" value={money(expected)} sub={`${money(done)} tamamlandı`} />
        <Kpi label="Online talep" value={String(newReq ?? 0)} sub="onay bekliyor" href="/panel/online" warn={(newReq ?? 0) > 0} />
        <Kpi label="Müşteri" value={String(customers ?? 0)} sub="kayıtlı" href="/panel/musteriler" />
      </div>
      <section className="panel grid gap-3">
        <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Bugünün akışı</h2><Link className="text-sm text-green font-semibold" href="/panel/takvim">Takvimi aç →</Link></div>
        {!active.length && <p className="text-muted text-sm">Bugün için randevu yok.</p>}
        <div className="grid gap-2">
          {[...visits.values()]
            .sort((a, b) => a[0].starts_at.localeCompare(b[0].starts_at))
            .map((items) => {
              const v = items[0].visit; const c = v.customer;
              const tot = items.reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
              const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
              return (
                <div key={v.id} className="grid grid-cols-[auto_1fr_auto] gap-3 items-start rounded-xl bg-sunk px-3 py-2">
                  <div className="num font-bold">{fmtTime(sorted[0].starts_at)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c ? fullName(c) : "Müşterisiz"} {items.length > 1 && <span className="pill gold ml-1">{items.length} hizmet</span>}</div>
                    <div className="text-xs text-muted truncate">{sorted.map((i) => `${fmtTime(i.starts_at)} ${i.service_name} (${day.staff.find((s) => s.id === i.staff_id)?.full_name.split(" ")[0] ?? "—"})`).join(" · ")}</div>
                  </div>
                  <div className="num font-bold">{money(tot)}</div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, href, warn }: { label: string; value: string; sub: string; href?: string; warn?: boolean }) {
  const inner = (
    <div className={`rounded-xl p-3 grid gap-1 ${warn ? "bg-warn-bg" : "bg-surface border border-line"}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-display text-2xl num">{value}</b>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
