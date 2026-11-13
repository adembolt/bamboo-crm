"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { Modal } from "@/components/modal";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { addFine, waiveFine } from "../ops-actions";

export function FineButton({ customerId, visitId, kind, amount }: { customerId: string; visitId: string; kind: "no_show" | "late_cancel"; amount: number }) {
  const t = useT();
  const router = useRouter();
  const [val, setVal] = useState(amount ? String(amount) : "");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-1">
      <span className="inp w-24"><input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="₺" aria-label={t("Ceza tutarı")} /></span>
      <button className="btn sm" disabled={pending || !(Number(val) > 0)} onClick={() => start(async () => { const r = await addFine({ customerId, visitId, kind, amount: Number(val.replace(",", ".")), reason: "" }); if (!r.ok) setErr(r.error); else router.refresh(); })}>{t("Ceza yaz")}</button>
      {err && <span className="text-xs text-bad">{err}</span>}
    </span>
  );
}

export function WaiveButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="text-xs text-bad hover:underline" disabled={pending} onClick={() => { if (confirm(t("Ceza silinsin ve tutar bakiyeye geri eklensin mi?"))) start(async () => { await waiveFine(id); router.refresh(); }); }}>{t("cezayı sil")}</button>;
}

export function ManualFine() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<PickedCustomer | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button className="btn ghost sm" onClick={() => setOpen(true)}>+ {t("Ceza yaz")}</button>
      {open && (
        <Modal title={t("Ceza yaz")} onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <CustomerPicker value={c} onChange={setC} onNew={() => {}} />
            <label className="f">{t("Tutar")}<span className="inp"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></span></label>
            <label className="f">{t("Açıklama")}<span className="inp"><input value={reason} onChange={(e) => setReason(e.target.value)} /></span></label>
            {err && <p className="pill bad">{err}</p>}
            <div className="flex justify-end gap-2"><button className="btn ghost" onClick={() => setOpen(false)}>{t("Vazgeç")}</button>
              <button className="btn" disabled={pending || !c || !(Number(amount) > 0)} onClick={() => start(async () => { const r = await addFine({ customerId: c!.id, visitId: null, kind: "other", amount: Number(amount.replace(",", ".")), reason }); if (!r.ok) setErr(r.error); else { setOpen(false); router.refresh(); } })}>{t("Kaydet")}</button></div>
          </div>
        </Modal>
      )}
    </>
  );
}
