"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sellGiftCard } from "../actions";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { todayIso, addDays, money } from "@/lib/format";
import type { PayMethod } from "@/lib/database.types";
import { useT } from "@/lib/i18n/client";

const METHOD: Partial<Record<PayMethod, string>> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online" };

type Tpl = { id: string; name: string; usage: string; amount: number; open_amount: boolean; valid_days: number; bonus_percent: number };

export function GiftCardForm({ templates = [] }: { templates?: Tpl[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [buyer, setBuyer] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [expires, setExpires] = useState(addDays(todayIso(), 365));
  const [method, setMethod] = useState<PayMethod>("cash");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const total = Number(amount) || 0;
  const tooLow = !!tpl && total < Number(tpl.amount) && (tpl.open_amount || total !== Number(tpl.amount));
  const pick = (x: Tpl | null) => { setTpl(x); if (x) { setAmount(String(Number(x.amount))); setExpires(addDays(todayIso(), x.valid_days)); } };
  return (
    <section className="panel grid gap-3">
      <h2 className="font-bold">{t("Hediye çeki sat")}</h2>
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={`pill ${!tpl ? "good" : ""}`} onClick={() => pick(null)}>{t("Serbest tutar")}</button>
          {templates.map((x) => (
            <button key={x.id} type="button" className={`pill ${tpl?.id === x.id ? "good" : ""}`} onClick={() => pick(x)} title={t(x.usage === "service" ? "Hizmetlerde geçerli" : x.usage === "product" ? "Ürünlerde geçerli" : "Hizmet ve ürünlerde geçerli")}>
              {x.name} · {money(x.amount)}{x.open_amount ? "+" : ""}{Number(x.bonus_percent) ? ` · +%${Number(x.bonus_percent)}` : ""}
            </button>
          ))}
        </div>
      )}
      {tpl && Number(tpl.bonus_percent) > 0 && total > 0 && <p className="text-xs">{t("Ödenen {paid}, çekin değeri {face} (bonus %{p}).", { paid: money(total), face: money(Math.round(total * (1 + Number(tpl.bonus_percent) / 100))), p: Number(tpl.bonus_percent) })}</p>}
      {tooLow && <p className="pill warn">{t("Bu şablonda tutar en az {n}.", { n: money(tpl!.amount) })}</p>}
      <div className="grid sm:grid-cols-[1fr_1fr_1.4fr_1fr_1fr_auto] gap-2 items-end">
        <label className="f">{t("Tutar")}<span className="inp"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("ör. 2000")} /></span></label>
        <label className="f">{t("Alan kişi")}<span className="inp"><input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder={t("isim")} /></span></label>
        <label className="f">{t("Müşteri kaydı (isteğe bağlı)")}<CustomerPicker value={customer} onChange={setCustomer} onNew={() => {}} /></label>
        <label className="f">{t("Son kullanma")}<span className="inp"><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></span></label>
        <label className="f">{t("Ödeme")}<span className="inp"><select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{(Object.keys(METHOD) as PayMethod[]).map((m) => <option key={m} value={m}>{t(METHOD[m]!)}</option>)}</select></span></label>
        <button className="btn" disabled={pending || !(total > 0) || tooLow} onClick={() => { setMsg(null); start(async () => { const r = await sellGiftCard({ amount: total, buyerName: buyer, customerId: customer?.id ?? null, expiresAt: expires || null, saleDate: todayIso(), payments: [{ method, amount: total }], templateId: tpl?.id ?? null }); if (!r.ok) setMsg({ ok: false, text: r.error }); else { setMsg({ ok: true, text: t("Çek oluşturuldu: {code} · {amount}", { code: r.code, amount: money(total) }) }); setAmount(""); setBuyer(""); setCustomer(null); router.refresh(); } }); }}>{pending ? "…" : t("Sat")}</button>
      </div>
      {msg && <p className={`pill ${msg.ok ? "good" : "bad"}`}>{msg.text}</p>}
    </section>
  );
}
