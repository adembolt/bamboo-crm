import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fullName, money } from "@/lib/format";
import { saveLoyalty } from "./actions";

export async function generateMetadata() { return { title: (await getT())("Sadakat programı") }; }

export default async function LoyaltyPage() {
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  type L = { points: number; reason: string; created_at: string; customer: { id: string; first_name: string; last_name: string } | null };
  const [{ data: s }, { data: top }, { data: ledger }, { count }] = await Promise.all([
    supabase.from("settings").select("loyalty_earn_percent, loyalty_point_value, package_default_months").eq("id", 1).single(),
    supabase.from("customers").select("id, first_name, last_name, phone, loyalty_points").gt("loyalty_points", 0).order("loyalty_points", { ascending: false }).limit(25),
    supabase.from("loyalty_ledger").select("points, reason, created_at, customer:customers(id, first_name, last_name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("customers").select("id", { count: "exact", head: true }).gt("loyalty_points", 0),
  ]);
  const earn = Number(s?.loyalty_earn_percent ?? 0), val = Number(s?.loyalty_point_value ?? 1);
  const totalPts = (top ?? []).reduce((a, c) => a + c.loyalty_points, 0);
  return (
    <div className="grid gap-4 max-w-4xl">
      <h1 className="text-xl font-bold">{t("Sadakat programı")}</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="panel"><div className="text-xs text-muted">{t("Durum")}</div><b className={earn > 0 ? "text-good" : "text-muted"}>{earn > 0 ? t("Açık") : t("Kapalı")}</b><div className="text-xs text-muted">{earn > 0 ? t("Her 100 ₺ harcamaya {n} puan", { n: earn }) : t("Puan kazanım yüzdesi 0")}</div></div>
        <div className="panel"><div className="text-xs text-muted">{t("Puanı olan müşteri")}</div><b className="num text-xl">{count ?? 0}</b></div>
        <div className="panel"><div className="text-xs text-muted">{t("İlk 25 müşterideki puan")}</div><b className="num text-xl">{totalPts}</b><div className="text-xs text-muted">≈ {money(totalPts * val)}</div></div>
      </div>
      <form action={saveLoyalty} className="panel grid gap-3">
        <h2 className="font-bold">{t("Kurallar")}</h2>
        <fieldset disabled={!isManager} className="grid sm:grid-cols-3 gap-3">
          <label className="f">{t("Puan kazanım yüzdesi (0 = kapalı)")}<span className="inp"><input name="loyalty_earn_percent" defaultValue={String(earn)} inputMode="decimal" /></span></label>
          <label className="f">{t("1 puan = kaç ₺")}<span className="inp"><input name="loyalty_point_value" defaultValue={String(val)} inputMode="decimal" /></span></label>
          <label className="f">{t("Paket geçerlilik (ay)")}<span className="inp"><input name="package_default_months" defaultValue={String(s?.package_default_months ?? 6)} inputMode="numeric" /></span></label>
        </fieldset>
        <p className="text-xs text-muted">{t("Puanlar ödeme alınırken kendiliğinden yazılır; kasada “Puan” ödeme yöntemiyle harcanır. Bir müşterinin puanını müşteri kartından düzeltebilirsiniz.")}</p>
        {isManager && <button className="btn justify-self-start">{t("Kaydet")}</button>}
      </form>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="panel grid gap-1">
          <h2 className="font-bold mb-1">{t("En çok puanı olanlar")}</h2>
          {!(top ?? []).length && <p className="text-sm text-muted">{t("Henüz puanı olan müşteri yok.")}</p>}
          {(top ?? []).map((c) => (
            <Link key={c.id} href={`/panel/musteriler/${c.id}`} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1 hover:bg-sunk">
              <span className="truncate flex-1">{fullName(c)}</span><b className="num">★ {c.loyalty_points}</b><span className="num text-xs text-muted w-20 text-right">{money(c.loyalty_points * val)}</span>
            </Link>
          ))}
        </section>
        <section className="panel grid gap-1">
          <h2 className="font-bold mb-1">{t("Son puan hareketleri")}</h2>
          {!(ledger ?? []).length && <p className="text-sm text-muted">{t("Hareket yok.")}</p>}
          {((ledger ?? []) as unknown as L[]).map((l, i) => (
            <div key={i} className="grid grid-cols-[70px_1fr_auto] gap-2 text-sm items-center">
              <span className="num text-xs text-muted">{fmtDate(l.created_at.slice(0, 10))}</span>
              <span className="truncate">{l.customer ? <Link className="hover:underline" href={`/panel/musteriler/${l.customer.id}`}>{fullName(l.customer)}</Link> : "—"}<span className="text-muted"> · {l.reason}</span></span>
              <b className={`num ${l.points > 0 ? "text-good" : "text-bad"}`}>{l.points > 0 ? "+" : ""}{l.points}</b>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
