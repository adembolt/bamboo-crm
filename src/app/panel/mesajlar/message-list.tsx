"use client";
import { useState, useTransition } from "react";
import { markSent, personalize } from "./actions";
import { waLink } from "@/lib/messages";
import { fmtDate, fmtTime } from "@/lib/format";

export type MsgRow = { id: string; customerId: string | null; visitId: string | null; name: string; phone: string; locale: string; meta: string; body: string; href: string; sentAt: string | null; blocked: boolean };

export function MessageList({ rows, kind }: { rows: MsgRow[]; kind: string }) {
  const [sent, setSent] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [ai, setAi] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<Record<string, string>>({});
  const bodyOf = (r: MsgRow) => ai[r.id] ?? r.body;
  const doAi = async (r: MsgRow) => { setAiBusy(r.id); setAiErr((e) => ({ ...e, [r.id]: "" })); const res = await personalize({ customerId: r.customerId, kind, locale: r.locale, draft: r.body }); setAiBusy(null); if (res.ok) { setAi((a) => ({ ...a, [r.id]: res.text })); setOpen(r.id); } else setAiErr((e) => ({ ...e, [r.id]: res.error })); };
  const waiting = rows.filter((r) => !r.sentAt && !sent[r.id]).length;

  const send = (r: MsgRow) => {
    const body = bodyOf(r);
    window.open(ai[r.id] ? waLink(r.phone, body) : r.href, "_blank", "noopener");
    start(async () => { await markSent({ customerId: r.customerId, visitId: r.visitId, kind, body }); setSent((s) => ({ ...s, [r.id]: new Date().toISOString() })); });
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
                {ai[r.id] && <span className="text-[10px] font-bold text-gold mr-1">✨ kişisel</span>}{open === r.id ? bodyOf(r) : bodyOf(r).slice(0, 110) + (bodyOf(r).length > 110 ? "…" : "")}
              </button>
              {aiErr[r.id] && <div className="text-xs text-bad">{aiErr[r.id]}</div>}
              {at && <div className="text-xs text-good">Gönderildi · {fmtDate(at)} {fmtTime(at)}</div>}
            </div>
            <div className="flex sm:flex-col gap-2">
              <button type="button" className={`btn sm ${at ? "ghost" : ""}`} onClick={() => send(r)} disabled={pending}>{at ? "Tekrar aç" : "WhatsApp'ta aç"}</button>
              <button type="button" className="btn ghost sm" disabled={aiBusy === r.id} onClick={() => doAi(r)} title="Müşterinin geçmişine göre Claude ile yeniden yaz">{aiBusy === r.id ? "Yazılıyor…" : ai[r.id] ? "✨ Yeniden" : "✨ Kişiselleştir"}</button>
              {ai[r.id] && <button type="button" className="btn ghost sm" onClick={() => setAi((a) => { const n = { ...a }; delete n[r.id]; return n; })}>Şablona dön</button>}
              <button type="button" className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(bodyOf(r))}>Kopyala</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
