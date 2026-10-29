"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { money, todayIso } from "@/lib/format";
import { setOpening, addAdjustment } from "./actions";

type Acc = { id: string; name: string; balance: number; opening_balance: number; opening_date: string };

export function AccountForms({ accounts }: { accounts: Acc[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [acc, setAcc] = useState(accounts[0]?.id ?? "");
  const [mode, setMode] = useState<"count" | "move" | "opening">("count");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const cur = accounts.find((a) => a.id === acc);
  const n = Number(amount.replace(",", "."));
  const run = () => {
    if (!cur || !Number.isFinite(n) || amount === "") return;
    setMsg(null);
    start(async () => {
      const r = mode === "opening" ? await setOpening(acc, n, date)
        : mode === "count" ? await addAdjustment(acc, Math.round((n - cur.balance) * 100) / 100, date, note || t("Sayım farkı"))
        : await addAdjustment(acc, n, date, note);
      if (!r.ok) setMsg({ ok: false, text: r.error }); else { setMsg({ ok: true, text: t("Kaydedildi.") }); setAmount(""); setNote(""); router.refresh(); }
    });
  };
  return (
    <section className="panel grid gap-3">
      <div className="flex gap-2 flex-wrap">
        {(["count", "move", "opening"] as const).map((m) => (
          <button key={m} type="button" className={`btn sm ${mode === m ? "" : "ghost"}`} onClick={() => setMode(m)}>{t(m === "count" ? "Sayım (gerçek tutarı gir)" : m === "move" ? "Para giriş/çıkış" : "Açılış bakiyesi")}</button>
        ))}
      </div>
      <div className="grid sm:grid-cols-4 gap-2 items-end">
        <label className="f">{t("Hesap")}<span className="inp"><select value={acc} onChange={(e) => setAcc(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{t(a.name)}</option>)}</select></span></label>
        <label className="f">{t(mode === "count" ? "Sayılan tutar" : mode === "move" ? "Tutar (çıkış için −)" : "Açılış tutarı")}<span className="inp"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></span></label>
        <label className="f">{t("Tarih")}<span className="inp"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></span></label>
        {mode !== "opening" && <label className="f">{t("Not")}<span className="inp"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t(mode === "move" ? "ör. bankaya yatırıldı" : "Sayım farkı")} /></span></label>}
      </div>
      {mode === "count" && cur && amount !== "" && Number.isFinite(n) && <p className="text-sm">{t("Sistemdeki bakiye {b}; fark {d} olarak kaydedilecek.", { b: money(cur.balance), d: money(n - cur.balance) })}</p>}
      {mode === "opening" && <p className="text-xs text-muted">{t("Açılış tarihinden önceki hareketler bu hesabın bakiyesine katılmaz.")}</p>}
      <button className="btn justify-self-start" disabled={pending || amount === "" || !Number.isFinite(n)} onClick={run}>{t("Kaydet")}</button>
      {msg && <p className={`pill ${msg.ok ? "good" : "bad"} justify-self-start`}>{msg.text}</p>}
    </section>
  );
}
