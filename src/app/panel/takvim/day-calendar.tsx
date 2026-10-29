"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Staff } from "@/lib/database.types";
import type { DayItem } from "@/lib/queries/calendar";
import { minutesOfDay, hhmm, money, fmtTime, fullName, duration } from "@/lib/format";
import { addVisitItem, moveItem, resizeItem, type NewItemInput } from "./actions";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { VisitEditor } from "./visit-editor";
import { StaffAvatar } from "@/components/staff-avatar";
import { useT, useLang } from "@/lib/i18n/client";
import { localName, staffTitle } from "@/lib/i18n/core";
import { weekdayOf, workWindows, offBlocks, offHours, isWorking, type SchedRow } from "@/lib/schedule";

type ServiceLite = { id: string; category_id: string | null; code: string | null; name_tr: string; name_en: string; name_ru?: string | null; duration_min: number; buffer_min: number; price: number; kind: string };
type CategoryLite = { id: string; name_tr: string; name_en?: string | null; name_ru?: string | null; sort_order: number; color: string };

const PX_PER_MIN = 2; // 15 dk = 30px
const GRID_MIN = 15;

export function DayCalendar(props: {
  date: string;
  staff: Staff[];
  items: DayItem[];
  timeOff: { staff_id: string; starts_at: string; ends_at: string; reason: string }[];
  schedules: SchedRow[];
  settings: { open_time: string; close_time: string; slot_minutes: number };
  services: ServiceLite[];
  staffServices: Record<string, string[]>;
  canManage?: boolean;
  categories: CategoryLite[];
  canWrite: boolean;
}) {
  const { date, staff, items, settings, canWrite } = props;
  const t = useT();
  const lang = useLang();
  const svcById = useMemo(() => new Map(props.services.map((s) => [s.id, s])), [props.services]);
  // kayıtlı ad Türkçe; başka dilde katalogdaki çeviri gösterilir
  const svcName = (it: { service_id: string | null; service_name: string }) => { const s = lang !== "tr" && it.service_id ? svcById.get(it.service_id) : undefined; return s ? localName(s, lang) : it.service_name; };
  const openMin = toMin(settings.open_time);
  const closeMin = toMin(settings.close_time);
  const totalMin = closeMin - openMin;
  // personelin bugünkü çalışma pencereleri / izinleri
  const hoursOf = useMemo(() => {
    const wd = weekdayOf(date);
    return new Map(staff.map((s) => {
      const w = workWindows(s.id, wd, props.schedules, openMin, closeMin);
      const o = offBlocks(s.id, date, props.timeOff);
      const fullOff = o.some((x) => x.a <= openMin && x.b >= closeMin);
      return [s.id, { w, o, grey: offHours(w, openMin, closeMin), working: w.length > 0 && !fullOff, fullOff }];
    }));
  }, [staff, props.schedules, props.timeOff, date, openMin, closeMin]);
  const workCheck = (staffId: string | null, startMin: number, dur: number) => {
    if (!staffId) return true; const h = hoursOf.get(staffId); return !h || isWorking(startMin, startMin + dur, h.w, h.o);
  };
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hiddenLoaded, setHiddenLoaded] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      try { const raw = localStorage.getItem("bamboo-cal-hidden-staff"); if (raw) setHidden(new Set(JSON.parse(raw))); } catch {}
      setHiddenLoaded(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);
  function persistHidden(next: Set<string>) {
    setHidden(next);
    try { localStorage.setItem("bamboo-cal-hidden-staff", JSON.stringify([...next])); } catch {}
  }
  function toggleStaff(id: string) { const n = new Set(hidden); if (n.has(id)) n.delete(id); else n.add(id); persistHidden(n); }
  const [draft, setDraft] = useState<{ staffId: string | null; startHHMM: string; visitId?: string; customer?: PickedCustomer } | null>(null);

  const byStaff = useMemo(() => {
    const m = new Map<string, DayItem[]>();
    for (const s of staff) m.set(s.id, []);
    const unassigned: DayItem[] = [];
    for (const it of items) {
      if (it.status === "cancelled") continue;
      if (it.staff_id && m.has(it.staff_id)) m.get(it.staff_id)!.push(it);
      else unassigned.push(it);
    }
    return { m, unassigned };
  }, [items, staff]);



  function onSlotClick(staffId: string | null, minute: number) {
    if (!canWrite) return;
    const snapped = Math.floor(minute / GRID_MIN) * GRID_MIN;
    setDraft({ staffId, startHHMM: hhmm(Math.max(openMin, Math.min(snapped, closeMin - settings.slot_minutes))) });
  }

  /* ---- sürükle-bırak (fare/kalem): taşı veya alt kenardan süre değiştir; bırakınca onay sorulur ---- */
  const router = useRouter();
  type Drag = { mode: "move" | "resize"; it: DayItem; x0: number; y0: number; grab: number; a: number; dur: number; staffId: string | null; curMin: number; curStaff: string | null; curDur: number; active: boolean };
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [confirmMove, setConfirmMove] = useState<Drag | null>(null);
  const [moveErr, setMoveErr] = useState("");
  const [moving, startMove] = useTransition();
  const snap = (m: number) => Math.round(m / GRID_MIN) * GRID_MIN;
  function beginDrag(e: React.PointerEvent, it: DayItem, mode: "move" | "resize") {
    if (!canWrite || e.pointerType === "touch" || e.button !== 0) return;
    if (it.status === "completed") return; // ödemesi alınmış
    const a = minutesOfDay(it.starts_at), b = minutesOfDay(it.ends_at);
    const col = (e.currentTarget as HTMLElement).closest("[data-col]") as HTMLElement | null;
    const rect = col?.getBoundingClientRect();
    const grab = rect ? openMin + (e.clientY - rect.top) / PX_PER_MIN - a : 0;
    dragRef.current = { mode, it, x0: e.clientX, y0: e.clientY, grab, a, dur: b - a, staffId: it.staff_id, curMin: a, curStaff: it.staff_id, curDur: b - a, active: false };
    if (mode === "resize") e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      if (!d.active && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 5) return;
      d.active = true;
      if (d.mode === "move") {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-col]") as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect();
          const m = snap(openMin + (ev.clientY - r.top) / PX_PER_MIN - d.grab);
          d.curMin = Math.max(openMin, Math.min(m, closeMin - d.dur));
          d.curStaff = el.dataset.col || null;
        }
      } else {
        const dy = (ev.clientY - d.y0) / PX_PER_MIN;
        d.curDur = Math.max(GRID_MIN, Math.min(snap(d.dur + dy), closeMin - d.a));
      }
      setDrag({ ...d });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      const d = dragRef.current; dragRef.current = null; setDrag(null);
      if (!d?.active) return;
      suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 50);
      const changed = d.mode === "move" ? d.curMin !== d.a || d.curStaff !== d.staffId : d.curDur !== d.dur;
      if (changed) { setMoveErr(""); setConfirmMove(d); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function doMove() {
    const d = confirmMove; if (!d) return;
    startMove(async () => {
      const r = d.mode === "move" ? await moveItem(d.it.id, date, hhmm(d.curMin), d.curStaff) : await resizeItem(d.it.id, d.curDur);
      if (!r.ok) { setMoveErr(r.error); return; }
      setConfirmMove(null); router.refresh();
    });
  }
  const staffName = (id: string | null) => (id ? staff.find((s) => s.id === id)?.full_name ?? "—" : t("Atanmamış"));

  const visibleStaff = staff.filter((s) => !hidden.has(s.id));
  const columns: { id: string | null; name: string; title: string; color: string; photo: string | null; items: DayItem[] }[] = visibleStaff.map((s) => ({
    id: s.id, name: s.full_name, title: staffTitle(s, lang), color: s.color, photo: s.photo_url, items: byStaff.m.get(s.id) ?? [],
  }));
  const hiddenWithItems = staff.filter((s) => hidden.has(s.id) && (byStaff.m.get(s.id)?.length ?? 0) > 0);
  if (byStaff.unassigned.length) columns.push({ id: null, name: t("Atanmamış"), title: "", color: "#9aa69c", photo: null, items: byStaff.unassigned });

  return (
    <div className="panel p-0 overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-line bg-surface" aria-label={t("Takvimde görünen personel")}>
        <span className="eyebrow mr-1">{t("Göster")}</span>
        {staff.map((s) => {
          const on = !hidden.has(s.id);
          const n = byStaff.m.get(s.id)?.length ?? 0;
          return (
            <button key={s.id} type="button" onClick={() => toggleStaff(s.id)} aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? "bg-surface border-line text-ink" : "bg-sunk border-transparent text-muted line-through"}`}
              title={on ? t("Gizle") : t("Göster")}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? s.color : "var(--line)" }} />
              {s.full_name.split(" ")[0]}{n > 0 && <span className="num opacity-70">·{n}</span>}
            </button>
          );
        })}
        <span className="ml-auto flex gap-1">
          {hidden.size > 0 && <button type="button" className="btn ghost sm" onClick={() => persistHidden(new Set())}>{t("Tümünü göster")}</button>}
          <button type="button" className="btn ghost sm" onClick={() => persistHidden(new Set(staff.filter((s) => !hoursOf.get(s.id)?.working && !(byStaff.m.get(s.id)?.length)).map((s) => s.id)))}>{t("Sadece bugün çalışanlar")}</button>
          <button type="button" className="btn ghost sm" onClick={() => persistHidden(new Set(staff.filter((s) => !(byStaff.m.get(s.id)?.length)).map((s) => s.id)))}>{t("Sadece randevusu olanlar")}</button>
        </span>
        {hiddenLoaded && hiddenWithItems.length > 0 && <span className="w-full text-[11px] text-warn">{t("Gizli ama bugün randevusu olan: {names}", { names: hiddenWithItems.map((s) => s.full_name).join(", ") })}</span>}
      </div>
      <div className="overflow-x-auto lg:overflow-x-visible">
        <div className="min-w-[640px] lg:min-w-0" style={{ display: "grid", gridTemplateColumns: `46px repeat(${columns.length}, minmax(0, 1fr))` }}>
          {/* başlıklar */}
          <div className="sticky top-0 z-10 bg-surface border-b border-line" />
          {columns.map((c) => (
            <div key={c.id ?? "none"} className="sticky top-0 z-10 bg-surface border-b border-l border-line px-2 py-2 min-w-0" title={c.name}>
              <div className="flex items-center gap-2">
                {c.id ? <StaffAvatar staff={{ id: c.id, full_name: c.name, color: c.color, photo_url: c.photo }} size={34} editable={props.canManage} /> : <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: c.color }} />}
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm">{c.name}</div>
                  <div className="text-[11px] text-muted truncate">{c.title || t("{n} randevu", { n: c.items.length })}</div>
                  {c.id && (() => { const h = hoursOf.get(c.id); if (!h) return null; const txt = h.fullOff ? t("İzinli") : !h.w.length ? t("Çalışmıyor") : h.w.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(", "); return <div className={`text-[10px] num truncate ${h.working ? "text-muted" : "text-warn font-semibold"}`}>{txt}</div>; })()}
                </div>
              </div>
            </div>
          ))}

          {/* saat ekseni */}
          <div className="relative border-r border-line" style={{ height: totalMin * PX_PER_MIN }}>
            {Array.from({ length: Math.floor(totalMin / GRID_MIN) + 1 }, (_, i) => openMin + i * GRID_MIN).map((m) => (
              <div key={m} className={`absolute left-0 right-0 px-2 -translate-y-1/2 ${m % 60 === 0 ? "text-[11px] text-muted font-semibold" : m % 30 === 0 ? "text-[10px] text-muted/80" : "text-[9px] text-muted/50"}`} style={{ top: (m - openMin) * PX_PER_MIN }}>
                {m % 60 === 0 || m % 30 === 0 ? hhmm(m) : `:${String(m % 60).padStart(2, "0")}`}
              </div>
            ))}
          </div>

          {/* sütunlar */}
          {columns.map((col) => (
            <div
              key={col.id ?? "none"}
              data-col={col.id ?? ""}
              className={`relative border-l border-line ${drag?.active && drag.mode === "move" && drag.curStaff === col.id ? "bg-green-soft/40" : ""}`}
              style={{ height: totalMin * PX_PER_MIN, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${GRID_MIN * PX_PER_MIN - 1}px, color-mix(in srgb, var(--line) 55%, transparent) ${GRID_MIN * PX_PER_MIN - 1}px, color-mix(in srgb, var(--line) 55%, transparent) ${GRID_MIN * PX_PER_MIN}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${60 * PX_PER_MIN - 1}px, var(--line) ${60 * PX_PER_MIN - 1}px, var(--line) ${60 * PX_PER_MIN}px)` }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-item]")) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onSlotClick(col.id, openMin + (e.clientY - rect.top) / PX_PER_MIN);
              }}
              role={canWrite ? "button" : undefined}
              aria-label={t("{name} sütunu", { name: col.name })}
            >
              {col.id && hoursOf.get(col.id)?.grey.map(([a, b]) => (
                <div key={`g${a}`} aria-hidden className="absolute left-0 right-0 pointer-events-none" style={{ top: (a - openMin) * PX_PER_MIN, height: (b - a) * PX_PER_MIN, background: "color-mix(in srgb, var(--muted) 16%, transparent)" }} />
              ))}
              {col.id && hoursOf.get(col.id)?.o.map((o) => {
                const a = Math.max(openMin, o.a), b = Math.min(closeMin, o.b);
                if (b <= a) return null;
                return <div key={`o${o.a}`} className="absolute left-0 right-0 pointer-events-none text-[11px] font-semibold text-muted px-2 py-1" style={{ top: (a - openMin) * PX_PER_MIN, height: (b - a) * PX_PER_MIN, background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--muted) 18%, transparent) 0 6px, color-mix(in srgb, var(--muted) 8%, transparent) 6px 12px)" }}>{o.reason ? t(o.reason) : t("Müsait değil")}</div>;
              })}
              {drag?.active && drag.mode === "move" && drag.curStaff === col.id && (
                <div aria-hidden className="absolute left-1 right-1 rounded-lg border-2 border-dashed pointer-events-none z-20 px-2 py-1 text-[11px] font-bold" style={{ top: (drag.curMin - openMin) * PX_PER_MIN, height: Math.max(22, drag.dur * PX_PER_MIN - 2), borderColor: "var(--green)", background: "color-mix(in srgb, var(--green) 12%, var(--surface))" }}>
                  {hhmm(drag.curMin)}–{hhmm(drag.curMin + drag.dur)}{!workCheck(drag.curStaff, drag.curMin, drag.dur) && <span className="text-warn"> · {t("çalışma saati dışı")}</span>}
                </div>
              )}
              {col.items.map((it) => {
                const a = minutesOfDay(it.starts_at), b = minutesOfDay(it.ends_at);
                const top = (a - openMin) * PX_PER_MIN, h = Math.max(22, (b - a) * PX_PER_MIN - 2);
                const c = it.visit.customer;
                const multi = items.filter((x) => x.visit_id === it.visit_id && x.status !== "cancelled").length > 1;
                const isDragged = drag?.active && drag.it.id === it.id;
                const hh = isDragged && drag.mode === "resize" ? Math.max(22, drag.curDur * PX_PER_MIN - 2) : h;
                const canDrag = canWrite && it.status !== "completed";
                return (
                  <button
                    key={it.id}
                    data-item
                    onClick={() => { if (suppressClick.current) return; setSelectedVisit(it.visit_id); }}
                    onPointerDown={(e) => beginDrag(e, it, "move")}
                    className={`absolute left-1 right-1 rounded-lg text-left px-2 py-1 overflow-hidden shadow-card border select-none ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${isDragged && drag.mode === "move" ? "opacity-40" : ""}`}
                    style={{
                      top, height: hh, zIndex: isDragged ? 15 : undefined,
                      background: it.status === "no_show" ? "var(--bad-bg)" : it.visit.color ? `color-mix(in srgb, ${it.visit.color} 45%, var(--surface))` : it.status === "completed" || it.status === "arrived" ? "var(--good-bg)" : it.status === "pending" ? "var(--warn-bg)" : "var(--surface)",
                      backgroundImage: it.break_min > 0 ? `repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--muted) 25%, transparent) 5px 7px)` : undefined,
                      backgroundSize: it.break_min > 0 ? `100% ${it.break_min * PX_PER_MIN}px` : undefined,
                      backgroundPosition: "bottom", backgroundRepeat: "no-repeat",
                      borderColor: col.color, borderLeftWidth: 4,
                    }}
                    title={`${fmtTime(it.starts_at)}–${fmtTime(it.ends_at)} ${svcName(it)}`}
                  >
                    <div className="text-[12px] font-bold truncate leading-tight">
                      {c ? fullName(c) : t("Müşteri yok")} {multi && <span className="pill gold ml-1 px-1.5 py-0 text-[10px]">{t("çoklu")}</span>}
                    </div>
                    <div className="text-[11px] text-muted truncate leading-tight">{isDragged && drag.mode === "resize" ? `${fmtTime(it.starts_at)}–${hhmm(a + drag.curDur)} · ${duration(drag.curDur, lang)}` : `${fmtTime(it.starts_at)} · ${svcName(it)}`}</div>
                    {canDrag && <span aria-hidden onPointerDown={(e) => beginDrag(e, it, "resize")} className="absolute left-0 right-0 bottom-0 h-1.5 cursor-ns-resize" title={t("Süreyi değiştirmek için sürükleyin")} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedVisit && (
        <VisitEditor
          key={selectedVisit}
          visitId={selectedVisit}
          staff={staff}
          services={props.services}
          categories={props.categories}
          staffServices={props.staffServices}
          openTime={settings.open_time}
          closeTime={settings.close_time}
          canWrite={canWrite}
          onClose={() => setSelectedVisit(null)}
        />
      )}

      {confirmMove && (
        <Modal title={confirmMove.mode === "move" ? t("Randevuyu taşı") : t("Süreyi değiştir")} onClose={() => !moving && setConfirmMove(null)}>
          <div className="grid gap-3">
            <div className="rounded-xl border border-line p-3 grid gap-1 text-sm">
              <b>{confirmMove.it.visit.customer ? fullName(confirmMove.it.visit.customer) : t("Müşteri yok")} · {svcName(confirmMove.it)}</b>
              {confirmMove.mode === "move" ? (
                <>
                  <span className="num">{t("Saat")}: {hhmm(confirmMove.a)}–{hhmm(confirmMove.a + confirmMove.dur)} → <b>{hhmm(confirmMove.curMin)}–{hhmm(confirmMove.curMin + confirmMove.dur)}</b></span>
                  {confirmMove.curStaff !== confirmMove.staffId && <span>{t("Uzman")}: {staffName(confirmMove.staffId)} → <b>{staffName(confirmMove.curStaff)}</b></span>}
                </>
              ) : (
                <span className="num">{t("Süre")}: {duration(confirmMove.dur, lang)} → <b>{duration(confirmMove.curDur, lang)}</b> ({hhmm(confirmMove.a)}–{hhmm(confirmMove.a + confirmMove.curDur)})</span>
              )}
            </div>
            {!workCheck(confirmMove.curStaff, confirmMove.mode === "move" ? confirmMove.curMin : confirmMove.a, confirmMove.mode === "move" ? confirmMove.dur : confirmMove.curDur) && <p className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>⚠ {t("Uzman bu saatte çalışmıyor veya izinli.")}</p>}
            {confirmMove.curStaff && confirmMove.it.service_id && props.staffServices[confirmMove.curStaff]?.length && !props.staffServices[confirmMove.curStaff].includes(confirmMove.it.service_id) ? <p className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>⚠ {t("Bu hizmet seçilen uzmanın hizmet listesinde yok.")}</p> : null}
            {moveErr && <p className="pill bad">{moveErr}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn ghost" disabled={moving} onClick={() => setConfirmMove(null)}>{t("Vazgeç")}</button>
              <button type="button" className="btn" disabled={moving} onClick={doMove}>{moving ? t("Kaydediliyor…") : confirmMove.mode === "move" ? t("Taşı") : t("Kaydet")}</button>
            </div>
          </div>
        </Modal>
      )}

      {draft && (
        <NewItemDialog
          workCheck={workCheck}
          date={date}
          draft={draft}
          staff={staff}
          services={props.services}
          categories={props.categories}
          staffServices={props.staffServices}
          slotMinutes={settings.slot_minutes}
          onClose={() => setDraft(null)}
          onCreated={(visitId) => { setDraft(null); setSelectedVisit(visitId); }}
        />
      )}
    </div>
  );
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* ---------------------------------------------------------------
   Ziyaret kartı: müşterinin o günkü TÜM hizmetleri + toplam
   --------------------------------------------------------------- */
function NewItemDialog(props: {
  date: string;
  draft: { staffId: string | null; startHHMM: string; visitId?: string; customer?: PickedCustomer };
  staff: Staff[];
  services: ServiceLite[];
  categories: CategoryLite[];
  staffServices: Record<string, string[]>;
  slotMinutes: number;
  workCheck: (staffId: string | null, startMin: number, dur: number) => boolean;
  onClose: () => void;
  onCreated: (visitId: string) => void;
}) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [staffId, setStaffId] = useState<string | null>(props.draft.staffId);
  const [time, setTime] = useState(props.draft.startHHMM);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer | null>(props.draft.customer ?? null);
  const [newCustomer, setNewCustomer] = useState<{ first_name: string; last_name: string; phone: string } | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const allowed = staffId && props.staffServices[staffId]?.length ? new Set(props.staffServices[staffId]) : null;
    return props.services
      .filter((s) => !allowed || allowed.has(s.id))
      .filter((s) => !cat || s.category_id === cat)
      .filter((s) => !qq || s.name_tr.toLowerCase().includes(qq) || s.name_en.toLowerCase().includes(qq) || (s.name_ru ?? "").toLowerCase().includes(qq) || (s.code ?? "").includes(qq))
      .slice(0, 60);
  }, [props.services, props.staffServices, staffId, q, cat]);

  const service = props.services.find((s) => s.id === serviceId);

  function submit() {
    if (!service) return setErr(t("Bir hizmet seçin."));
    if (!customer && !newCustomer?.first_name) return setErr(t("Müşteri seçin veya yeni müşteri girin."));
    setErr("");
    const input: NewItemInput = {
      date: props.date, startHHMM: time, staffId, serviceId: service.id,
      price: price !== "" ? Number(price) : undefined, notes,
      customerId: customer?.id ?? null, newCustomer: customer ? null : newCustomer, visitId: props.draft.visitId ?? null,
    };
    start(async () => {
      const r = await addVisitItem(input);
      if (!r.ok) return setErr(r.error);
      router.refresh();
      props.onCreated(r.visitId);
    });
  }

  return (
    <Modal onClose={props.onClose} title={props.draft.visitId ? t("Ziyarete hizmet ekle") : t("Yeni randevu")}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="f">{t("Saat")}
            <span className="inp"><input type="time" step={props.slotMinutes * 60} value={time} onChange={(e) => setTime(e.target.value)} /></span>
          </label>
          <label className="f">{t("Personel")}
            <span className="inp">
              <select value={staffId ?? ""} onChange={(e) => setStaffId(e.target.value || null)}>
                <option value="">{t("Atanmamış")}</option>
                {props.staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </span>
          </label>
        </div>

        {!props.draft.visitId && (
          <div className="grid gap-2">
            <div className="eyebrow">{t("Müşteri")}</div>
            <CustomerPicker value={customer} onChange={setCustomer} onNew={setNewCustomer} />
          </div>
        )}

        <div className="grid gap-2">
          <div className="eyebrow">{t("Hizmet")}</div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <span className="inp"><input placeholder={t("Hizmet adı veya kod ara…")} value={q} onChange={(e) => setQ(e.target.value)} /></span>
            <span className="inp">
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">{t("Tüm kategoriler")}</option>
                {props.categories.map((c) => <option key={c.id} value={c.id}>{localName(c, lang)}</option>)}
              </select>
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-line divide-y divide-line">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setServiceId(s.id); setPrice(""); }}
                className={`w-full text-left px-3 py-2 grid grid-cols-[1fr_auto] gap-2 items-center ${serviceId === s.id ? "bg-green-soft" : "hover:bg-sunk"}`}
              >
                <span className="min-w-0"><span className="font-semibold text-sm block truncate">{localName(s, lang)}</span><span className="text-[11px] text-muted">{s.code ? `#${s.code} · ` : ""}{duration(s.duration_min, lang)}</span></span>
                <span className="num text-sm font-bold">{money(s.price)}</span>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-4 text-sm text-muted">{t("Sonuç yok.")}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="f">{service ? t("Fiyat (boş = liste fiyatı {price})", { price: money(service.price) }) : t("Fiyat (boş = liste fiyatı)")}
            <span className="inp"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={service ? String(service.price) : ""} /></span>
          </label>
          <label className="f">{t("Not")}
            <span className="inp"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ör. 3. seans")} /></span>
          </label>
        </div>

        {!props.workCheck(staffId, toMin(time), service?.duration_min ?? props.slotMinutes) && <p className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>⚠ {t("Uzman bu saatte çalışmıyor veya izinli. Yine de kaydedebilirsiniz.")}</p>}
        {err && <p className="pill bad">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button className="btn ghost" onClick={props.onClose} type="button">{t("Vazgeç")}</button>
          <button className="btn" onClick={submit} disabled={pending} type="button">{pending ? t("Kaydediliyor…") : t("Kaydet")}</button>
        </div>
      </div>
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className="bg-surface w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-card p-5 grid gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label={t("Kapat")}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
