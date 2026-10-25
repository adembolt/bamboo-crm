"use client";
import { useActionState } from "react";
import { updateCustomer } from "../actions";
import type { Customer } from "@/lib/database.types";

export function CustomerEditForm({ customer: c, canWrite }: { customer: Customer; canWrite: boolean }) {
  const [state, action, pending] = useActionState(updateCustomer.bind(null, c.id), { error: "" });
  return (
    <form action={action} className="grid gap-3">
      <fieldset disabled={!canWrite} className="grid grid-cols-2 gap-3">
        <label className="f">Ad<span className="inp"><input name="first_name" defaultValue={c.first_name} required /></span></label>
        <label className="f">Soyad<span className="inp"><input name="last_name" defaultValue={c.last_name} /></span></label>
        <label className="f">Telefon<span className="inp"><input name="phone" defaultValue={c.phone} inputMode="tel" /></span></label>
        <label className="f">E-posta<span className="inp"><input name="email" defaultValue={c.email} type="email" /></span></label>
        <label className="f">Dil<span className="inp"><select name="locale" defaultValue={c.locale}><option value="tr">Türkçe</option><option value="en">English</option><option value="ru">Русский</option><option value="de">Deutsch</option></select></span></label>
        <label className="f">Cinsiyet<span className="inp"><select name="gender" defaultValue={c.gender}><option value="">—</option><option value="f">Kadın</option><option value="m">Erkek</option><option value="x">Diğer</option></select></span></label>
        <label className="f">Doğum günü<span className="inp"><input name="birth_date" type="date" defaultValue={c.birth_date ?? ""} /></span></label>
        <label className="f">Uyruk<span className="inp"><input name="nationality" defaultValue={c.nationality} /></span></label>
        <label className="f">Kaynak<span className="inp"><input name="source" defaultValue={c.source} placeholder="instagram, google, otel…" /></span></label>
        <label className="f">İndirim %<span className="inp"><input name="discount_percent" inputMode="decimal" defaultValue={String(c.discount_percent)} /></span></label>
        <label className="f col-span-2">Etiketler (virgülle)<span className="inp"><input name="tags" defaultValue={c.tags.join(", ")} placeholder="VIP, turist, otel misafiri" /></span></label>
        <label className="f col-span-2">Not<span className="inp"><textarea name="notes" rows={2} defaultValue={c.notes} /></span></label>
        <label className="f col-span-2">Sağlık notu (alerji, hassasiyet, kontrendikasyon)<span className="inp"><textarea name="health_notes" rows={2} defaultValue={c.health_notes} /></span></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="consent_marketing" defaultChecked={c.consent_marketing} /> Mesaj/kampanya izni var</label>
        <label className="flex items-center gap-2 text-sm font-semibold text-bad"><input type="checkbox" name="is_blocked" defaultChecked={c.is_blocked} /> Online randevuya kapalı</label>
      </fieldset>
      {state.error && <p className="pill bad">{state.error}</p>}
      {state.saved && !pending && <p className="pill good">Kaydedildi</p>}
      {canWrite && <button className="btn justify-self-end" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>}
    </form>
  );
}
