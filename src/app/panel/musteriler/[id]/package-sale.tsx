"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/panel/takvim/day-calendar";
import { sellPackage, adjustPackage, adjustPoints, topUpBalance, adjustBalance } from "@/app/panel/kasa/actions";
import { money, todayIso, addDays } from "@/lib/format";
import type { PayMethod } from "@/lib/database.types";

type Svc = { id: string; name_tr: string; price: number; session_count: number; kind: string };
type Pkg = { id: string; name: string; total_sessions: number; used_sessions: number; price_paid: number; purchased_at: string; expires_at: string | null; is_active: boolean };
const METHOD: Partial<Record<PayMethod, string>> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online", gift_card: "Hediye çeki" };

export function BalancePanel({ customerId, balance, canWrite, isManager, ledger }: { customerId: string; balance: number; canWrite: boolean; isManager: boolean; ledger: { amount: number; reason: string; created_at: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adj, setAdj] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [pays, setPays] = useState<{ method: PayMethod; amount: string }[]>([{ method: "cash", amount: "" }]);
  const [delta, setDelta] = useState(""); const [reason, setReason] = useState("");
  const total = Number(amount) || 0; const effPays = pays.length === 1 && pays[0].amount.trim() === "" ? [{ ...pays[0], amount: String(total) }] : pays; const paid = effPays.reduce((s, p) => s + (Number(p.amount) || 0), 0); const remaining = total - paid;
  const setPay = (i: number, patch: Partial<{ method: PayMethod; amount: string }>) => setPays(pays.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  return (
    <section className="panel grid gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-bold">Bakiye (balans)</h2>
        <b className={`num text-xl ml-auto ${balance < 0 ? "text-bad" : "text-green"}`}>{money(balance)}</b>
        {isManager && <button className="btn ghost sm" onClick={() => setAdj(true)}>Düzelt</button>}
        {canWrite && <button className="btn sm" onClick={() => setOpen(true)}>Bakiye yükle</button>}
      </div>
      <p className="text-xs text-muted">Müşterinin önceden yatırdığı para. Kasada “Ödeme al” ekranında <b>Bakiye</b> seçeneğiyle düşülür.</p>
      {ledger.length > 0 && <div className="grid gap-0.5">{ledger.map((l, i) => <div key={i} className="text-sm grid grid-cols-[auto_1fr_auto] gap-2"><span className="num text-muted">{l.created_at.slice(0, 10).split("-").reverse().join(".")}</span><span className="truncate">{l.reason}</span><span className={`num font-semibold ${l.amount > 0 ? "text-good" : "text-bad"}`}>{l.amount > 0 ? "+" : ""}{money(l.amount)}</span></div>)}</div>}
      {open && (
        <Modal title="Bakiye yükle" onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <label className="f">Yüklenecek tutar<span className="inp"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ör. 5000" /></span></label>
            <div className="eyebrow">Ödeme</div>
            {pays.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <span className="inp"><select value={p.method} onChange={(e) => setPay(i, { method: e.target.value as PayMethod })}>{(["cash", "card", "transfer", "online"] as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD[m]}</option>)}</select></span>
                <span className="inp"><input inputMode="decimal" placeholder={String(Math.max(0, remaining + (Number(p.amount) || 0)))} value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} /></span>
                <button type="button" className="btn ghost sm" onClick={() => setPay(i, { amount: String(Math.max(0, remaining + (Number(p.amount) || 0))) })}>↵</button>
              </div>
            ))}
            <div className="flex gap-2 items-center"><button type="button" className="btn ghost sm" onClick={() => setPays([...pays, { method: "card", amount: "" }])}>+ Karışık ödeme</button><span className={`ml-auto text-sm num ${Math.abs(remaining) < 0.5 ? "text-good" : "text-bad"}`}>{Math.abs(remaining) < 0.5 ? "Tutar eşleşti" : `Kalan ${money(remaining)}`}</span></div>
            {err && <p className="pill bad">{err}</p>}
            <div className="flex justify-end gap-2"><button className="btn ghost" onClick={() => setOpen(false)}>Vazgeç</button><button className="btn" disabled={pending || !(total > 0) || Math.abs(remaining) >= 0.5} onClick={() => { setErr(""); start(async () => { const r = await topUpBalance({ customerId, amount: total, saleDate: todayIso(), payments: effPays.map((p) => ({ method: p.method, amount: Number(p.amount) || 0 })) }); if (!r.ok) setErr(r.error); else { setOpen(false); setAmount(""); router.refresh(); } }); }}>{pending ? "…" : "Yükle ve kasaya işle"}</button></div>
          </div>
        </Modal>
      )}
      {adj && (
        <Modal title={`Bakiye düzelt (mevcut ${money(balance)})`} onClose={() => setAdj(false)}>
          <div className="grid gap-3">
            <label className="f">Tutar (+ ekle / − düş)<span className="inp"><input inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="ör. 500 veya -200" /></span></label>
            <label className="f">Açıklama<span className="inp"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ör. DIKIDI'den devreden bakiye" /></span></label>
            <div className="flex justify-end gap-2"><button className="btn ghost" onClick={() => setAdj(false)}>Vazgeç</button><button className="btn" disabled={pending || !Number(delta)} onClick={() => start(async () => { await adjustBalance(customerId, Number(delta), reason); setAdj(false); router.refresh(); })}>Kaydet</button></div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function PackagePanel({ customerId, packages, services, staff, defaultMonths, canWrite, isManager, points }: { customerId: string; packages: Pkg[]; services: Svc[]; staff: { id: string; full_name: string }[]; defaultMonths: number; canWrite: boolean; isManager: boolean; points: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [ptOpen, setPtOpen] = useState(false);
  const active = packages.filter((p) => p.is_active && p.used_sessions < p.total_sessions);
  const old = packages.filter((p) => !active.includes(p));
  return (
    <section className="panel grid gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-bold">Seans paketleri</h2>
        <span className="pill ml-auto" title="Sadakat puanı">★ {points} puan</span>
        {isManager && <button className="btn ghost sm" onClick={() => setPtOpen(true)}>Puan düzelt</button>}
        {canWrite && <button className="btn sm" onClick={() => setOpen(true)}>Paket sat</button>}
      </div>
      {!packages.length && <p className="text-sm text-muted">Paket yok.</p>}
      {[...active, ...old].map((p) => (
        <div key={p.id} className={`rounded-xl bg-sunk px-3 py-2 grid gap-1 ${active.includes(p) ? "" : "opacity-60"}`}>
          <div className="flex justify-between gap-2 items-center"><b>{p.name}</b><span className="num font-bold">{p.used_sessions}/{p.total_sessions}</span></div>
          <div className="h-2 rounded bg-surface overflow-hidden"><span className="block h-full bg-green" style={{ width: `${Math.min(100, (p.used_sessions / p.total_sessions) * 100)}%` }} /></div>
          <div className="text-xs text-muted flex gap-2 flex-wrap">
            <span>{p.purchased_at.split("-").reverse().join(".")}{p.expires_at ? ` · son ${p.expires_at.split("-").reverse().join(".")}` : ""} · {money(p.price_paid)}</span>
            {canWrite && active.includes(p) && <button className="hover:underline" disabled={pending} onClick={() => start(async () => { await adjustPackage(p.id, { used_sessions: p.used_sessions + 1, is_active: p.used_sessions + 1 < p.total_sessions }); router.refresh(); })}>+1 seans düş (elle)</button>}
            {canWrite && p.used_sessions > 0 && <button className="hover:underline" disabled={pending} onClick={() => start(async () => { await adjustPackage(p.id, { used_sessions: p.used_sessions - 1, is_active: true }); router.refresh(); })}>−1</button>}
            {isManager && active.includes(p) && <button className="hover:underline text-bad" disabled={pending} onClick={() => { if (confirm("Paket pasife alınsın mı?")) start(async () => { await adjustPackage(p.id, { is_active: false }); router.refresh(); }); }}>pasife al</button>}
          </div>
        </div>
      ))}
      {open && <SellDialog customerId={customerId} services={services} staff={staff} defaultMonths={defaultMonths} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
      {ptOpen && <PointsDialog customerId={customerId} points={points} onClose={() => setPtOpen(false)} onDone={() => { setPtOpen(false); router.refresh(); }} />}
    </section>
  );
}

function SellDialog({ customerId, services, staff, defaultMonths, onClose, onDone }: { customerId: string; services: Svc[]; staff: { id: string; full_name: string }[]; defaultMonths: number; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [svc, setSvc] = useState<Svc | null>(null);
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState("5");
  const [price, setPrice] = useState("");
  const [expires, setExpires] = useState(addDays(todayIso(), Math.round(defaultMonths * 30.4)));
  const [staffId, setStaffId] = useState("");
  const [pays, setPays] = useState<{ method: PayMethod; amount: string; ref?: string }[]>([{ method: "cash", amount: "" }]);
  const total = Number(price) || 0;
  const effPays = pays.length === 1 && pays[0].amount.trim() === "" ? [{ ...pays[0], amount: String(total) }] : pays; const paid = effPays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;
  const list = q.length < 2 ? services.filter((s) => s.session_count > 1 || s.kind === "package").slice(0, 12) : services.filter((s) => s.name_tr.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))).slice(0, 12);
  const pick = (s: Svc) => { setSvc(s); setQ(""); if (!name) setName(s.name_tr); if (s.session_count > 1) setSessions(String(s.session_count)); if (!price) setPrice(String(Math.round(Number(s.price) * (s.session_count > 1 ? 1 : Number(sessions) * 0.9)))); };
  const setPay = (i: number, patch: Partial<{ method: PayMethod; amount: string; ref: string }>) => setPays(pays.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const submit = () => { setErr(""); start(async () => { const r = await sellPackage({ customerId, serviceId: svc?.id ?? null, name, sessions: Number(sessions) || 0, price: total, expiresAt: expires || null, staffId: staffId || null, saleDate: todayIso(), payments: effPays.map((p) => ({ method: p.method, amount: Number(p.amount) || 0, ref: p.ref })) }); if (!r.ok) setErr(r.error); else onDone(); }); };
  return (
    <Modal title="Seans paketi sat" onClose={onClose}>
      <div className="grid gap-3">
        <label className="f">Hizmet (isteğe bağlı — paketten düşerken eşleşir)
          <span className="inp"><input value={svc ? svc.name_tr : q} onChange={(e) => { setSvc(null); setQ(e.target.value); }} placeholder="Hizmet ara…" /></span>
        </label>
        {!svc && (q.length >= 2 || list.length > 0) && (
          <div className="grid gap-1 max-h-40 overflow-y-auto border border-line rounded-lg p-1">
            {list.map((s) => <button key={s.id} type="button" className="text-left text-sm px-2 py-1 rounded hover:bg-sunk flex justify-between gap-2" onClick={() => pick(s)}><span className="truncate">{s.name_tr}</span><span className="num text-muted">{s.session_count > 1 ? `${s.session_count} seans · ` : ""}{money(s.price)}</span></button>)}
            {!list.length && <p className="text-xs text-muted px-2">Sonuç yok — hizmetsiz paket de satabilirsin.</p>}
          </div>
        )}
        <label className="f">Paket adı<span className="inp"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Lazer koltuk altı 6 seans" /></span></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="f">Seans<span className="inp"><input inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value)} /></span></label>
          <label className="f">Toplam fiyat<span className="inp"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></span></label>
          <label className="f">Son kullanma<span className="inp"><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></span></label>
        </div>
        <label className="f">Satışı yapan (hak ediş)<span className="inp"><select value={staffId} onChange={(e) => setStaffId(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
        <div className="grid gap-2">
          <div className="eyebrow">Ödeme</div>
          {pays.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <span className="inp"><select value={p.method} onChange={(e) => setPay(i, { method: e.target.value as PayMethod })}>{(Object.keys(METHOD) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD[m]}</option>)}</select></span>
              <span className="inp"><input inputMode="decimal" placeholder={String(Math.max(0, remaining + (Number(p.amount) || 0)))} value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} /></span>
              <button type="button" className="btn ghost sm" onClick={() => setPay(i, { amount: String(Math.max(0, remaining + (Number(p.amount) || 0))) })}>↵</button>
              {p.method === "gift_card" && <span className="inp col-span-3"><input placeholder="Hediye çeki kodu" value={p.ref ?? ""} onChange={(e) => setPay(i, { ref: e.target.value.toUpperCase() })} /></span>}
            </div>
          ))}
          <div className="flex gap-2 items-center"><button type="button" className="btn ghost sm" onClick={() => setPays([...pays, { method: "card", amount: "" }])}>+ Karışık ödeme</button><span className={`ml-auto text-sm num ${Math.abs(remaining) < 0.5 ? "text-good" : "text-bad"}`}>{Math.abs(remaining) < 0.5 ? "Tutar eşleşti" : `Kalan ${money(remaining)}`}</span></div>
        </div>
        {err && <p className="pill bad">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn ghost" onClick={onClose}>Vazgeç</button><button className="btn" disabled={pending || !name || !(total > 0) || Math.abs(remaining) >= 0.5} onClick={submit}>{pending ? "Kaydediliyor…" : "Sat ve kasaya işle"}</button></div>
      </div>
    </Modal>
  );
}

function PointsDialog({ customerId, points, onClose, onDone }: { customerId: string; points: number; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Puan düzelt (mevcut ${points})`} onClose={onClose}>
      <div className="grid gap-3">
        <label className="f">Puan (+ ekle / − düş)<span className="inp"><input inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="ör. 50 veya -20" /></span></label>
        <label className="f">Açıklama<span className="inp"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ör. Instagram paylaşımı" /></span></label>
        <div className="flex justify-end gap-2"><button className="btn ghost" onClick={onClose}>Vazgeç</button><button className="btn" disabled={pending || !Number(delta)} onClick={() => start(async () => { await adjustPoints(customerId, Number(delta), reason); onDone(); })}>Kaydet</button></div>
      </div>
    </Modal>
  );
}
