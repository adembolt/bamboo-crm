"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { saveOffer } from "../actions";

type O = { id?: string; name: string; referrerPoints: number; inviteeDiscount: number; isActive: boolean };

export function OfferCard({ offer, canEdit }: { offer: O | null; canEdit: boolean }) {
  const t = useT();
  const router = useRouter();
  const [edit, setEdit] = useState<O | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (!offer && !edit) return <button className="panel border-dashed text-sm text-muted hover:text-ink grid place-items-center min-h-[140px]" onClick={() => setEdit({ name: "", referrerPoints: 50, inviteeDiscount: 10, isActive: true })}>+ {t("Yeni teklif")}</button>;
  if (edit) return (
    <section className="panel grid gap-2">
      <label className="f">{t("Teklif adı")}<span className="inp"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></span></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="f">{t("Önerene puan")}<span className="inp"><input inputMode="numeric" value={edit.referrerPoints} onChange={(e) => setEdit({ ...edit, referrerPoints: Number(e.target.value) || 0 })} /></span></label>
        <label className="f">{t("Gelene indirim %")}<span className="inp"><input inputMode="decimal" value={edit.inviteeDiscount} onChange={(e) => setEdit({ ...edit, inviteeDiscount: Number(e.target.value) || 0 })} /></span></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />{t("Aktif")}</label>
      {err && <p className="pill bad">{err}</p>}
      <div className="flex gap-2"><button className="btn sm" disabled={pending} onClick={() => start(async () => { const r = await saveOffer(edit); if (!r.ok) setErr(r.error); else { setEdit(null); router.refresh(); } })}>{t("Kaydet")}</button><button className="btn ghost sm" onClick={() => setEdit(null)}>{t("Vazgeç")}</button></div>
    </section>
  );
  const o = offer!;
  return (
    <section className="panel grid gap-1.5">
      <b>{o.name}</b>
      <span className={`text-xs font-semibold ${o.isActive ? "text-good" : "text-muted"}`}>{o.isActive ? `✓ ${t("Aktif")}` : t("Durduruldu")}</span>
      <div className="text-sm flex justify-between"><span className="text-muted">{t("Önerene")}</span><b>{t("{n} puan", { n: o.referrerPoints })}</b></div>
      <div className="text-sm flex justify-between"><span className="text-muted">{t("Davet edilene")}</span><b>{t("%{n} indirim", { n: o.inviteeDiscount })}</b></div>
      <div className="text-sm flex justify-between"><span className="text-muted">{t("Koşul")}</span><b>{t("İlk ziyaret")}</b></div>
      {canEdit && <div className="flex gap-2 mt-1">
        <button className="btn ghost sm flex-1" disabled={pending} onClick={() => start(async () => { await saveOffer({ ...o, isActive: !o.isActive }); router.refresh(); })}>{o.isActive ? t("Durdur") : t("Başlat")}</button>
        <button className="btn ghost sm" onClick={() => setEdit(o)}>✎</button></div>}
    </section>
  );
}
