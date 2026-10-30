import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { loadDay } from "@/lib/queries/calendar";
import { todayIso, fmtDateLong, fmtTime, money, fullName, addDays, fmtDate, fmtWeekdayShort } from "@/lib/format";
import { getT, getLang } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Bugün") };
}

export default async function TodayPage() {
  const { supabase, profile } = await requireSession();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const d = todayIso();
  const day = await loadDay(supabase, d);
  const active = day.items.filter((i) => i.status !== "cancelled");
  const visits = new Map<string, typeof active>();
  for (const i of active) visits.set(i.visit_id, [...(visits.get(i.visit_id) ?? []), i]);
  const expected = active.reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
  const done = active.filter((i) => i.status === "completed").reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
  const tomorrow = addDays(d, 1), week7 = addDays(d, 6);
  const monthStart = d.slice(0, 8) + "01";
  const prevMonthStart = addDays(monthStart, -1).slice(0, 8) + "01";
  const prevSameDay = addDays(prevMonthStart, Number(d.slice(8)) - 1);
  const [{ count: newReq }, { count: customers }, { data: tmr }, { data: unpaid }, { count: bdays }, { count: lost }, { data: prods }, { data: weekV }, { data: monthSales }, { data: prevSales }, { count: lowReviews }] = await Promise.all([
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("visits").select("id, message_log(kind)").eq("visit_date", tomorrow).in("status", ["pending", "confirmed"]),
    supabase.from("visits").select("id, visit_date, customer:customers(first_name, last_name), sales(id), items:visit_items(price, discount, status)").lt("visit_date", d).gte("visit_date", addDays(d, -60)).in("status", ["pending", "confirmed", "arrived"]).order("visit_date", { ascending: false }).limit(50),
    supabase.from("customer_list").select("id", { count: "exact", head: true }).lte("bday_in", 7),
    supabase.from("customer_list").select("id", { count: "exact", head: true }).lt("last_visit", addDays(d, -60)).gte("last_visit", addDays(d, -365)).is("next_visit", null),
    supabase.from("products").select("id, stock_qty, min_stock").eq("is_active", true).gt("min_stock", 0),
    supabase.from("visits").select("visit_date, items:visit_items(price, discount, status)").gte("visit_date", d).lte("visit_date", week7).neq("status", "cancelled"),
    supabase.from("sales").select("total").gte("sale_date", monthStart).lte("sale_date", d),
    supabase.from("sales").select("total").gte("sale_date", prevMonthStart).lte("sale_date", prevSameDay),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("source", "salon").lte("rating", 3).eq("handled", false),
  ]);
  const remindersDue = (tmr ?? []).filter((v) => !([] as { kind: string }[]).concat((v.message_log as unknown as { kind: string }[] | null) ?? []).some((m) => m.kind === "reminder")).length;
  const hasAny = (x: unknown) => (Array.isArray(x) ? x.length > 0 : !!x);
  const unpaidList = (unpaid ?? []).filter((v) => !hasAny(v.sales) && v.items.some((i) => i.status !== "cancelled"));
  const lowStock = (prods ?? []).filter((p) => Number(p.stock_qty) <= Number(p.min_stock)).length;
  const monthTotal = (monthSales ?? []).reduce((a, x) => a + Number(x.total), 0);
  const prevTotal = (prevSales ?? []).reduce((a, x) => a + Number(x.total), 0);
  const trend = prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(d, i)).map((dd) => {
    const vs = (weekV ?? []).filter((v) => v.visit_date === dd);
    const amount = vs.reduce((a, v) => a + v.items.filter((i) => i.status !== "cancelled").reduce((b, i) => b + Number(i.price) - Number(i.discount), 0), 0);
    return { date: dd, n: vs.length, amount };
  });
  const maxN = Math.max(1, ...days.map((x) => x.n));
  const todos = [
    lowReviews ? { icon: "★", text: t("{n} düşük puanlı değerlendirme ilgilenmenizi bekliyor", { n: lowReviews }), href: "/panel/musteriler/yorumlar?f=low", urgent: true } : null,
    newReq ? { icon: "⇅", text: t("{n} online randevu talebi onay bekliyor", { n: newReq }), href: "/panel/online", urgent: true } : null,
    remindersDue ? { icon: "✉", text: t("Yarın için {n} hatırlatma mesajı gönderilmedi", { n: remindersDue }), href: `/panel/mesajlar?k=reminder&d=${tomorrow}`, urgent: true } : null,
    unpaidList.length ? { icon: "₺", text: t("{n} geçmiş ziyaretin ödemesi alınmamış", { n: unpaidList.length }), href: `/panel/kasa?d=${unpaidList[0].visit_date}`, urgent: true } : null,
    bdays ? { icon: "🎂", text: t("7 gün içinde {n} müşterinin doğum günü", { n: bdays }), href: "/panel/mesajlar?k=birthday", urgent: false } : null,
    lowStock ? { icon: "▤", text: t("{n} üründe stok kritik seviyede", { n: lowStock }), href: "/panel/urunler?f=low", urgent: false } : null,
    lost ? { icon: "↺", text: t("{n} müşteri 60 günden uzun süredir gelmedi", { n: lost }), href: "/panel/musteriler?f=lost", urgent: false } : null,
  ].filter(Boolean) as { icon: string; text: string; href: string; urgent: boolean }[];

  return (
    <div className="grid gap-4">
      <header>
        <p className="eyebrow">{profile?.full_name ? t("Hoş geldin, {name}", { name: profile.full_name.split(" ")[0] }) : t("Hoş geldin")}</p>
        <h1 className="text-2xl font-bold">{fmtDateLong(d, lang)}</h1>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={t("Bugünkü ziyaret")} value={String(visits.size)} sub={t("{n} hizmet kalemi", { n: active.length })} />
        <Kpi label={t("Beklenen ciro")} value={money(expected)} sub={t("{amount} tamamlandı", { amount: money(done) })} />
        <Kpi label={t("Online talep")} value={String(newReq ?? 0)} sub={t("onay bekliyor")} href="/panel/online" warn={(newReq ?? 0) > 0} />
        <Kpi label={t("Bu ay ciro")} value={money(monthTotal)} sub={trend === null ? t("{n} kayıtlı müşteri", { n: customers ?? 0 }) : t("geçen ayın aynı dönemine göre {p}", { p: `${trend >= 0 ? "+" : ""}${trend}%` })} href="/panel/kasa/rapor" />
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
        <section className="panel grid gap-2">
          <h2 className="text-lg font-bold">{t("Yapılacaklar")}</h2>
          {!todos.length && <p className="text-sm text-muted">✓ {t("Her şey yolunda, bekleyen iş yok.")}</p>}
          {todos.map((x) => (
            <Link key={x.href} href={x.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 hover:brightness-95 ${x.urgent ? "bg-warn-bg" : "bg-sunk"}`}>
              <span className="w-6 text-center" aria-hidden>{x.icon}</span><span className="flex-1 text-sm font-semibold">{x.text}</span><span className="text-muted">→</span>
            </Link>
          ))}
          {unpaidList.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">{t("Ödemesi alınmamış ziyaretler")}</summary>
              <ul className="grid gap-1 mt-2">
                {unpaidList.slice(0, 8).map((v) => (
                  <li key={v.id}><Link className="flex justify-between gap-2 hover:underline" href={`/panel/kasa?d=${v.visit_date}`}><span className="truncate">{fmtDate(v.visit_date)} · {v.customer ? `${v.customer.first_name} ${v.customer.last_name}` : t("Müşterisiz")}</span><span className="num">{money(v.items.filter((i) => i.status !== "cancelled").reduce((a, i) => a + Number(i.price) - Number(i.discount), 0))}</span></Link></li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <section className="panel grid gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t("Önümüzdeki 7 gün")}</h2><Link className="text-sm text-green font-semibold" href="/panel/takvim?v=week">{t("Haftayı aç →")}</Link></div>
          <div className="grid gap-1.5">
            {days.map((x) => (
              <Link key={x.date} href={`/panel/takvim?d=${x.date}`} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-lg px-2 py-1 hover:bg-sunk">
                <span className={`text-sm num ${x.date === d ? "font-bold text-green" : ""}`}>{fmtWeekdayShort(x.date, lang)} {x.date.slice(8)}.{x.date.slice(5, 7)}</span>
                <span className="h-2.5 rounded-full bg-sunk overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(x.n / maxN) * 100}%`, background: "var(--green)" }} /></span>
                <span className="text-xs text-muted num whitespace-nowrap">{t("{n} randevu", { n: x.n })}{x.amount > 0 ? ` · ${money(x.amount)}` : ""}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="panel grid gap-3">
        <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t("Bugünün akışı")}</h2><Link className="text-sm text-green font-semibold" href="/panel/takvim">{t("Takvimi aç →")}</Link></div>
        {!active.length && <p className="text-muted text-sm">{t("Bugün için randevu yok.")}</p>}
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
                    <div className="font-semibold truncate">{c ? fullName(c) : t("Müşterisiz")} {items.length > 1 && <span className="pill gold ml-1">{t("{n} hizmet", { n: items.length })}</span>}</div>
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
