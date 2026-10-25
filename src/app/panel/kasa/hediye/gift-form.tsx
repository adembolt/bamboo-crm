"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sellGiftCard } from "../actions";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { todayIso, addDays, money } from "@/lib/format";
import type { PayMethod } from "@/lib/database.types";

const METHOD: Partial<Record<PayMethod, string>> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online" };

export function GiftCardForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [buyer, setBuyer] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [expires, setExpires] = useState(addDays(todayIso(), 365));
  const [method, setMethod] = useState<PayMethod>("cash");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const total = Number(amount) || 0;
  return (
    <section className="panel grid gap-3">
      <h2 className="font-bold">Hediye çeki sat</h2>
      <div className="grid sm:grid-cols-[1fr_1fr_1.4fr_1fr_1fr_auto] gap-2 items-end">
        <label className="f">Tutar<span className="inp"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ör. 2000" /></span></label>
        <label className="f">Alan kişi<span className="inp"><input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="isim" /></span></label>
        <label className="f">Müşteri kaydı (isteğe bağlı)<CustomerPicker value={customer} onChange={setCustomer} onNew={() => {}} /></label>
        <label className="f">Son kullanma<span className="inp"><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></span></label>
        <label className="f">Ödeme<span className="inp"><select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{(Object.keys(METHOD) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD[m]}</option>)}</select></span></label>
        <button className="btn" disabled={pending || !(total > 0)} onClick={() => { setMsg(null); start(async () => { const r = await sellGiftCard({ amount: total, buyerName: buyer, customerId: customer?.id ?? null, expiresAt: expires || null, saleDate: todayIso(), payments: [{ method, amount: total }] }); if (!r.ok) setMsg({ ok: false, text: r.error }); else { setMsg({ ok: true, text: `Çek oluşturuldu: ${r.code} · ${money(total)}` }); setAmount(""); setBuyer(""); setCustomer(null); router.refresh(); } }); }}>{pending ? "…" : "Sat"}</button>
      </div>
      {msg && <p className={`pill ${msg.ok ? "good" : "bad"}`}>{msg.text}</p>}
    </section>
  );
}
