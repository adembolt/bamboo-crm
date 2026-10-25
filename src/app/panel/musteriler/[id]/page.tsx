import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { fullName, initials, fmtDate, fmtTime, money } from "@/lib/format";
import { CustomerEditForm } from "./edit-form";
import type { Customer } from "@/lib/database.types";
import { PackagePanel, BalancePanel } from "./package-sale";

export default async function CustomerPage({ params }: PageProps<"/panel/musteriler/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireSession();
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);

  const [{ data: c }, { data: visits }, { data: packages }, { data: services }, { data: staff }, { data: settings }, { data: ledger }, { data: bledger }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("visits")
      .select("id, visit_date, status, discount_percent, notes, items:visit_items(id, service_name, starts_at, ends_at, price, discount, status, staff:staff(full_name))")
      .eq("customer_id", id)
      .order("visit_date", { ascending: false })
      .limit(60),
    supabase.from("customer_packages").select("*").eq("customer_id", id).order("purchased_at", { ascending: false }),
    supabase.from("services").select("id, name_tr, price, session_count, kind").eq("is_active", true).order("sort_order"),
    supabase.from("staff").select("id, full_name").eq("is_active", true).order("sort_order"),
    supabase.from("settings").select("package_default_months, loyalty_earn_percent").eq("id", 1).single(),
    supabase.from("loyalty_ledger").select("points, reason, created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("balance_ledger").select("amount, reason, created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(8),
  ]);
  if (!c) notFound();
  const customer = c as Customer;

  type V = NonNullable<typeof visits>[number];
  const vis = (visits ?? []) as V[];
  const totals = vis.filter((v) => v.status === "completed").map((v) => {
    const sub = v.items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
    return Math.round(sub * (1 - Number(v.discount_percent) / 100));
  });
  const spent = totals.reduce((a, b) => a + b, 0);
  const lastVisit = vis.find((v) => v.status === "completed")?.visit_date;

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href="/panel/musteriler" className="btn ghost sm">‹</Link>
        <span className="w-12 h-12 rounded-full bg-green-soft text-green grid place-items-center font-bold">{initials(customer.first_name, customer.last_name)}</span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{fullName(customer)}</h1>
          <p className="text-sm text-muted">{customer.phone || "telefon yok"}{customer.email ? ` · ${customer.email}` : ""}</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          {customer.phone && <a className="btn ghost sm" href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
          <Link className="btn sm" href={`/panel/takvim`}>Randevu ver</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Ziyaret" value={String(totals.length)} />
        <Stat label="Toplam harcama" value={money(spent)} />
        <Stat label="Ortalama fiş" value={totals.length ? money(spent / totals.length) : "—"} />
        <Stat label="Son ziyaret" value={lastVisit ? fmtDate(lastVisit) : "—"} />
      </div>

      <div className="grid md:grid-cols-[1fr_1.2fr] gap-4 items-start">
        <section className="panel grid gap-3">
          <h2 className="text-lg font-bold">Müşteri kartı</h2>
          <CustomerEditForm customer={customer} canWrite={canWrite} />
        </section>

        <div className="grid gap-4">
          <BalancePanel customerId={id} balance={Number(customer.balance)} canWrite={canWrite} isManager={isManager} ledger={(bledger ?? []).map((l) => ({ ...l, amount: Number(l.amount) }))} />
          <PackagePanel customerId={id} packages={(packages ?? []).map((p) => ({ ...p, price_paid: Number(p.price_paid) }))} services={(services ?? []).map((s) => ({ ...s, price: Number(s.price) }))} staff={staff ?? []} defaultMonths={settings?.package_default_months ?? 6} canWrite={canWrite} isManager={isManager} points={customer.loyalty_points} />
          {ledger && ledger.length > 0 && (
            <section className="panel grid gap-1">
              <h2 className="font-bold">Puan hareketleri</h2>
              {ledger.map((l, i) => <div key={i} className="text-sm grid grid-cols-[auto_1fr_auto] gap-2"><span className="num text-muted">{fmtDate(l.created_at)}</span><span className="truncate">{l.reason}</span><span className={`num font-semibold ${l.points > 0 ? "text-good" : "text-bad"}`}>{l.points > 0 ? "+" : ""}{l.points}</span></div>)}
            </section>
          )}
          <section className="panel grid gap-2">
            <h2 className="text-lg font-bold">Ziyaret geçmişi</h2>
            {!vis.length && <p className="text-sm text-muted">Henüz ziyaret yok.</p>}
            {vis.map((v) => {
              const items = [...v.items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
              const sub = items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
              return (
                <div key={v.id} className="rounded-xl border border-line px-3 py-2 grid gap-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/panel/takvim?d=${v.visit_date}`} className="font-bold hover:underline">{fmtDate(v.visit_date)}</Link>
                    <span className={`pill ${v.status === "completed" ? "good" : v.status === "no_show" || v.status === "cancelled" ? "bad" : ""}`}>{{ pending: "Onay bekliyor", confirmed: "Onaylı", arrived: "Geldi", completed: "Tamamlandı", no_show: "Gelmedi", cancelled: "İptal" }[v.status]}</span>
                    <span className="ml-auto num font-bold">{money(Math.round(sub * (1 - Number(v.discount_percent) / 100)))}</span>
                  </div>
                  {items.map((i) => (
                    <div key={i.id} className="text-sm grid grid-cols-[auto_1fr_auto] gap-2"><span className="num text-muted">{fmtTime(i.starts_at)}</span><span className="truncate">{i.service_name} <span className="text-muted">· {i.staff?.full_name ?? "—"}</span></span><span className="num">{money(Number(i.price) - Number(i.discount))}</span></div>
                  ))}
                  {v.notes && <p className="text-xs text-muted">{v.notes}</p>}
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface border border-line p-3"><span className="text-xs font-semibold text-muted block">{label}</span><b className="font-display text-xl num">{value}</b></div>;
}
