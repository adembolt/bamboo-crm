"use client";
import { useState, useActionState } from "react";
import { createCustomer } from "./actions";

export function NewCustomerForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCustomer, { error: "" });
  if (!open) return <div><button className="btn" onClick={() => setOpen(true)}>+ Yeni müşteri</button></div>;
  return (
    <form action={action} className="panel grid gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="f">Ad *<span className="inp"><input name="first_name" required autoFocus /></span></label>
        <label className="f">Soyad<span className="inp"><input name="last_name" /></span></label>
        <label className="f">Telefon<span className="inp"><input name="phone" inputMode="tel" placeholder="+90 5xx…" /></span></label>
        <label className="f">Dil<span className="inp"><select name="locale" defaultValue="tr"><option value="tr">Türkçe</option><option value="en">English</option><option value="ru">Русский</option><option value="de">Deutsch</option></select></span></label>
        <label className="f">Doğum günü<span className="inp"><input name="birth_date" type="date" /></span></label>
        <label className="f">Kaynak<span className="inp"><select name="source" defaultValue=""><option value="">—</option><option value="instagram">Instagram</option><option value="google">Google</option><option value="hotel">Otel</option><option value="referral">Tavsiye</option><option value="walk_in">Yoldan geçen</option><option value="whatsapp">WhatsApp</option></select></span></label>
        <label className="f col-span-2">Not<span className="inp"><input name="notes" /></span></label>
      </div>
      {state.error && <p className="pill bad">{state.error}</p>}
      <div className="flex gap-2 justify-end"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Vazgeç</button><button className="btn" disabled={pending}>Kaydet</button></div>
    </form>
  );
}
