"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { todayIso } from "@/lib/format";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import type { PayMethod } from "@/lib/database.types";
import { addTip, deleteTip } from "../ops-actions";

export function TipForm({ staff }: { staff: { id: string; full_name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [staffId, setStaffId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("card");
  const [toPayroll, setToPayroll] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [c, setC] = useState<PickedCustomer | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="panel grid gap-2">
      <h2 className="font-bold">{t("Bahşiş ekle")}</h2>
      <label className="f">{t("Personel")}<span className="inp"><select value={staffId} onChange={(e) => setStaffId(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="f">{t("Tutar")}<span className="inp"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></span></label>
        <label className="f">{t("Tarih")}<span className="inp"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></span></label>
      </div>
      <label className="f">{t("Ödeme")}<span className="inp"><select value={method} onChange={(e) => { const m = e.target.value as PayMethod; setMethod(m); setToPayroll(m !== "cash"); }}>
        <option value="cash">{t("Nakit")}</option><option value="card">{t("Kart")}</option><option value="transfer">{t("Havale")}</option></select></span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={toPayroll} onChange={(e) => setToPayroll(e.target.checked)} />{t("Salona geldi, maaşla personele ödenecek")}</label>
      <CustomerPicker value={c} onChange={setC} onNew={() => {}} />
      <label className="f">{t("Not")}<span className="inp"><input value={note} onChange={(e) => setNote(e.target.value)} /></span></label>
      <button className="btn justify-self-start" disabled={pending || !staffId || !(Number(amount) > 0)} onClick={() => start(async () => {
        const r = await addTip({ date, staffId, amount: Number(amount.replace(",", ".")), method, toPayroll, customerId: c?.id ?? null, note });
        if (!r.ok) { setMsg(r.error); return; }
        setMsg(t("Kaydedildi")); setAmount(""); setNote(""); setC(null); router.refresh();
      })}>{t("Kaydet")}</button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </section>
  );
}

export function DeleteTip({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="text-xs text-bad hover:underline" disabled={pending} onClick={() => { if (confirm(t("Bahşiş kaydı silinsin mi?"))) start(async () => { await deleteTip(id); router.refresh(); }); }}>{t("sil")}</button>;
}
