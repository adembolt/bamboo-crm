"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { fullName } from "@/lib/format";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { setReferrer } from "@/app/panel/tanitim/actions";

type P = { id: string; first_name: string; last_name: string; phone: string };
export function ReferrerPanel({ customerId, referrer, invitedCount, discount, canWrite }: { customerId: string; referrer: P | null; invitedCount: number; discount: number; canWrite: boolean }) {
  const t = useT();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [c, setC] = useState<PickedCustomer | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="panel grid gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-bold">{t("Kim önerdi?")}</h2>
        {invitedCount > 0 && <span className="pill text-[10px]">{t("{n} kişiyi davet etti", { n: invitedCount })}</span>}
        {canWrite && !edit && <button className="btn ghost sm ml-auto" onClick={() => setEdit(true)}>{referrer ? t("Değiştir") : t("Seç")}</button>}
      </div>
      {!edit && (referrer ? <p className="text-sm"><Link className="font-semibold hover:underline" href={`/panel/musteriler/${referrer.id}`}>{fullName(referrer)}</Link>{discount > 0 && <span className="text-xs text-muted"> · {t("ilk ziyarette %{n} indirim uygulayın", { n: discount })}</span>}</p> : <p className="text-sm text-muted">{t("Öneren müşteri yok.")}</p>)}
      {edit && (
        <div className="grid gap-2">
          <CustomerPicker value={c} onChange={setC} onNew={() => {}} />
          {err && <p className="pill bad">{err}</p>}
          <div className="flex gap-2">
            <button className="btn sm" disabled={pending || !c} onClick={() => start(async () => { const r = await setReferrer(customerId, c!.id); if (!r.ok) setErr(r.error); else { setEdit(false); router.refresh(); } })}>{t("Kaydet")}</button>
            {referrer && <button className="btn ghost sm text-bad" disabled={pending} onClick={() => start(async () => { await setReferrer(customerId, null); setEdit(false); router.refresh(); })}>{t("Kaldır")}</button>}
            <button className="btn ghost sm" onClick={() => setEdit(false)}>{t("Vazgeç")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
