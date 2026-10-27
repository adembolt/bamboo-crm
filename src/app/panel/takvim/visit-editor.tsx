"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Staff, VisitStatus } from "@/lib/database.types";
import { Modal } from "@/components/modal";
import { ServiceCombobox } from "@/components/service-combobox";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { createClient } from "@/lib/supabase/client";
import { money, hhmm, fmtDate, fmtTime, todayIso, addDays } from "@/lib/format";
import { loadVisitForClose } from "@/app/panel/kasa/actions";
import { CloseDialog } from "@/app/panel/kasa/close-dialog";
import type { DayVisit } from "@/lib/queries/kasa";
import { getVisitDetail, saveVisit, setVisitFlag, repeatVisit, checkPromo, addVisitFile, deleteVisitFile, staffDayItems, quickCustomer, type SaveLine } from "./visit-actions";

type Svc = { id: string; category_id: string | null; code: string | null; name_tr: string; duration_min: number; buffer_min: number; price: number };
type Cat = { id: string; name_tr: string; sort_order: number };
type Detail = Extract<Awaited<ReturnType<typeof getVisitDetail>>, { ok: true }>;
type Line = { key: string; id?: string; serviceId: string | null; serviceName: string; staffId: string | null; time: string; duration: string; price: string; discPct: string; discAmt: string; packageId?: string | null };

const COLORS = ["", "#7cc68d", "#efcf6b", "#93dfd8", "#b394e6", "#ec8a7e", "#c8dc5b", "#86a8ea"];
const REMIND = [{ v: 60, l: "1 saat önce" }, { v: 180, l: "3 saat önce" }, { v: 1440, l: "1 gün önce" }, { v: 2880, l: "2 gün önce" }];
const REVIEW = [{ v: "auto", l: "Otomatik (ayarlara göre)" }, { v: "none", l: "Gönderme" }, { v: "2h", l: "2 saat sonra" }, { v: "24h", l: "1 gün sonra" }];
const DURS = [15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];
const BREAKS = [5, 10, 15, 20, 30, 45, 60];
const ST: Record<VisitStatus, string> = { pending: "Onay bekliyor", confirmed: "Onaylı", arrived: "Geldi", completed: "Tamamlandı", no_show: "Gelmedi", cancelled: "İptal" };
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const r2 = (n: number) => Math.round(n * 100) / 100;
let seq = 0; const k = () => `n${++seq}`;

export function VisitEditor(props: { visitId: string; staff: Staff[]; services: Svc[]; categories: Cat[]; openTime: string; closeTime: string; canWrite: boolean; onClose: () => void }) {
  const { visitId, staff, services, categories, canWrite, onClose } = props;
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // form
  const [date, setDate] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [newCust, setNewCust] = useState<{ first_name: string; last_name: string; phone: string } | null>(null);
  const [anon, setAnon] = useState(false);
  const [status, setStatus] = useState<VisitStatus>("confirmed");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("");
  const [remind, setRemind] = useState<number[]>([]);
  const [remindConfirm, setRemindConfirm] = useState(true);
  const [review, setReview] = useState("auto");
  const [promo, setPromo] = useState("");
  const [promoInfo, setPromoInfo] = useState("");
  const [brk, setBrk] = useState(0);
  const [panel, setPanel] = useState<"" | "history" | "notif" | "audit" | "repeat">("");
  const [repeatDate, setRepeatDate] = useState("");
  const [dayItems, setDayItems] = useState<{ id: string; staffId: string | null; start: string; end: string }[]>([]);
  const [closing, setClosing] = useState<DayVisit | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await getVisitDetail(visitId);
    if (!r.ok) { setLoadErr(r.error); return; }
    setD(r);
    const v = r.visit;
    setDate(v.date); setStatus(v.status); setNotes(v.notes ?? ""); setColor(v.color ?? ""); setAnon(v.isAnonymous);
    setRemind(v.remindOffsets ?? []); setRemindConfirm(v.remindConfirm); setReview(v.reviewRequest || "auto"); setPromo(v.promoCode ?? "");
    setCustomer(r.customer ? { id: r.customer.id, first_name: r.customer.first_name, last_name: r.customer.last_name, phone: r.customer.phone } : null);
    setBrk(r.items.reduce((m, i) => Math.max(m, i.breakMin), 0));
    setLines(r.items.filter((i) => i.status !== "cancelled" || v.status === "cancelled").map((i) => ({
      key: i.id, id: i.id, serviceId: i.serviceId, serviceName: i.serviceName, staffId: i.staffId, time: i.time, duration: String(i.duration),
      price: String(i.price), discPct: i.price > 0 && i.discount > 0 ? String(r2((i.discount / i.price) * 100)) : "0", discAmt: String(i.discount), packageId: i.packageId,
    })));
    setRepeatDate(addDays(v.date, 7));
  }, [visitId]);
  useEffect(() => { const id = setTimeout(() => { load(); }, 0); return () => clearTimeout(id); }, [load]);
  useEffect(() => { if (!date) return; let alive = true; staffDayItems(date).then((x) => { if (alive) setDayItems(x); }); return () => { alive = false; }; }, [date]);

  const sale = d?.sale ?? null;
  const locked = !canWrite || !!sale;
  const svcById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const myIds = new Set(lines.map((l) => l.id).filter(Boolean) as string[]);
  const lineTotal = (l: Line) => Math.max(0, (Number(l.price) || 0) - (Number(l.discAmt) || 0));
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const ordered = [...lines].sort((a, b) => a.time.localeCompare(b.time));
  const lastKey = ordered[ordered.length - 1]?.key;

  function setLine(key: string, patch: Partial<Line>) { setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))); }
  function pickService(key: string, id: string) {
    const s = svcById.get(id); if (!s) return;
    setLines((ls) => ls.map((l) => { if (l.key !== key) return l; const price = Number(s.price); const pct = Number(l.discPct) || 0; return { ...l, serviceId: s.id, serviceName: s.name_tr, duration: String(s.duration_min + (s.buffer_min || 0)), price: String(price), discAmt: String(r2((price * pct) / 100)) }; }));
  }
  function setPct(key: string, v: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, discPct: v, discAmt: String(r2(((Number(l.price) || 0) * (Number(v) || 0)) / 100)) } : l)); }
  function setAmt(key: string, v: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, discAmt: v, discPct: (Number(l.price) || 0) > 0 ? String(r2(((Number(v) || 0) / Number(l.price)) * 100)) : "0" } : l)); }
  function setPrice(key: string, v: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, price: v, discAmt: String(r2(((Number(v) || 0) * (Number(l.discPct) || 0)) / 100)) } : l)); }
  function addLine() {
    const last = ordered[ordered.length - 1];
    const t = last ? hhmm(toMin(last.time) + (Number(last.duration) || 0)) : "10:00";
    setLines((ls) => [...ls, { key: k(), serviceId: null, serviceName: "", staffId: last?.staffId ?? staff[0]?.id ?? null, time: t, duration: "60", price: "0", discPct: "0", discAmt: "0" }]);
  }

  // Planlama için kalan süre: personelin bir sonraki randevusuna / kapanışa
  function freeInfo(l: Line): { text: string; bad: boolean } | null {
    if (!l.staffId || !/^\d{2}:\d{2}$/.test(l.time)) return null;
    const s = toMin(l.time), e = s + (Number(l.duration) || 0) + (l.key === lastKey ? brk : 0);
    const others = [
      ...dayItems.filter((x) => x.staffId === l.staffId && !myIds.has(x.id)).map((x) => ({ s: toMin(x.start), e: toMin(x.end) })),
      ...lines.filter((x) => x.key !== l.key && x.staffId === l.staffId && /^\d{2}:\d{2}$/.test(x.time)).map((x) => ({ s: toMin(x.time), e: toMin(x.time) + (Number(x.duration) || 0) })),
    ];
    if (others.some((o) => o.s < e && o.e > s)) return { text: "Bu saatte personelin başka randevusu var", bad: true };
    const next = others.filter((o) => o.s >= e).sort((a, b) => a.s - b.s)[0];
    const until = next ? next.s : toMin(props.closeTime.slice(0, 5));
    const gap = until - e;
    if (gap < 0) return { text: "Kapanış saatini aşıyor", bad: true };
    const h = Math.floor(gap / 60), m = gap % 60;
    return { text: `Planlamaya kalan süre: ${h ? `${h} sa ` : ""}${m} dk${next ? "" : " (kapanışa)"}`, bad: false };
  }

  async function resolveCustomer(): Promise<string | null | false> {
    if (anon) return null;
    if (customer) return customer.id;
    if (newCust?.first_name?.trim()) {
      const r = await quickCustomer(newCust);
      if (!r.ok) { setErr(r.error); return false; }
      setCustomer(r.customer); return r.customer.id;
    }
    return d?.customer?.id ?? null;
  }

  function payload(customerId: string | null): Parameters<typeof saveVisit>[0] {
    const ls: SaveLine[] = lines.map((l) => ({ id: l.id, serviceId: l.serviceId, serviceName: l.serviceName, staffId: l.staffId, time: l.time, duration: Number(l.duration) || 0, price: Number(l.price) || 0, discount: Number(l.discAmt) || 0 }));
    return { visitId, date, lines: ls, customerId, isAnonymous: anon, status, notes, color, remindOffsets: remind, remindConfirm, reviewRequest: review, promoCode: promo, breakMin: brk };
  }

  function save(after?: () => Promise<void> | void) {
    setErr(""); setMsg("");
    start(async () => {
      const cid = await resolveCustomer(); if (cid === false) return;
      const r = await saveVisit(payload(cid));
      if (!r.ok) { setErr(r.error); return; }
      router.refresh();
      if (after) await after(); else onClose();
    });
  }
  function flag(s: VisitStatus) {
    setErr(""); start(async () => { const r = await setVisitFlag(visitId, s); if (!r.ok) setErr(r.error); else { setStatus(s); router.refresh(); await load(); } });
  }
  function createSale() {
    save(async () => { const r = await loadVisitForClose(visitId); if (!r.ok) setErr(r.error); else setClosing(r.visit); });
  }
  function doRepeat() {
    setErr(""); start(async () => { const r = await repeatVisit(visitId, repeatDate); if (!r.ok) setErr(r.error); else { setMsg(`Randevu ${fmtDate(r.date)} tarihine kopyalandı.`); setPanel(""); router.refresh(); await load(); } });
  }
  function applyPromo() {
    setErr(""); setPromoInfo(""); start(async () => {
      const r = await checkPromo(promo); if (!r.ok) { setPromoInfo(r.error); return; }
      setLines((ls) => ls.map((l) => ({ ...l, discPct: String(r.percent), discAmt: String(r2(((Number(l.price) || 0) * r.percent) / 100)) })));
      setPromoInfo(`%${r.percent} indirim uygulandı${r.description ? ` · ${r.description}` : ""}`);
    });
  }
  async function upload(f: File) {
    setErr("");
    if (f.size > 15 * 1024 * 1024) { setErr("Dosya 15 MB'den büyük olamaz."); return; }
    const sb = createClient();
    const path = `${visitId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await sb.storage.from("visit-files").upload(path, f, { contentType: f.type || undefined });
    if (error) { setErr("Yükleme başarısız: " + error.message); return; }
    const r = await addVisitFile({ visitId, customerId: d?.customer?.id ?? null, path, name: f.name, mime: f.type, size: f.size });
    if (!r.ok) setErr(r.error); else await load();
  }

  if (loadErr) return <Modal title="Randevu" onClose={onClose}><p className="pill bad">{loadErr}</p></Modal>;
  if (!d) return <Modal title="Randevu" onClose={onClose}><p className="text-sm text-muted">Yükleniyor…</p></Modal>;

  const c = d.customer;
  return (
    <Modal wide title="Randevuyu düzenle" onClose={onClose} headerExtra={<span className={`pill ${status === "no_show" || status === "cancelled" ? "bad" : status === "pending" ? "warn" : "good"}`}>{ST[status]}</span>}>
      <div className="grid gap-4">
        {/* Tarih */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="f">Tarih<span className="inp"><input type="date" value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} /></span></label>
          {sale && <span className="pill good">Ödendi · {money(sale.total)} — değiştirmek için kasadan satışı iptal edin</span>}
        </div>

        {/* Hizmet satırları */}
        <div className="grid gap-2 border-y border-line py-3">
          <div className="hidden lg:grid grid-cols-[1.5fr_84px_2.2fr_92px_90px_64px_80px_90px_28px] gap-2 text-[11px] font-semibold text-muted uppercase tracking-wide">
            <span>Uzman</span><span>Saat</span><span>Hizmet</span><span>Süre</span><span>Fiyat</span><span>İnd. %</span><span>İnd. ₺</span><span className="text-right">Toplam</span><span />
          </div>
          {lines.map((l) => { const fi = freeInfo(l); return (
            <div key={l.key} className="grid gap-1">
              <div className="grid grid-cols-6 lg:grid-cols-[1.5fr_84px_2.2fr_92px_90px_64px_80px_90px_28px] gap-2 items-center rounded-xl lg:rounded-none bg-sunk/40 lg:bg-transparent p-2 lg:p-0">
                <span className="inp col-span-3 lg:col-span-1 order-first lg:order-none"><select aria-label="Uzman" value={l.staffId ?? ""} disabled={locked} onChange={(e) => setLine(l.key, { staffId: e.target.value || null })}><option value="">— atanmamış —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span>
                <span className="inp col-span-1 order-first lg:order-none"><input aria-label="Saat" type="time" step={300} value={l.time} disabled={locked} onChange={(e) => setLine(l.key, { time: e.target.value })} /></span>
                <div className="col-span-6 lg:col-span-1 min-w-0"><ServiceCombobox services={services} categories={categories} value={l.serviceId} label={l.serviceName} disabled={locked} onPick={(id) => pickService(l.key, id)} /></div>
                <span className="inp col-span-2 lg:col-span-1 order-first lg:order-none"><select aria-label="Süre" value={l.duration} disabled={locked} onChange={(e) => setLine(l.key, { duration: e.target.value })}>{[...new Set([...DURS, Number(l.duration) || 60])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m >= 60 ? `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60}` : ""}` : `${m} dk`}</option>)}</select></span>
                <span className="inp col-span-2 lg:col-span-1"><input aria-label="Fiyat" inputMode="decimal" className="text-right" value={l.price} disabled={locked} onChange={(e) => setPrice(l.key, e.target.value)} /></span>
                <span className="inp"><input aria-label="İndirim yüzde" inputMode="decimal" className="text-right" value={l.discPct} disabled={locked} onChange={(e) => setPct(l.key, e.target.value)} /></span>
                <span className="inp"><input aria-label="İndirim tutar" inputMode="decimal" className="text-right" value={l.discAmt} disabled={locked} onChange={(e) => setAmt(l.key, e.target.value)} /></span>
                <b className="num text-right col-span-1">{money(lineTotal(l))}</b>
                {!locked && lines.length > 1 ? <button type="button" className="btn ghost sm px-1" aria-label="Satırı kaldır" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>✕</button> : <span />}
              </div>
              {l.packageId && <span className="text-[11px] text-good">Paketten düşüldü</span>}
              {fi && <span className={`text-xs ${fi.bad ? "text-bad" : "text-good"}`}>{fi.text}</span>}
            </div>
          ); })}
          <div className="flex items-center justify-between">
            {!locked ? <button type="button" className="btn ghost sm" onClick={addLine}>+ Hizmet ekle</button> : <span />}
            <span className="text-sm">Toplam <b className="font-display text-xl num ml-1">{money(total)}</b></span>
          </div>
        </div>

        {/* Promo + mola */}
        <div className="grid md:grid-cols-2 gap-3 border-b border-line pb-3">
          <div className="grid gap-1">
            <div className="flex gap-2"><span className="inp flex-1"><input placeholder="Promosyon kodu" value={promo} disabled={locked} onChange={(e) => setPromo(e.target.value.toUpperCase())} /></span><button type="button" className="btn ghost sm" disabled={locked || !promo || pending} onClick={applyPromo}>Uygula</button></div>
            {promoInfo && <span className="text-xs text-muted">{promoInfo}</span>}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={brk > 0} disabled={locked} onChange={(e) => setBrk(e.target.checked ? 15 : 0)} /> Randevu sonrası mola</label>
            <span className="inp"><select value={brk || ""} disabled={locked || !brk} onChange={(e) => setBrk(Number(e.target.value))}><option value="">—</option>{BREAKS.map((b) => <option key={b} value={b}>{b} dk</option>)}</select></span>
          </div>
        </div>

        {/* Müşteri + durum */}
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-4 border-b border-line pb-3">
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-muted">Müşteri</div>
            {anon ? <p className="rounded-xl bg-sunk px-3 py-2 text-sm text-muted">Anonim randevu (müşteri kaydı yok)</p> : (
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">{locked && customer ? <div className="rounded-xl bg-green-soft px-3 py-2 font-semibold">{customer.first_name} {customer.last_name}</div> : <CustomerPicker value={customer} onChange={setCustomer} onNew={setNewCust} />}</div>
                {c && customer?.id === c.id && <a href={`/panel/musteriler/${c.id}`} target="_blank" rel="noreferrer" className="btn ghost sm" title="Müşteri kartı">i</a>}
              </div>
            )}
            {c && !anon && customer?.id === c.id && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {c.phone && <a className="hover:underline" href={`tel:${c.phone}`}>{c.phone}</a>}
                {c.no_show_count > 0 && <span className="text-bad">{c.no_show_count} kez gelmedi</span>}
                {Number(c.balance) > 0 && <span className="text-good">Bakiye {money(c.balance)}</span>}
                {c.loyalty_points > 0 && <span>★ {c.loyalty_points} puan</span>}
                <button type="button" className="text-green font-semibold hover:underline" onClick={() => setPanel(panel === "history" ? "" : "history")}>Randevu geçmişi ({d.history.length})</button>
              </div>
            )}
            {c?.health_notes && !anon && <p className="text-xs rounded-lg bg-warn-bg px-2 py-1"><b>Sağlık notu:</b> {c.health_notes}</p>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anon} disabled={locked} onChange={(e) => setAnon(e.target.checked)} /> Anonim</label>
          </div>
          <div className="grid gap-2 content-start">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={status !== "pending"} disabled={locked || ["arrived", "completed", "no_show", "cancelled"].includes(status)} onChange={(e) => setStatus(e.target.checked ? "confirmed" : "pending")} /> Onaylandı</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`btn ${status === "arrived" ? "" : "ghost"}`} disabled={locked || pending || status === "completed"} onClick={() => flag("arrived")}>Geldi</button>
              <button type="button" className={`btn ${status === "no_show" ? "danger" : "ghost"}`} disabled={locked || pending || status === "completed"} onClick={() => flag("no_show")}>Gelmedi</button>
            </div>
          </div>
        </div>

        {panel === "history" && (
          <div className="rounded-xl border border-line p-2 grid gap-1 max-h-56 overflow-y-auto text-sm">
            {!d.history.length && <p className="text-muted px-1">Önceki randevu yok.</p>}
            {d.history.map((h) => (
              <a key={h.id} href={`/panel/takvim?d=${h.date}`} className="grid grid-cols-[84px_1fr_auto] gap-2 px-1 py-1 rounded hover:bg-sunk">
                <span className="num text-muted">{fmtDate(h.date)}</span>
                <span className="truncate">{h.services}{h.staff ? <span className="text-muted"> · {h.staff}</span> : null} <span className={`text-[11px] ${h.status === "no_show" || h.status === "cancelled" ? "text-bad" : "text-muted"}`}>({ST[h.status as VisitStatus] ?? h.status})</span></span>
                <span className="num">{money(h.total)}</span>
              </a>
            ))}
          </div>
        )}

        {/* Bildirimler */}
        <div className="grid md:grid-cols-2 gap-4 border-b border-line pb-3">
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-muted">Hatırlatma bildirimleri</div>
            <div className="flex flex-wrap gap-1.5">{REMIND.map((o) => { const on = remind.includes(o.v); return <button key={o.v} type="button" disabled={locked} className={`pill ${on ? "good" : ""}`} onClick={() => setRemind(on ? remind.filter((x) => x !== o.v) : [...remind, o.v].sort((a, b) => a - b))}>{on ? "✓ " : ""}{o.l}</button>; })}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remindConfirm} disabled={locked} onChange={(e) => setRemindConfirm(e.target.checked)} /> Onay iste (müşteri “geliyorum” desin)</label>
            <button type="button" className="text-xs text-green font-semibold hover:underline justify-self-start" onClick={() => setPanel(panel === "notif" ? "" : "notif")}>Bildirim geçmişi ({d.messages.length})</button>
          </div>
          <label className="f content-start">Yorum ve bahşiş isteği<span className="inp"><select value={review} disabled={locked} onChange={(e) => setReview(e.target.value)}>{REVIEW.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></span></label>
        </div>
        {panel === "notif" && (
          <div className="rounded-xl border border-line p-2 grid gap-1 max-h-56 overflow-y-auto text-sm">
            {!d.messages.length && <p className="text-muted px-1">Bu randevu için gönderilmiş mesaj yok.</p>}
            {d.messages.map((m, i) => <div key={i} className="px-1 py-1 border-b border-dashed border-line last:border-0"><span className="text-xs text-muted">{fmtDate(m.sent_at)} {fmtTime(m.sent_at)} · {m.kind} · {m.channel}</span><p className="text-sm">{m.body}</p></div>)}
          </div>
        )}

        {/* Yorum + renk + dosyalar */}
        <div className="grid md:grid-cols-2 gap-4">
          <label className="f">Yorum<textarea className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm min-h-[84px]" placeholder="Müşteri istekleri, yönetici notları" value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="grid gap-2 content-start">
            <div className="text-xs font-semibold text-muted">Randevu rengi</div>
            <div className="flex flex-wrap gap-2">{COLORS.map((col) => (
              <button key={col || "none"} type="button" disabled={locked} aria-label={col ? `Renk ${col}` : "Varsayılan renk"} onClick={() => setColor(col)}
                className={`w-8 h-8 rounded-full border-2 grid place-items-center text-xs ${color === col ? "border-ink" : "border-transparent"}`} style={{ background: col || "var(--sunk)" }}>{color === col ? "✓" : col ? "" : "—"}</button>
            ))}</div>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) start(() => upload(f)); e.target.value = ""; }} />
            <button type="button" className="btn ghost" disabled={!canWrite || pending} onClick={() => fileRef.current?.click()}>＋ Dosya ekle</button>
            <span className="text-xs text-muted">PDF, XLS, PNG, JPG · en fazla 15 MB</span>
          </div>
          {d.files.length > 0 && <div className="flex flex-wrap gap-2">{d.files.map((f) => (
            <span key={f.id} className="pill gap-2">
              {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="hover:underline">{f.file_name}</a> : f.file_name}
              {canWrite && <button type="button" aria-label="Dosyayı sil" className="text-bad" onClick={() => { if (confirm(`${f.file_name} silinsin mi?`)) start(async () => { await deleteVisitFile(f.id); await load(); }); }}>✕</button>}
            </span>
          ))}</div>}
        </div>

        {panel === "audit" && (
          <div className="rounded-xl border border-line p-2 grid gap-1 max-h-56 overflow-y-auto text-sm">
            <div className="text-xs text-muted px-1">Oluşturuldu: {fmtDate(d.visit.createdAt)} {fmtTime(d.visit.createdAt)} · kaynak: {d.visit.source}</div>
            {!d.audit.length && <p className="text-muted px-1">Henüz değişiklik kaydı yok.</p>}
            {d.audit.map((a, i) => <div key={i} className="px-1 py-1 border-b border-dashed border-line last:border-0"><span className="text-xs text-muted">{fmtDate(a.created_at)} {fmtTime(a.created_at)}{a.actor ? ` · ${a.actor}` : ""}</span> <b>{a.action}</b><div className="text-xs">{Array.isArray(a.diff) ? (a.diff as string[]).join(" · ") : a.diff && typeof a.diff === "object" ? Object.entries(a.diff as Record<string, unknown>).map(([kk, vv]) => `${kk}: ${String(vv)}`).join(" · ") : ""}</div></div>)}
          </div>
        )}
        {panel === "repeat" && (
          <div className="rounded-xl border border-line p-3 flex flex-wrap items-end gap-2">
            <label className="f">Yeni tarih<span className="inp"><input type="date" min={todayIso()} value={repeatDate} onChange={(e) => setRepeatDate(e.target.value)} /></span></label>
            {[7, 14, 21, 28].map((n) => <button key={n} type="button" className="btn ghost sm" onClick={() => setRepeatDate(addDays(date, n))}>+{n / 7} hafta</button>)}
            <button type="button" className="btn sm" disabled={pending || !repeatDate} onClick={doRepeat}>Aynı saat ve uzmanla kopyala</button>
          </div>
        )}

        {err && <p className="pill bad">{err}</p>}
        {msg && <p className="pill good">{msg}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button type="button" className="text-sm text-green font-semibold hover:underline" onClick={() => setPanel(panel === "audit" ? "" : "audit")}>Değişiklik geçmişi</button>
          <span className="flex-1" />
          {canWrite && !sale && status !== "cancelled" && <button type="button" className="text-sm text-bad font-semibold hover:underline px-2" disabled={pending} onClick={() => { if (confirm("Randevu iptal edilsin mi?")) flag("cancelled"); }}>Randevuyu iptal et</button>}
          {canWrite && <button type="button" className="btn ghost" disabled={pending} onClick={() => setPanel(panel === "repeat" ? "" : "repeat")}>Randevuyu tekrarla</button>}
          {canWrite && !sale && status !== "cancelled" && <button type="button" className="btn" style={{ background: "var(--good)" }} disabled={pending} onClick={createSale}>Satış oluştur</button>}
          {!locked && <button type="button" className="btn" disabled={pending} onClick={() => save()}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>}
        </div>
      </div>
      {closing && <CloseDialog v={closing} staffName={(id) => staff.find((s) => s.id === id)?.full_name ?? "—"} onClose={() => setClosing(null)} onDone={() => { setClosing(null); router.refresh(); onClose(); }} />}
    </Modal>
  );
}
