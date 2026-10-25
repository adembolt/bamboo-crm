"use client";
import { useState, useTransition } from "react";
import { markSent } from "./actions";
import { fmtDate, fmtTime } from "@/lib/format";

export type MsgRow = { id: string; customerId: string | null; visitId: string | null; name: string; phone: string; locale: string; meta: string; body: string; href: string; sentAt: string | null; blocked: boolean };

export function MessageList({ rows, kind }: { rows: MsgRow[]; kind: string }) {
  const [sent, setSent] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const waiting = rows.filter((r) => !r.sentAt && !sent[r.id]).length;

  const send = (r: MsgRow) => {
    window.open(r.href, "_blank", "noopener");
    start(async () => { await markSent({ customerId: r.customerId, visitId: r.visitId, kind, body: r.body }); setSent((s) => ({ ...s, [r.id]: new Date().toISOString() })); });
  };

  if (!rows.length) return <p className="panel text-sm text-muted">Bu liste için gönderilecek mesaj yok.</p>;
  return (
    <section className="grid gap-2">
      <div className="text-sm text-muted">{rows.length} kişi · <b className="text-ink">{waiting}</b> bekliyor</div>
      {rows.map((r) => {
        const at = sent[r.id] ?? r.sentAt;
        return (
          <div key={r.id} className={`panel grid sm:grid-cols-[1fr_auto] gap-3 items-start ${at ? "opacity-60" : ""}`}>
            <div className="min-w-0 grid gap-1">
              <div className="font-bold flex items-center gap-2 flex-wrap">{r.name} <span className="text-muted font-normal">· {r.phone}</span> <span className="pill">{r.locale.toUpperCase()}</span> {r.blocked && <span className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>engelli</span>}</div>
              <div className="text-sm text-muted">{r.meta}</div>
              <button type="button" className="text-left text-sm text-ink/80 bg-sunk rounded-lg px-3 py-2 whitespace-pre-wrap" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                {open === r.id ? r.body : r.body.slice(0, 110) + (r.body.length > 110 ? "…" : "")}
              </button>
              {at && <div className="text-xs text-good">Gönderildi · {fmtDate(at)} {fmtTime(at)}</div>}
            </div>
            <div className="flex sm:flex-col gap-2">
              <button type="button" className={`btn sm ${at ? "ghost" : ""}`} onClick={() => send(r)} disabled={pending}>{at ? "Tekrar aç" : "WhatsApp'ta aç"}</button>
              <button type="button" className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(r.body)}>Kopyala</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
