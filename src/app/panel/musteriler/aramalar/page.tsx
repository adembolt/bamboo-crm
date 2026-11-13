import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fmtTime, fullName, addDays, todayIso } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";
import { CallForm, DeleteCall } from "./call-ui";

export async function generateMetadata() { return { title: (await getT())("Aramalar") }; }

const OUT: Record<string, string> = { answered: "Görüşüldü", missed: "Cevapsız (gelen)", no_answer: "Ulaşılamadı", booked: "Randevu alındı", callback: "Geri aranacak" };

/* DIKIDI'deki IP telefon Türkiye'de çalışmıyor; burada aramalar elle kaydedilir ve aranacaklar listelenir */
export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "week");
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const today = todayIso();
  type C = { id: string; call_at: string; direction: string; outcome: string; phone: string; note: string; customer: { id: string; first_name: string; last_name: string; phone: string } | null };
  const [{ data: calls }, { data: noShows }, { data: callbacks }] = await Promise.all([
    supabase.from("call_logs").select("id, call_at, direction, outcome, phone, note, customer:customers(id, first_name, last_name, phone)").gte("call_at", `${period.from}T00:00:00+03:00`).lte("call_at", `${period.to}T23:59:59+03:00`).order("call_at", { ascending: false }).limit(500),
    supabase.from("visit_items").select("starts_at, visit:visits!inner(customer:customers(id, first_name, last_name, phone))").eq("status", "no_show").gte("starts_at", `${addDays(today, -14)}T00:00:00+03:00`).order("starts_at", { ascending: false }).limit(30),
    supabase.from("call_logs").select("id, call_at, phone, note, customer:customers(id, first_name, last_name, phone)").in("outcome", ["callback", "missed"]).gte("call_at", `${addDays(today, -7)}T00:00:00+03:00`).order("call_at", { ascending: false }).limit(30),
  ]);
  const list = (calls ?? []) as unknown as C[];
  type N = { starts_at: string; visit: { customer: { id: string; first_name: string; last_name: string; phone: string } | null } };
  const todo = [
    ...((callbacks ?? []) as unknown as C[]).map((c) => ({ key: `c${c.id}`, why: t("Geri aranacak"), at: c.call_at, c: c.customer, phone: c.customer?.phone || c.phone, note: c.note })),
    ...((noShows ?? []) as unknown as N[]).filter((n) => n.visit.customer).map((n, i) => ({ key: `n${i}`, why: t("Gelmedi"), at: n.starts_at, c: n.visit.customer, phone: n.visit.customer!.phone, note: "" })),
  ];
  const canDelete = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-bold">{t("Aramalar")}</h1>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="grid gap-3">
          <PeriodBar base="/panel/musteriler/aramalar" period={period} />
          <section className="panel grid gap-0.5">
            {!list.length && <p className="text-sm text-muted">{t("Bu dönemde arama kaydı yok.")}</p>}
            {list.map((c) => (
              <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 items-center text-sm border-b border-dashed border-line py-1.5">
                <span className="text-lg" title={c.direction === "in" ? t("Gelen") : t("Giden")}>{c.direction === "in" ? "↙" : "↗"}</span>
                <span className="min-w-0">
                  <b>{c.customer ? <Link className="hover:underline" href={`/panel/musteriler/${c.customer.id}`}>{fullName(c.customer)}</Link> : c.phone}</b>
                  <span className="text-muted"> · {t(OUT[c.outcome] ?? c.outcome)}{c.note ? ` · ${c.note}` : ""}</span>
                  <span className="block text-[11px] text-muted num">{fmtDate(c.call_at)} {fmtTime(c.call_at)}{c.customer?.phone || c.phone ? <> · <a className="hover:underline" href={`tel:${c.customer?.phone || c.phone}`}>{c.customer?.phone || c.phone}</a></> : null}</span>
                </span>
                {canDelete && <DeleteCall id={c.id} />}
              </div>
            ))}
          </section>
        </div>
        <div className="grid gap-3">
          <CallForm />
          <section className="panel grid gap-1">
            <h2 className="font-bold">{t("Aranacaklar")}</h2>
            <p className="text-xs text-muted">{t("Son 7 günde geri aranacak / cevapsız kalanlar ve son 14 günde gelmeyenler.")}</p>
            {!todo.length && <p className="text-sm text-muted">{t("Aranacak kimse yok.")}</p>}
            {todo.map((x) => (
              <div key={x.key} className="text-sm border-b border-dashed border-line py-1">
                <b>{x.c ? <Link className="hover:underline" href={`/panel/musteriler/${x.c.id}`}>{fullName(x.c)}</Link> : x.phone}</b>
                <span className="text-xs text-muted"> · {x.why} · {fmtDate(x.at)}</span>
                {x.phone && <a className="block text-xs text-green hover:underline" href={`tel:${x.phone}`}>📞 {x.phone}</a>}
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
