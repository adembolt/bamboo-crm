import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fullName, money, todayIso } from "@/lib/format";
import { TemplatesPanel, SellAnyCustomer } from "./templates";

export async function generateMetadata() { return { title: (await getT())("Paketler") }; }

type Sold = { id: string; name: string; total_sessions: number; used_sessions: number; price_paid: number; purchased_at: string; expires_at: string | null; is_active: boolean; customer: { id: string; first_name: string; last_name: string; phone: string } | null };

export default async function PackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = sp.tab === "satilan" ? "satilan" : "sablonlar";
  const filter = typeof sp.f === "string" ? sp.f : "aktif";
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const today = todayIso();

  const [{ data: tpls }, { data: services }, { data: staff }, { data: settings }, soldRes] = await Promise.all([
    supabase.from("package_templates").select("*").order("is_active", { ascending: false }).order("sort_order").order("name"),
    supabase.from("services").select("id, name_tr, price, session_count, kind").eq("is_active", true).order("sort_order"),
    supabase.from("staff").select("id, full_name").eq("is_active", true).order("sort_order"),
    supabase.from("settings").select("package_default_months").eq("id", 1).single(),
    tab === "satilan" ? supabase.from("customer_packages").select("id, name, total_sessions, used_sessions, price_paid, purchased_at, expires_at, is_active, customer:customers(id, first_name, last_name, phone)").order("purchased_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
  ]);
  const sold = (soldRes.data ?? []) as unknown as Sold[];
  const state = (p: Sold) => (!p.is_active ? "pasif" : p.used_sessions >= p.total_sessions ? "bitti" : p.expires_at && p.expires_at < today ? "suresi" : "aktif");
  const counts = { aktif: 0, bitti: 0, suresi: 0, pasif: 0 } as Record<string, number>;
  for (const p of sold) counts[state(p)]++;
  const shown = filter === "tumu" ? sold : sold.filter((p) => state(p) === filter);
  const label: Record<string, string> = { aktif: "Aktif", suresi: "Süresi dolmuş", bitti: "Seansları bitti", pasif: "Pasif", tumu: "Tümü" };
  const tplList = (tpls ?? []).map((x) => ({ ...x, price: Number(x.price) }));
  const svcList = (services ?? []).map((s) => ({ ...s, price: Number(s.price) }));

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Paketler")}</h1>
        <div className="flex gap-1 bg-sunk p-1 rounded-lg">
          <Link href="/panel/musteriler/paketler" className={`px-3 py-1 rounded-md text-sm font-semibold ${tab === "sablonlar" ? "bg-surface shadow-card" : "text-muted"}`}>{t("Şablonlar")}</Link>
          <Link href="/panel/musteriler/paketler?tab=satilan" className={`px-3 py-1 rounded-md text-sm font-semibold ${tab === "satilan" ? "bg-surface shadow-card" : "text-muted"}`}>{t("Satılan paketler")}</Link>
        </div>
        {canWrite && <span className="ml-auto"><SellAnyCustomer templates={tplList.filter((x) => x.is_active)} services={svcList} staff={staff ?? []} defaultMonths={settings?.package_default_months ?? 6} /></span>}
      </header>

      {tab === "sablonlar" ? (
        <TemplatesPanel templates={tplList} services={svcList} isManager={isManager} />
      ) : (
        <section className="panel grid gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {["aktif", "suresi", "bitti", "pasif", "tumu"].map((k) => (
              <Link key={k} href={`/panel/musteriler/paketler?tab=satilan&f=${k}`} className={`pill ${filter === k ? "good" : ""}`}>{t(label[k])} {k === "tumu" ? sold.length : counts[k]}</Link>
            ))}
          </div>
          {!shown.length && <p className="text-sm text-muted">{t("Bu listede paket yok.")}</p>}
          <div className="grid gap-1">
            {shown.map((p) => (
              <Link key={p.id} href={p.customer ? `/panel/musteriler/${p.customer.id}` : "#"} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_90px_120px_100px] gap-x-3 gap-y-0.5 items-center rounded-lg px-2 py-2 hover:bg-sunk text-sm border-b border-dashed border-line">
                <span className="font-semibold truncate">{p.customer ? fullName(p.customer) : t("Müşteri yok")}</span>
                <span className="truncate text-muted sm:text-ink">{p.name}</span>
                <span className="num font-bold">{p.used_sessions}/{p.total_sessions} <span className="text-xs text-muted font-normal">{t("kalan {n}", { n: Math.max(0, p.total_sessions - p.used_sessions) })}</span></span>
                <span className="num text-xs text-muted">{fmtDate(p.purchased_at)}{p.expires_at ? ` → ${fmtDate(p.expires_at)}` : ""}</span>
                <span className="num text-right">{money(Number(p.price_paid))}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
