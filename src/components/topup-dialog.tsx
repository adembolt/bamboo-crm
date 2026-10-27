"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { topUpBalance } from "@/app/panel/kasa/actions";
import { money, todayIso } from "@/lib/format";
import type { PayMethod } from "@/lib/database.types";

const METHOD: Partial<Record<PayMethod, string>> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online" };

/** Müşteriye toplu para (bakiye) yükleme — kasaya "Bakiye yükleme" satışı olarak işlenir */
export function TopUpDialog({ customerId, customerName, balance, onClose, onDone }: { customerId: string; customerName: string; balance: number; onClose: () => void; onDone: (amount: number) => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pays, setPays] = useState<{ method: PayMethod; amount: string }[]>([{ method: "cash", amount: "" }]);
  const total = Number(amount) || 0;
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.round((total - paid) * 100) / 100;
  const setPay = (i: number, patch: Partial<{ method: PayMethod; amount: string }>) => setPays(pays.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  return (
    <Modal title={`Bakiye yükle · ${customerName}`} onClose={onClose}>
      <div className="grid gap-3">
        <p className="text-sm text-muted">Mevcut bakiye: <b className="text-ink num">{money(balance)}</b>. Yüklenen tutar kasaya bugünkü tahsilat olarak yazılır; sonraki ziyaretlerde ödeme ekranında <b>Bakiye</b> ile düşülür.</p>
        <label className="f">Yüklenecek tutar<span className="inp"><input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ör. 10000" /></span></label>
        <div className="flex flex-wrap gap-1.5">{[2000, 5000, 10000, 20000].map((v) => <button key={v} type="button" className="pill hover:brightness-95" onClick={() => setAmount(String(v))}>{money(v)}</button>)}</div>
        <div className="eyebrow">Müşterinin ödemesi</div>
        {pays.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <span className="inp"><select value={p.method} onChange={(e) => setPay(i, { method: e.target.value as PayMethod })}>{(Object.keys(METHOD) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD[m]}</option>)}</select></span>
            <span className="inp"><input inputMode="decimal" placeholder={String(Math.max(0, remaining + (Number(p.amount) || 0)))} value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} /></span>
            <button type="button" className="btn ghost sm" title="Kalanı doldur" onClick={() => setPay(i, { amount: String(Math.max(0, remaining + (Number(p.amount) || 0))) })}>↵</button>
          </div>
        ))}
        <div className="flex gap-2 items-center"><button type="button" className="btn ghost sm" onClick={() => setPays([...pays, { method: "card", amount: "" }])}>+ Karışık ödeme</button><span className={`ml-auto text-sm num ${Math.abs(remaining) < 0.5 ? "text-good" : "text-bad"}`}>{Math.abs(remaining) < 0.5 ? "Tutar eşleşti" : `Kalan ${money(remaining)}`}</span></div>
        <label className="f">Not (isteğe bağlı)<span className="inp"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. 10 seans masaj için ön ödeme" /></span></label>
        {err && <p className="pill bad">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn" disabled={pending || !(total > 0) || Math.abs(remaining) >= 0.5} onClick={() => { setErr(""); start(async () => { const r = await topUpBalance({ customerId, amount: total, saleDate: todayIso(), notes: note || undefined, payments: pays.map((p) => ({ method: p.method, amount: Number(p.amount) || 0 })) }); if (!r.ok) setErr(r.error); else onDone(total); }); }}>{pending ? "…" : `${money(total)} yükle`}</button></div>
      </div>
    </Modal>
  );
}
