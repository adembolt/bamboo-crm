import { requireSession } from "@/lib/auth";
import { fmtDate, fmtTime, fullName } from "@/lib/format";
import { approveRequest, rejectRequest } from "./actions";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Online talepler") };
}

export default async function OnlineRequestsPage() {
  const { supabase } = await requireSession();
  const t = await getT();
  const { data } = await supabase
    .from("booking_requests")
    .select("*, service:services(name_tr, duration_min, price), staff:staff(full_name)")
    .in("status", ["new"])
    .order("created_at", { ascending: false });
  const reqs = data ?? [];
  return (
    <div className="grid gap-4">
      <header><h1 className="text-xl font-bold">{t("Online randevu talepleri")}</h1><p className="text-sm text-muted">{t("Siteden gelen talepler onaylanınca takvime işlenir.")}</p></header>
      {!reqs.length && <p className="panel text-sm text-muted">{t("Bekleyen talep yok.")}</p>}
      <div className="grid gap-2">
        {reqs.map((r) => (
          <div key={r.id} className="panel grid sm:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="min-w-0">
              <div className="font-bold">{fullName(r)} <span className="text-muted font-normal">· {r.phone}</span> <span className="pill ml-1">{r.locale.toUpperCase()}</span></div>
              <div className="text-sm">{fmtDate(r.starts_at)} {fmtTime(r.starts_at)} · {r.service?.name_tr} · {r.staff?.full_name ?? t("personel fark etmez")}</div>
              {r.notes && <div className="text-xs text-muted">{r.notes}</div>}
            </div>
            <div className="flex gap-2">
              <form action={approveRequest.bind(null, r.id)}><button className="btn sm">{t("Onayla")}</button></form>
              <form action={rejectRequest.bind(null, r.id)}><button className="btn sm danger">{t("Reddet")}</button></form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
