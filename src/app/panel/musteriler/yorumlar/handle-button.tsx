"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { markReviewHandled } from "./actions";

export function HandleReview({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="btn sm" onClick={() => setOpen(true)}>{t("İlgilenildi olarak işaretle")}</button>;
  return (
    <div className="grid gap-2">
      <textarea className="inp p-2 min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Ne yapıldı? (ör. aradık, bir sonraki bakım hediye)")} />
      <div className="flex gap-2">
        <button className="btn sm" disabled={pending} onClick={() => start(async () => { await markReviewHandled(id, note); router.refresh(); })}>{t("Kaydet")}</button>
        <button className="btn ghost sm" onClick={() => setOpen(false)}>{t("Vazgeç")}</button>
      </div>
    </div>
  );
}
