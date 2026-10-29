"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { addStaffAdjustment, setPayrollStart } from "./actions";

export function LedgerForms({ staff, today, payrollStart }: { staff: { id: string; name: string }[]; today: string; payrollStart: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sid, setSid] = useState(staff[0]?.id ?? "");
  const [kind, setKind] = useState<"plus" | "minus">("plus");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [ps, setPs] = useState(payrollStart);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const n = Number(amount.replace(",", "."));
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => { setMsg(null); start(async () => { const r = await fn(); if (!r.ok) setMsg({ ok: false, text: r.error ?? t("Hata") }); else { after?.(); setMsg({ ok: true, text: t("Kaydedildi.") }); router.refresh(); } }); };
  return (
    <section className="panel grid gap-3">
      <h2 className="font-bold">{t("Prim / kesinti ekle")}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr_auto] gap-2 items-end">
        <label className="f">{t("Personel")}<span className="inp"><select value={sid} onChange={(e) => setSid(e.target.value)}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></span></label>
        <label className="f">{t("Tür")}<span className="inp"><select value={kind} onChange={(e) => setKind(e.target.value as "plus" | "minus")}><option value="plus">{t("Prim (+)")}</option><option value="minus">{t("Kesinti (−)")}</option></select></span></label>
        <label className="f">{t("Tutar")}<span className="inp"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></span></label>
        <label className="f">{t("Tarih")}<span className="inp"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></span></label>
        <label className="f">{t("Not")}<span className="inp"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("ör. satış primi, geç kalma")} /></span></label>
        <button className="btn sm" disabled={pending || !(n > 0)} onClick={() => run(() => addStaffAdjustment({ staffId: sid, amount: kind === "plus" ? n : -n, date, note }), () => { setAmount(""); setNote(""); })}>{t("Ekle")}</button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">{t("Hesaplaşma başlangıç tarihi")}</summary>
        <div className="flex gap-2 items-end mt-2">
          <label className="f">{t("Başlangıç")}<span className="inp"><input type="date" value={ps} onChange={(e) => setPs(e.target.value)} /></span></label>
          <button className="btn ghost sm" disabled={pending} onClick={() => run(() => setPayrollStart(ps))}>{t("Kaydet")}</button>
        </div>
        <p className="text-xs text-muted mt-1">{t("Bu tarihten önceki hak ediş ve ödemeler kapanmış sayılır (DIKIDI'de ödemeler girilmediği için eski bakiyeler gerçek değil).")}</p>
      </details>
      {msg && <p className={`pill ${msg.ok ? "good" : "bad"} justify-self-start`}>{msg.text}</p>}
    </section>
  );
}
