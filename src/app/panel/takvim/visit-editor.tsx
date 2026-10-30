"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Staff, VisitStatus } from "@/lib/database.types";
import { Modal } from "@/components/modal";
import { TopUpDialog } from "@/components/topup-dialog";
import { ServiceCombobox } from "@/components/service-combobox";
import { FormHints } from "./form-hints";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { createClient } from "@/lib/supabase/client";
import { money, hhmm, fmtDate, fmtTime, todayIso, addDays, duration, minLabel } from "@/lib/format";
import { useT, useLang } from "@/lib/i18n/client";
import { loadVisitForClose } from "@/app/panel/kasa/actions";
import { CloseDialog } from "@/app/panel/kasa/close-dialog";
import type { DayVisit } from "@/lib/queries/kasa";
import { getVisitDetail, saveVisit, repeatVisit, checkPromo, addVisitFile, deleteVisitFile, staffDayItems, quickCustomer, type SaveLine } from "./visit-actions";

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
type SnapIn = { date: string; status: string; notes: string; color: string; anon: boolean; remind: number[]; remindConfirm: boolean; review: string; promo: string; brk: number; customerId: string | null; newName: string; lines: Line[] };
const snapOf = (x: SnapIn) => JSON.stringify([x.date, x.status, x.notes, x.color, x.anon, x.remind, x.remindConfirm, x.review, x.promo, x.brk, x.customerId, x.newName, x.lines.map((l) => [l.id, l.serviceId, l.serviceName, l.staffId, l.time, l.duration, l.price, l.discAmt])]);

export function VisitEditor(props: { visitId: string; staff: Staff[]; services: Svc[]; categories: Cat[]; staffServices: Record<string, string[]>; overrides?: Record<string, { p: number | null; d: number | null }>; openTime: string; closeTime: string; canWrite: boolean; onClose: () => void }) {
  const { visitId, staff, services, categories, canWrite, onClose } = props;
  const router = useRouter();
  const t = useT();
  const lang = useLang();
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
  const [newFiles, setNewFiles] = useState<File[]>([]);          // Kaydet'e basınca yüklenecek
  const [delFiles, setDelFiles] = useState<Set<string>>(new Set()); // Kaydet'e basınca silinecek
  const [initialSnap, setInitialSnap] = useState("");
  const [topUp, setTopUp] = useState(false);
  const [extraBalance, setExtraBalance] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // resetForm=false: yalnızca ek bilgileri (dosyalar, geçmiş, mesajlar) yeniler; kaydedilmemiş form değişikliklerine dokunmaz
  const load = useCallback(async (resetForm = true) => {
    const r = await getVisitDetail(visitId);
    if (!r.ok) { setLoadErr(r.error); return; }
    setD(r);
    if (!resetForm) return;
    const v = r.visit;
    setDate(v.date); setStatus(v.status); setNotes(v.notes ?? ""); setColor(v.color ?? ""); setAnon(v.isAnonymous);
    setRemind(v.remindOffsets ?? []); setRemindConfirm(v.remindConfirm); setReview(v.reviewRequest || "auto"); setPromo(v.promoCode ?? "");
    setCustomer(r.customer ? { id: r.customer.id, first_name: r.customer.first_name, last_name: r.customer.last_name, phone: r.customer.phone } : null);
    setBrk(r.items.reduce((m, i) => Math.max(m, i.breakMin), 0));
    const ls: Line[] = r.items.filter((i) => i.status !== "cancelled" || v.status === "cancelled").map((i) => ({
      key: i.id, id: i.id, serviceId: i.serviceId, serviceName: i.serviceName, staffId: i.staffId, time: i.time, duration: String(i.duration),
      price: String(i.price), discPct: i.price > 0 && i.discount > 0 ? String(r2((i.discount / i.price) * 100)) : "0", discAmt: String(i.discount), packageId: i.packageId,
    }));
    setLines(ls);
    const b = r.items.reduce((m, i) => Math.max(m, i.breakMin), 0);
    setInitialSnap(snapOf({ date: v.date, status: v.status, notes: v.notes ?? "", color: v.color ?? "", anon: v.isAnonymous, remind: v.remindOffsets ?? [], remindConfirm: v.remindConfirm, review: v.reviewRequest || "auto", promo: v.promoCode ?? "", brk: b, customerId: r.customer?.id ?? null, newName: "", lines: ls }));
    setRepeatDate(addDays(v.date, 7));
    setNewFiles([]); setDelFiles(new Set());
  }, [visitId]);
  useEffect(() => { const id = setTimeout(() => { load(); }, 0); return () => clearTimeout(id); }, [load]);
  useEffect(() => { if (!date) return; let alive = true; staffDayItems(date).then((x) => { if (alive) setDayItems(x); }); return () => { alive = false; }; }, [date]);

  const snap = snapOf({ date, status, notes, color, anon, remind, remindConfirm, review, promo, brk, customerId: anon ? null : customer?.id ?? null, newName: newCust?.first_name ?? "", lines });
  const dirty = !!initialSnap && (snap !== initialSnap || newFiles.length > 0 || delFiles.size > 0);
  const tryClose = () => { if (dirty && !confirm(t("Kaydedilmemiş değişiklikler var. Kaydetmeden kapatılsın mı?"))) return; onClose(); };
  const sale = d?.sale ?? null;
  const locked = !canWrite || !!sale;
  const servicesFor = (staffId: string | null) => { const a = staffId ? props.staffServices[staffId] : undefined; return a?.length ? services.filter((s) => a.includes(s.id) || s.id === lines.find((l) => l.staffId === staffId)?.serviceId) : services; };
  const notAllowed = (l: Line) => !!(l.staffId && l.serviceId && props.staffServices[l.staffId]?.length && !props.staffServices[l.staffId].includes(l.serviceId));
  const svcById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const myIds = new Set(lines.map((l) => l.id).filter(Boolean) as string[]);
  const lineTotal = (l: Line) => Math.max(0, (Number(l.price) || 0) - (Number(l.discAmt) || 0));
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const ordered = [...lines].sort((a, b) => a.time.localeCompare(b.time));
  const lastKey = ordered[ordered.length - 1]?.key;

  function setLine(key: string, patch: Partial<Line>) { setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))); }
  function pickService(key: string, id: string) {
    const s = svcById.get(id); if (!s) return;
    setLines((ls) => ls.map((l) => { if (l.key !== key) return l; const ov = l.staffId ? props.overrides?.[`${l.staffId}:${s.id}`] : undefined; const price = Number(ov?.p ?? s.price); const pct = Number(l.discPct) || 0; return { ...l, serviceId: s.id, serviceName: s.name_tr, duration: String((ov?.d ?? s.duration_min) + (s.buffer_min || 0)), price: String(price), discAmt: String(r2((price * pct) / 100)) }; }));
  }
  function setPct(key: string, v: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, discPct: v, discAmt: String(r2(((Number(l.price) || 0) * (Number(v) || 0)) / 100)) } : l)); }
  function setAmt(key: string, v: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, discAmt: v, discPct: (Number(l.price) || 0) > 0 ? String(r2(((Number(v) || 0) / Number(l.price)) * 100)) : "0" } : l)); }
  function setPrice(key: string, v: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, price: v, discAmt: String(r2(((Number(v) || 0) * (Number(l.discPct) || 0)) / 100)) } : l)); }
  function addLine() {
    const last = ordered[ordered.length - 1];
    const tm = last ? hhmm(toMin(last.time) + (Number(last.duration) || 0)) : "10:00";
    setLines((ls) => [...ls, { key: k(), serviceId: null, serviceName: "", staffId: last?.staffId ?? staff[0]?.id ?? null, time: tm, duration: "60", price: "0", discPct: "0", discAmt: "0" }]);
  }

  // Planlama için kalan süre: personelin bir sonraki randevusuna / kapanışa
  function freeInfo(l: Line): { text: string; bad: boolean } | null {
    if (!l.staffId || !/^\d{2}:\d{2}$/.test(l.time)) return null;
    const s = toMin(l.time), e = s + (Number(l.duration) || 0) + (l.key === lastKey ? brk : 0);
    const others = [
      ...dayItems.filter((x) => x.staffId === l.staffId && !myIds.has(x.id)).map((x) => ({ s: toMin(x.start), e: toMin(x.end) })),
      ...lines.filter((x) => x.key !== l.key && x.staffId === l.staffId && /^\d{2}:\d{2}$/.test(x.time)).map((x) => ({ s: toMin(x.time), e: toMin(x.time) + (Number(x.duration) || 0) })),
    ];
    if (others.some((o) => o.s < e && o.e > s)) return { text: t("Bu saatte personelin başka randevusu var"), bad: true };
    const next = others.filter((o) => o.s >= e).sort((a, b) => a.s - b.s)[0];
    const until = next ? next.s : toMin(props.closeTime.slice(0, 5));
    const gap = until - e;
    if (gap < 0) return { text: t("Kapanış saatini aşıyor"), bad: true };
    return { text: t(next ? "Planlamaya kalan süre: {d}" : "Planlamaya kalan süre: {d} (kapanışa)", { d: duration(gap, lang) }), bad: false };
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
      for (const f of newFiles) { const e = await uploadNow(f, cid); if (e) { setErr(e); return; } }
      for (const id of delFiles) await deleteVisitFile(id);
      setNewFiles([]); setDelFiles(new Set()); setInitialSnap(snap);
      router.refresh();
      if (after) await after(); else onClose();
    });
  }
  // Durum düğmeleri yalnızca formu değiştirir; Kaydet'e basılınca yazılır
  function flag(s: VisitStatus) { setErr(""); setStatus((cur) => (cur === s ? "confirmed" : s)); }
  function createSale() {
    const open = async () => { const r = await loadVisitForClose(visitId); if (!r.ok) setErr(r.error); else setClosing(r.visit); };
    if (dirty) { if (confirm(t("Kaydedilmemiş değişiklikler var. Önce kaydedilip ödeme ekranı açılsın mı?"))) save(open); }
    else start(open);
  }
  function doRepeat() {
    setErr(""); start(async () => { const r = await repeatVisit(visitId, repeatDate); if (!r.ok) setErr(r.error); else { setMsg(t("Randevu {date} tarihine kopyalandı.", { date: fmtDate(r.date) })); setPanel(""); router.refresh(); await load(false); } });
  }
  function applyPromo() {
    setErr(""); setPromoInfo(""); start(async () => {
      const r = await checkPromo(promo); if (!r.ok) { setPromoInfo(r.error); return; }
      setLines((ls) => ls.map((l) => ({ ...l, discPct: String(r.percent), discAmt: String(r2(((Number(l.price) || 0) * r.percent) / 100)) })));
      setPromoInfo(t("%{p} indirim uygulandı", { p: r.percent }) + (r.description ? ` · ${r.description}` : ""));
    });
  }
  function addFile(f: File) {
    setErr("");
    if (f.size > 15 * 1024 * 1024) { setErr(t("Dosya 15 MB'den büyük olamaz.")); return; }
    setNewFiles((x) => [...x, f]);
  }
  async function uploadNow(f: File, customerId: string | null): Promise<string | null> {
    const sb = createClient();
    const path = `${visitId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await sb.storage.from("visit-files").upload(path, f, { contentType: f.type || undefined });
    if (error) return t("Yükleme başarısız: {e}", { e: error.message });
    const r = await addVisitFile({ visitId, customerId, path, name: f.name, mime: f.type, size: f.size });
    return r.ok ? null : r.error;
  }

  if (loadErr) return <Modal title={t("Randevu")} onClose={onClose}><p className="pill bad">{loadErr}</p></Modal>;
  if (!d) return <Modal title={t("Randevu")} onClose={onClose}><p className="text-sm text-muted">{t("Yükleniyor…")}</p></Modal>;

  const c = d.customer;
  return (
    <Modal wide title={t("Randevuyu düzenle")} onClose={tryClose} headerExtra={<>{dirty && <span className="pill warn">{t("Kaydedilmedi")}</span>}<span className={`pill ${status === "no_show" || status === "cancelled" ? "bad" : status === "pending" ? "warn" : "good"}`}>{t(ST[status])}</span></>}>
      <div className="grid gap-4">
        {/* Tarih */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="f">{t("Tarih")}<span className="inp"><input type="date" value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} /></span></label>
          {sale && <span className="pill good">{t("Ödendi · {sum} — değiştirmek için kasadan satışı iptal edin", { sum: money(sale.total) })}</span>}
        </div>

        {/* Hizmet satırları */}
        <div className="grid gap-2 border-y border-line py-3">
          <div className="hidden lg:grid grid-cols-[1.5fr_84px_2.2fr_92px_90px_64px_80px_90px_28px] gap-2 text-[11px] font-semibold text-muted uppercase tracking-wide">
            <span>{t("Uzman")}</span><span>{t("Saat")}</span><span>{t("Hizmet")}</span><span>{t("Süre")}</span><span>{t("Fiyat")}</span><span>{t("İnd. %")}</span><span>{t("İnd. ₺")}</span><span className="text-right">{t("Toplam")}</span><span />
          </div>
          {lines.map((l) => { const fi = freeInfo(l); return (
            <div key={l.key} className="grid gap-1">
              <div className="grid grid-cols-6 lg:grid-cols-[1.5fr_84px_2.2fr_92px_90px_64px_80px_90px_28px] gap-2 items-center rounded-xl lg:rounded-none bg-sunk/40 lg:bg-transparent p-2 lg:p-0">
                <span className="inp col-span-3 lg:col-span-1 order-first lg:order-none"><select aria-label={t("Uzman")} value={l.staffId ?? ""} disabled={locked} onChange={(e) => setLine(l.key, { staffId: e.target.value || null })}><option value="">{t("— atanmamış —")}</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span>
                <span className="inp col-span-1 order-first lg:order-none"><input aria-label={t("Saat")} type="time" step={300} value={l.time} disabled={locked} onChange={(e) => setLine(l.key, { time: e.target.value })} /></span>
                <div className="col-span-6 lg:col-span-1 min-w-0"><ServiceCombobox services={servicesFor(l.staffId)} categories={categories} value={l.serviceId} label={l.serviceName} disabled={locked} onPick={(id) => pickService(l.key, id)} /></div>
                <span className="inp col-span-2 lg:col-span-1 order-first lg:order-none"><select aria-label={t("Süre")} value={l.duration} disabled={locked} onChange={(e) => setLine(l.key, { duration: e.target.value })}>{[...new Set([...DURS, Number(l.duration) || 60])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{duration(m, lang)}</option>)}</select></span>
                <span className="inp col-span-2 lg:col-span-1"><input aria-label={t("Fiyat")} inputMode="decimal" className="text-right" value={l.price} disabled={locked} onChange={(e) => setPrice(l.key, e.target.value)} /></span>
                <span className="inp"><input aria-label={t("İndirim yüzde")} inputMode="decimal" className="text-right" value={l.discPct} disabled={locked} onChange={(e) => setPct(l.key, e.target.value)} /></span>
                <span className="inp"><input aria-label={t("İndirim tutar")} inputMode="decimal" className="text-right" value={l.discAmt} disabled={locked} onChange={(e) => setAmt(l.key, e.target.value)} /></span>
                <b className="num text-right col-span-1">{money(lineTotal(l))}</b>
                {!locked && lines.length > 1 ? <button type="button" className="btn ghost sm px-1" aria-label={t("Satırı kaldır")} onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>✕</button> : <span />}
              </div>
              {l.packageId && <span className="text-[11px] text-good">{t("Paketten düşüldü")}</span>}
              {notAllowed(l) && <span className="text-xs text-warn">{t("Bu uzmanın hizmet listesinde bu işlem yok (Personel → Hizmetler).")}</span>}
              {fi && <span className={`text-xs ${fi.bad ? "text-bad" : "text-good"}`}>{fi.text}</span>}
            </div>
          ); })}
          <div className="flex items-center justify-between">
            {!locked ? <button type="button" className="btn ghost sm" onClick={addLine}>{t("+ Hizmet ekle")}</button> : <span />}
            <span className="text-sm">{t("Toplam")} <b className="font-display text-xl num ml-1">{money(total)}</b></span>
          </div>
        </div>

        {/* Promo + mola */}
        <div className="grid md:grid-cols-2 gap-3 border-b border-line pb-3">
          <div className="grid gap-1">
            <div className="flex gap-2"><span className="inp flex-1"><input placeholder={t("Promosyon kodu")} value={promo} disabled={locked} onChange={(e) => setPromo(e.target.value.toUpperCase())} /></span><button type="button" className="btn ghost sm" disabled={locked || !promo || pending} onClick={applyPromo}>{t("Uygula")}</button></div>
            {promoInfo && <span className="text-xs text-muted">{promoInfo}</span>}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={brk > 0} disabled={locked} onChange={(e) => setBrk(e.target.checked ? 15 : 0)} /> {t("Randevu sonrası mola")}</label>
            <span className="inp"><select value={brk || ""} disabled={locked || !brk} onChange={(e) => setBrk(Number(e.target.value))}><option value="">—</option>{BREAKS.map((b) => <option key={b} value={b}>{b} {minLabel(lang)}</option>)}</select></span>
          </div>
        </div>

        {/* Müşteri + durum */}
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-4 border-b border-line pb-3">
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-muted">{t("Müşteri")}</div>
            {anon ? <p className="rounded-xl bg-sunk px-3 py-2 text-sm text-muted">{t("Anonim randevu (müşteri kaydı yok)")}</p> : (
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">{locked && customer ? <div className="rounded-xl bg-green-soft px-3 py-2 font-semibold">{customer.first_name} {customer.last_name}</div> : <CustomerPicker value={customer} onChange={setCustomer} onNew={setNewCust} />}</div>
                {c && customer?.id === c.id && <a href={`/panel/musteriler/${c.id}`} target="_blank" rel="noreferrer" className="btn ghost sm" title={t("Müşteri kartı")}>i</a>}
              </div>
            )}
            {c && !anon && customer?.id === c.id && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {c.phone && <a className="hover:underline" href={`tel:${c.phone}`}>{c.phone}</a>}
                {c.no_show_count > 0 && <span className="text-bad">{t("{n} kez gelmedi", { n: c.no_show_count })}</span>}
                <span className={Number(c.balance) + extraBalance > 0 ? "text-good font-semibold" : ""}>{t("Bakiye {sum}", { sum: money(Number(c.balance) + extraBalance) })}</span>
                {canWrite && <button type="button" className="text-green font-semibold hover:underline" onClick={() => setTopUp(true)}>{t("+ Bakiye yükle")}</button>}
                {c.loyalty_points > 0 && <span>★ {t("{n} puan", { n: c.loyalty_points })}</span>}
                <button type="button" className="text-green font-semibold hover:underline" onClick={() => setPanel(panel === "history" ? "" : "history")}>{t("Randevu geçmişi ({n})", { n: d.history.length })}</button>
              </div>
            )}
            {c?.health_notes && !anon && <p className="text-xs rounded-lg bg-warn-bg px-2 py-1"><b>{t("Sağlık notu:")}</b> {c.health_notes}</p>}
            {c && !anon && customer?.id === c.id && <FormHints customerId={c.id} visitId={visitId} flags={c.health_flags ?? []} forms={d.forms} services={lines.map((l) => l.serviceName)} />}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anon} disabled={locked} onChange={(e) => setAnon(e.target.checked)} /> {t("Anonim")}</label>
          </div>
          <div className="grid gap-2 content-start">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={status !== "pending"} disabled={locked || ["arrived", "completed", "no_show", "cancelled"].includes(status)} onChange={(e) => setStatus(e.target.checked ? "confirmed" : "pending")} /> {t("Onaylandı")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`btn ${status === "arrived" ? "" : "ghost"}`} disabled={locked || pending || status === "completed"} onClick={() => flag("arrived")}>{t("Geldi")}</button>
              <button type="button" className={`btn ${status === "no_show" ? "danger" : "ghost"}`} disabled={locked || pending || status === "completed"} onClick={() => flag("no_show")}>{t("Gelmedi")}</button>
            </div>
          </div>
        </div>

        {panel === "history" && (
          <div className="rounded-xl border border-line p-2 grid gap-1 max-h-56 overflow-y-auto text-sm">
            {!d.history.length && <p className="text-muted px-1">{t("Önceki randevu yok.")}</p>}
            {d.history.map((h) => (
              <a key={h.id} href={`/panel/takvim?d=${h.date}`} className="grid grid-cols-[84px_1fr_auto] gap-2 px-1 py-1 rounded hover:bg-sunk">
                <span className="num text-muted">{fmtDate(h.date)}</span>
                <span className="truncate">{h.services}{h.staff ? <span className="text-muted"> · {h.staff}</span> : null} <span className={`text-[11px] ${h.status === "no_show" || h.status === "cancelled" ? "text-bad" : "text-muted"}`}>({ST[h.status as VisitStatus] ? t(ST[h.status as VisitStatus]) : h.status})</span></span>
                <span className="num">{money(h.total)}</span>
              </a>
            ))}
          </div>
        )}

        {/* Bildirimler */}
        <div className="grid md:grid-cols-2 gap-4 border-b border-line pb-3">
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-muted">{t("Hatırlatma bildirimleri")}</div>
            <div className="flex flex-wrap gap-1.5">{REMIND.map((o) => { const on = remind.includes(o.v); return <button key={o.v} type="button" disabled={locked} className={`pill ${on ? "good" : ""}`} onClick={() => setRemind(on ? remind.filter((x) => x !== o.v) : [...remind, o.v].sort((a, b) => a - b))}>{on ? "✓ " : ""}{t(o.l)}</button>; })}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remindConfirm} disabled={locked} onChange={(e) => setRemindConfirm(e.target.checked)} /> {t("Onay iste (müşteri “geliyorum” desin)")}</label>
            <button type="button" className="text-xs text-green font-semibold hover:underline justify-self-start" onClick={() => setPanel(panel === "notif" ? "" : "notif")}>{t("Bildirim geçmişi ({n})", { n: d.messages.length })}</button>
          </div>
          <label className="f content-start">{t("Yorum ve bahşiş isteği")}<span className="inp"><select value={review} disabled={locked} onChange={(e) => setReview(e.target.value)}>{REVIEW.map((o) => <option key={o.v} value={o.v}>{t(o.l)}</option>)}</select></span></label>
        </div>
        {panel === "notif" && (
          <div className="rounded-xl border border-line p-2 grid gap-1 max-h-56 overflow-y-auto text-sm">
            {!d.messages.length && <p className="text-muted px-1">{t("Bu randevu için gönderilmiş mesaj yok.")}</p>}
            {d.messages.map((m, i) => <div key={i} className="px-1 py-1 border-b border-dashed border-line last:border-0"><span className="text-xs text-muted">{fmtDate(m.sent_at)} {fmtTime(m.sent_at)} · {m.kind} · {m.channel}</span><p className="text-sm">{m.body}</p></div>)}
          </div>
        )}

        {/* Yorum + renk + dosyalar */}
        <div className="grid md:grid-cols-2 gap-4">
          <label className="f">{t("Yorum")}<textarea className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm min-h-[84px]" placeholder={t("Müşteri istekleri, yönetici notları")} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="grid gap-2 content-start">
            <div className="text-xs font-semibold text-muted">{t("Randevu rengi")}</div>
            <div className="flex flex-wrap gap-2">{COLORS.map((col) => (
              <button key={col || "none"} type="button" disabled={locked} aria-label={col ? t("Renk {c}", { c: col }) : t("Varsayılan renk")} onClick={() => setColor(col)}
                className={`w-8 h-8 rounded-full border-2 grid place-items-center text-xs ${color === col ? "border-ink" : "border-transparent"}`} style={{ background: col || "var(--sunk)" }}>{color === col ? "✓" : col ? "" : "—"}</button>
            ))}</div>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f); e.target.value = ""; }} />
            <button type="button" className="btn ghost" disabled={!canWrite || pending} onClick={() => fileRef.current?.click()}>{t("＋ Dosya ekle")}</button>
            <span className="text-xs text-muted">{t("PDF, XLS, PNG, JPG · en fazla 15 MB")}</span>
          </div>
          {(d.files.length > 0 || newFiles.length > 0) && <div className="flex flex-wrap gap-2">
            {d.files.map((f) => { const gone = delFiles.has(f.id); return (
              <span key={f.id} className={`pill gap-2 ${gone ? "line-through opacity-60" : ""}`} title={gone ? t("Kaydet'e basınca silinecek") : ""}>
                {f.url && !gone ? <a href={f.url} target="_blank" rel="noreferrer" className="hover:underline">{f.file_name}</a> : f.file_name}
                {canWrite && <button type="button" aria-label={gone ? t("Silmeyi geri al") : t("Dosyayı sil")} className={gone ? "text-good" : "text-bad"} onClick={() => setDelFiles((x) => { const n = new Set(x); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })}>{gone ? "↺" : "✕"}</button>}
              </span>
            ); })}
            {newFiles.map((f, i) => (
              <span key={`new${i}`} className="pill warn gap-2" title={t("Kaydet'e basınca yüklenecek")}>⬆ {f.name}
                <button type="button" aria-label={t("Eklemekten vazgeç")} className="text-bad" onClick={() => setNewFiles((x) => x.filter((_, j) => j !== i))}>✕</button>
              </span>
            ))}
          </div>}
        </div>

        {panel === "audit" && (
          <div className="rounded-xl border border-line p-2 grid gap-1 max-h-56 overflow-y-auto text-sm">
            <div className="text-xs text-muted px-1">{t("Oluşturuldu: {when} · kaynak: {src}", { when: `${fmtDate(d.visit.createdAt)} ${fmtTime(d.visit.createdAt)}`, src: d.visit.source })}</div>
            {!d.audit.length && <p className="text-muted px-1">{t("Henüz değişiklik kaydı yok.")}</p>}
            {d.audit.map((a, i) => <div key={i} className="px-1 py-1 border-b border-dashed border-line last:border-0"><span className="text-xs text-muted">{fmtDate(a.created_at)} {fmtTime(a.created_at)}{a.actor ? ` · ${a.actor}` : ""}</span> <b>{t(a.action)}</b><div className="text-xs">{Array.isArray(a.diff) ? (a.diff as string[]).join(" · ") : a.diff && typeof a.diff === "object" ? Object.entries(a.diff as Record<string, unknown>).map(([kk, vv]) => `${kk}: ${String(vv)}`).join(" · ") : ""}</div></div>)}
          </div>
        )}
        {panel === "repeat" && (
          <div className="rounded-xl border border-line p-3 flex flex-wrap items-end gap-2">
            <label className="f">{t("Yeni tarih")}<span className="inp"><input type="date" min={todayIso()} value={repeatDate} onChange={(e) => setRepeatDate(e.target.value)} /></span></label>
            {[7, 14, 21, 28].map((n) => <button key={n} type="button" className="btn ghost sm" onClick={() => setRepeatDate(addDays(date, n))}>{t("+{n} hafta", { n: n / 7 })}</button>)}
            <button type="button" className="btn sm" disabled={pending || !repeatDate} onClick={doRepeat}>{t("Aynı saat ve uzmanla kopyala")}</button>
          </div>
        )}

        {err && <p className="pill bad">{err}</p>}
        {msg && <p className="pill good">{msg}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button type="button" className="text-sm text-green font-semibold hover:underline" onClick={() => setPanel(panel === "audit" ? "" : "audit")}>{t("Değişiklik geçmişi")}</button>
          <span className="flex-1" />
          {canWrite && !sale && status !== "cancelled" && <button type="button" className="text-sm text-bad font-semibold hover:underline px-2" disabled={pending} onClick={() => flag("cancelled")}>{t("Randevuyu iptal et")}</button>}
          {canWrite && !sale && status === "cancelled" && !initialSnap.includes('"cancelled"') && <button type="button" className="text-sm text-green font-semibold hover:underline px-2" onClick={() => flag("cancelled")}>{t("İptali geri al")}</button>}
          {canWrite && <button type="button" className="btn ghost" disabled={pending} onClick={() => setPanel(panel === "repeat" ? "" : "repeat")}>{t("Randevuyu tekrarla")}</button>}
          {canWrite && !sale && status !== "cancelled" && <button type="button" className="btn" style={{ background: "var(--good)" }} disabled={pending} onClick={createSale}>{t("Satış oluştur")}</button>}
          {!locked && <button type="button" className="btn" disabled={pending || !dirty} onClick={() => save()}>{pending ? t("Kaydediliyor…") : dirty ? t("Kaydet") : t("Kaydedildi")}</button>}
        </div>
      </div>
      {topUp && c && <TopUpDialog customerId={c.id} customerName={`${c.first_name} ${c.last_name}`.trim()} balance={Number(c.balance) + extraBalance} onClose={() => setTopUp(false)} onDone={(amt) => { setExtraBalance((b) => b + amt); setTopUp(false); router.refresh(); }} />}
      {closing && <CloseDialog v={closing} staffName={(id) => staff.find((s) => s.id === id)?.full_name ?? "—"} onClose={() => setClosing(null)} onDone={() => { setClosing(null); router.refresh(); onClose(); }} />}
    </Modal>
  );
}
