"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { addCall, deleteCall } from "../ops-actions";

export function CallForm() {
  const t = useT();
  const router = useRouter();
  const [c, setC] = useState<PickedCustomer | null>(null);
  const [phone, setPhone] = useState("");
  const [dir, setDir] = useState<"in" | "out">("in");
  const [outcome, setOutcome] = useState("answered");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="panel grid gap-2">
      <h2 className="font-bold">{t("Arama kaydet")}</h2>
      <div className="flex gap-1 bg-sunk p-1 rounded-lg">
        {(["in", "out"] as const).map((d) => <button key={d} type="button" onClick={() => setDir(d)} className={`flex-1 px-3 py-1 rounded-md text-sm font-semibold ${dir === d ? "bg-surface shadow-card" : "text-muted"}`}>{d === "in" ? `↙ ${t("Gelen")}` : `↗ ${t("Giden")}`}</button>)}
      </div>
      <CustomerPicker value={c} onChange={setC} onNew={(n) => setPhone(n?.phone ?? "")} />
      {!c && <label className="f">{t("Telefon (kayıtlı değilse)")}<span className="inp"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></span></label>}
      <label className="f">{t("Sonuç")}<span className="inp"><select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
        <option value="answered">{t("Görüşüldü")}</option><option value="booked">{t("Randevu alındı")}</option><option value="callback">{t("Geri aranacak")}</option>
        <option value="missed">{t("Cevapsız (gelen)")}</option><option value="no_answer">{t("Ulaşılamadı")}</option></select></span></label>
      <label className="f">{t("Not")}<span className="inp"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("ör. lazer fiyatı sordu")} /></span></label>
      <button className="btn justify-self-start" disabled={pending} onClick={() => start(async () => {
        const r = await addCall({ direction: dir, outcome, customerId: c?.id ?? null, phone: c?.phone ?? phone, note });
        if (!r.ok) { setMsg(r.error); return; }
        setMsg(t("Kaydedildi")); setNote(""); setC(null); setPhone(""); router.refresh();
      })}>{t("Kaydet")}</button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </section>
  );
}

export function DeleteCall({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="text-xs text-bad hover:underline" disabled={pending} onClick={() => { if (confirm(t("Arama kaydı silinsin mi?"))) start(async () => { await deleteCall(id); router.refresh(); }); }}>{t("sil")}</button>;
}
