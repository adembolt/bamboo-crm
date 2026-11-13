import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fullName } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";
import { OfferCard } from "./offer-ui";

export async function generateMetadata() { return { title: (await getT())("Referans programı") }; }

/* DIKIDI "Referral program": öneren müşteriye puan, gelen yeni müşteriye ilk ziyarette indirim */
export default async function ReferralPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "month");
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  type C = { id: string; first_name: string; last_name: string; created_at: string; referrer: { id: string; first_name: string; last_name: string } | null };
  const [{ data: offers }, { data: invited }, { data: rewards }] = await Promise.all([
    supabase.from("referral_offers").select("*").order("created_at"),
    supabase.from("customers").select("id, first_name, last_name, created_at, referrer:customers!customers_referred_by_fkey(id, first_name, last_name)").not("referred_by", "is", null).gte("created_at", `${period.from}T00:00:00+03:00`).lte("created_at", `${period.to}T23:59:59+03:00`).order("created_at", { ascending: false }),
    supabase.from("referral_rewards").select("invitee_id, points, created_at").gte("created_at", `${period.from}T00:00:00+03:00`).lte("created_at", `${period.to}T23:59:59+03:00`),
  ]);
  const list = (invited ?? []) as unknown as C[];
  const referrers = new Set(list.map((c) => c.referrer?.id).filter(Boolean)).size;
  const pts = (rewards ?? []).reduce((a, r) => a + r.points, 0);
  const rewarded = new Set((rewards ?? []).map((r) => r.invitee_id));
  return (
    <div className="grid gap-4 max-w-5xl">
      <h1 className="text-xl font-bold">{t("Referans programı")}</h1>
      <PeriodBar base="/panel/tanitim/referans" period={period} />
      <div className="grid sm:grid-cols-3 gap-3">
        <section className="panel"><div className="text-sm text-muted">{t("Davet edilen")}</div><b className="num text-2xl">{list.length}</b></section>
        <section className="panel"><div className="text-sm text-muted">{t("Öneren müşteri")}</div><b className="num text-2xl">{referrers}</b></section>
        <section className="panel"><div className="text-sm text-muted">{t("Verilen ödül puanı")}</div><b className="num text-2xl">{pts}</b></section>
      </div>
      <section className="grid gap-2">
        <h2 className="font-bold">{t("Teklifler")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(offers ?? []).map((o) => <OfferCard key={o.id} offer={{ id: o.id, name: o.name, referrerPoints: o.referrer_points, inviteeDiscount: Number(o.invitee_discount), isActive: o.is_active }} canEdit={isManager} />)}
          {isManager && <OfferCard offer={null} canEdit />}
        </div>
      </section>
      <section className="panel grid gap-1">
        <h2 className="font-bold">{t("Davetle gelen müşteriler")}</h2>
        <p className="text-xs text-muted">{t("Müşteriyi kimin önerdiğini müşteri kartındaki “Kim önerdi?” alanından seçin. Yeni müşterinin ilk ödemeli ziyareti kasada kapatılınca öneren müşteriye puan kendiliğinden yazılır; indirim kasada uygulanır.")}</p>
        {!list.length && <p className="text-sm text-muted">{t("Bu dönemde davetle gelen müşteri yok.")}</p>}
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-sm border-b border-dashed border-line py-1 flex-wrap">
            <span className="num text-xs text-muted w-20">{fmtDate(c.created_at)}</span>
            <Link className="font-semibold hover:underline" href={`/panel/musteriler/${c.id}`}>{fullName(c)}</Link>
            <span className="text-muted">← {c.referrer ? <Link className="hover:underline" href={`/panel/musteriler/${c.referrer.id}`}>{fullName(c.referrer)}</Link> : "—"}</span>
            <span className={`pill text-[10px] ml-auto ${rewarded.has(c.id) ? "good" : ""}`}>{rewarded.has(c.id) ? t("ödül verildi") : t("ilk ziyaret bekleniyor")}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
