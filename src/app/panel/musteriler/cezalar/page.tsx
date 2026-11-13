import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fmtTime, fullName, money, addDays, todayIso } from "@/lib/format";
import { saveFineRules } from "../ops-actions";
import { FineButton, WaiveButton, ManualFine } from "./fine-ui";

export async function generateMetadata() { return { title: (await getT())("Cezalar") }; }

/* DIKIDI "Fines": gelmeme ve geç iptal için ceza; tutar müşterinin bakiyesine borç yazılır, sonraki ödemede tahsil edilir */
export default async function FinesPage() {
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const since = addDays(todayIso(), -30);
  type It = { visit_id: string; status: string; starts_at: string; updated_at: string; service_name: string; visit: { customer: { id: string; first_name: string; last_name: string; balance: number } | null } };
  type F = { id: string; kind: string; amount: number; reason: string; fine_date: string; waived: boolean; visit_id: string | null; customer: { id: string; first_name: string; last_name: string } | null };
  const [{ data: s }, { data: items }, { data: fines }] = await Promise.all([
    supabase.from("settings").select("fine_no_show, fine_late_cancel, fine_late_cancel_hours").eq("id", 1).single(),
    supabase.from("visit_items").select("visit_id, status, starts_at, updated_at, service_name, visit:visits!inner(customer:customers(id, first_name, last_name, balance))").in("status", ["no_show", "cancelled"]).gte("starts_at", `${since}T00:00:00+03:00`).lte("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(500),
    supabase.from("fines").select("id, kind, amount, reason, fine_date, waived, visit_id, customer:customers(id, first_name, last_name)").order("created_at", { ascending: false }).limit(200),
  ]);
  const noShowFee = Number(s?.fine_no_show ?? 0), lateFee = Number(s?.fine_late_cancel ?? 0), hours = s?.fine_late_cancel_hours ?? 24;
  const fined = new Set(((fines ?? []) as unknown as F[]).map((f) => `${f.visit_id}|${f.kind}`));
  const byVisit = new Map<string, { kind: "no_show" | "late_cancel"; it: It; services: string[] }>();
  for (const it of (items ?? []) as unknown as It[]) {
    if (!it.visit.customer) continue;
    const late = it.status === "cancelled" && new Date(it.updated_at) < new Date(it.starts_at) && new Date(it.starts_at).getTime() - new Date(it.updated_at).getTime() < hours * 3600e3;
    const kind = it.status === "no_show" ? "no_show" : late ? "late_cancel" : null;
    if (!kind || fined.has(`${it.visit_id}|${kind}`)) continue;
    const cur = byVisit.get(it.visit_id);
    if (cur) cur.services.push(it.service_name); else byVisit.set(it.visit_id, { kind, it, services: [it.service_name] });
  }
  const cands = [...byVisit.entries()];
  const list = (fines ?? []) as unknown as F[];
  const active = list.filter((f) => !f.waived).reduce((a, f) => a + Number(f.amount), 0);
  return (
    <div className="grid gap-4 max-w-5xl">
      <h1 className="text-xl font-bold">{t("Cezalar")}</h1>
      <form action={saveFineRules} className="panel grid gap-3">
        <h2 className="font-bold">{t("Ceza kuralları")}</h2>
        <fieldset disabled={!isManager} className="grid sm:grid-cols-3 gap-3">
          <label className="f">{t("Gelmeme cezası (₺, 0 = yok)")}<span className="inp"><input name="fine_no_show" inputMode="decimal" defaultValue={String(noShowFee)} /></span></label>
          <label className="f">{t("Geç iptal cezası (₺, 0 = yok)")}<span className="inp"><input name="fine_late_cancel" inputMode="decimal" defaultValue={String(lateFee)} /></span></label>
          <label className="f">{t("Geç iptal sınırı (saat)")}<span className="inp"><input name="fine_late_cancel_hours" inputMode="numeric" defaultValue={String(hours)} /></span></label>
        </fieldset>
        <p className="text-xs text-muted">{t("Ceza, müşterinin bakiyesine borç olarak yazılır; kasada bir sonraki ödemede tahsil edilir. Ceza otomatik kesilmez, aşağıdaki listeden siz onaylarsınız.")}</p>
        {isManager && <button className="btn justify-self-start">{t("Kaydet")}</button>}
      </form>
      <section className="panel grid gap-1">
        <h2 className="font-bold">{t("Son 30 gün: gelmeyen ve geç iptal edenler")}</h2>
        {!cands.length && <p className="text-sm text-muted">{t("Cezası yazılmamış gelmeme veya geç iptal yok.")}</p>}
        {cands.map(([vid, x]) => (
          <div key={vid} className="grid grid-cols-[1fr_auto] gap-2 items-center text-sm border-b border-dashed border-line py-1.5">
            <span className="min-w-0"><b><Link className="hover:underline" href={`/panel/musteriler/${x.it.visit.customer!.id}`}>{fullName(x.it.visit.customer!)}</Link></b>
              <span className={`pill text-[10px] ml-1 ${x.kind === "no_show" ? "bad" : "warn"}`}>{x.kind === "no_show" ? t("Gelmedi") : t("Geç iptal")}</span>
              <span className="block text-xs text-muted">{fmtDate(x.it.starts_at)} {fmtTime(x.it.starts_at)} · {x.services.join(", ")}{x.kind === "late_cancel" ? ` · ${t("iptal")} ${fmtDate(x.it.updated_at)} ${fmtTime(x.it.updated_at)}` : ""}</span></span>
            {canWrite && <FineButton customerId={x.it.visit.customer!.id} visitId={vid} kind={x.kind} amount={x.kind === "no_show" ? noShowFee : lateFee} />}
          </div>
        ))}
      </section>
      <section className="panel grid gap-1">
        <div className="flex items-center gap-2 flex-wrap"><h2 className="font-bold">{t("Yazılan cezalar")}</h2><span className="text-xs text-muted">{t("aktif toplam {amount}", { amount: money(active) })}</span>{canWrite && <span className="ml-auto"><ManualFine /></span>}</div>
        {!list.length && <p className="text-sm text-muted">{t("Henüz ceza yok.")}</p>}
        {list.map((f) => (
          <div key={f.id} className={`grid grid-cols-[84px_minmax(0,1fr)_auto_auto] gap-x-3 items-center text-sm border-b border-dashed border-line py-1 ${f.waived ? "opacity-50 line-through" : ""}`}>
            <span className="num text-xs text-muted">{fmtDate(f.fine_date)}</span>
            <span className="truncate"><b>{f.customer ? <Link className="hover:underline" href={`/panel/musteriler/${f.customer.id}`}>{fullName(f.customer)}</Link> : "—"}</b><span className="text-muted"> · {f.kind === "no_show" ? t("Gelmeme") : f.kind === "late_cancel" ? t("Geç iptal") : t("Diğer")}{f.reason ? ` · ${f.reason}` : ""}</span></span>
            <b className="num">{money(f.amount)}</b>
            {isManager && !f.waived ? <WaiveButton id={f.id} /> : <span />}
          </div>
        ))}
      </section>
    </div>
  );
}
