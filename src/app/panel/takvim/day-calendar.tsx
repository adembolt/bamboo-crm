"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Staff, VisitStatus } from "@/lib/database.types";
import type { DayItem } from "@/lib/queries/calendar";
import { minutesOfDay, hhmm, money, fmtTime, fullName, initials, duration } from "@/lib/format";
import { addVisitItem, setVisitStatus, deleteItem, type NewItemInput } from "./actions";
import { loadVisitForClose } from "@/app/panel/kasa/actions";
import { CloseDialog } from "@/app/panel/kasa/close-dialog";
import type { DayVisit } from "@/lib/queries/kasa";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";

type ServiceLite = { id: string; category_id: string | null; code: string | null; name_tr: string; name_en: string; duration_min: number; buffer_min: number; price: number; kind: string };
type CategoryLite = { id: string; name_tr: string; sort_order: number; color: string };

const PX_PER_MIN = 2; // 15 dk = 30px
const GRID_MIN = 15;
const STATUS_LABEL: Record<VisitStatus, string> = {
  pending: "Onay bekliyor", confirmed: "Onaylı", arrived: "Geldi", completed: "Tamamlandı", no_show: "Gelmedi", cancelled: "İptal",
};
const STATUS_CLASS: Record<VisitStatus, string> = {
  pending: "warn", confirmed: "", arrived: "good", completed: "good", no_show: "bad", cancelled: "bad",
};

export function DayCalendar(props: {
  date: string;
  staff: Staff[];
  items: DayItem[];
  timeOff: { staff_id: string; starts_at: string; ends_at: string; reason: string }[];
  settings: { open_time: string; close_time: string; slot_minutes: number };
  services: ServiceLite[];
  categories: CategoryLite[];
  canWrite: boolean;
}) {
  const { date, staff, items, settings, canWrite } = props;
  const openMin = toMin(settings.open_time);
  const closeMin = toMin(settings.close_time);
  const totalMin = closeMin - openMin;
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

  const visitItems = useMemo(() => {
    if (!selectedVisit) return [];
    return items.filter((i) => i.visit_id === selectedVisit);
  }, [items, selectedVisit]);


  function onSlotClick(staffId: string | null, minute: number) {
    if (!canWrite) return;
    const snapped = Math.floor(minute / GRID_MIN) * GRID_MIN;
    setDraft({ staffId, startHHMM: hhmm(Math.max(openMin, Math.min(snapped, closeMin - settings.slot_minutes))) });
  }

  const visibleStaff = staff.filter((s) => !hidden.has(s.id));
  const columns: { id: string | null; name: string; title: string; color: string; items: DayItem[] }[] = visibleStaff.map((s) => ({
    id: s.id, name: s.full_name, title: s.title, color: s.color, items: byStaff.m.get(s.id) ?? [],
  }));
  const hiddenWithItems = staff.filter((s) => hidden.has(s.id) && (byStaff.m.get(s.id)?.length ?? 0) > 0);
  if (byStaff.unassigned.length) columns.push({ id: null, name: "Atanmamış", title: "", color: "#9aa69c", items: byStaff.unassigned });

  return (
    <div className="panel p-0 overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-line bg-surface" aria-label="Takvimde görünen personel">
        <span className="eyebrow mr-1">Göster</span>
        {staff.map((s) => {
          const on = !hidden.has(s.id);
          const n = byStaff.m.get(s.id)?.length ?? 0;
          return (
            <button key={s.id} type="button" onClick={() => toggleStaff(s.id)} aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? "bg-surface border-line text-ink" : "bg-sunk border-transparent text-muted line-through"}`}
              title={on ? "Gizle" : "Göster"}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? s.color : "var(--line)" }} />
              {s.full_name.split(" ")[0]}{n > 0 && <span className="num opacity-70">·{n}</span>}
            </button>
          );
        })}
        <span className="ml-auto flex gap-1">
          {hidden.size > 0 && <button type="button" className="btn ghost sm" onClick={() => persistHidden(new Set())}>Tümünü göster</button>}
          <button type="button" className="btn ghost sm" onClick={() => persistHidden(new Set(staff.filter((s) => !(byStaff.m.get(s.id)?.length)).map((s) => s.id)))}>Sadece randevusu olanlar</button>
        </span>
        {hiddenLoaded && hiddenWithItems.length > 0 && <span className="w-full text-[11px] text-warn">Gizli ama bugün randevusu olan: {hiddenWithItems.map((s) => s.full_name).join(", ")}</span>}
      </div>
      <div className="overflow-x-auto lg:overflow-x-visible">
        <div className="min-w-[640px] lg:min-w-0" style={{ display: "grid", gridTemplateColumns: `46px repeat(${columns.length}, minmax(0, 1fr))` }}>
          {/* başlıklar */}
          <div className="sticky top-0 z-10 bg-surface border-b border-line" />
          {columns.map((c) => (
            <div key={c.id ?? "none"} className="sticky top-0 z-10 bg-surface border-b border-l border-line px-2 py-2 min-w-0" title={c.name}>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: c.color }} />
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm">{c.name}</div>
                  <div className="text-[11px] text-muted truncate">{c.title || `${c.items.length} randevu`}</div>
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
              className="relative border-l border-line"
              style={{ height: totalMin * PX_PER_MIN, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${GRID_MIN * PX_PER_MIN - 1}px, color-mix(in srgb, var(--line) 55%, transparent) ${GRID_MIN * PX_PER_MIN - 1}px, color-mix(in srgb, var(--line) 55%, transparent) ${GRID_MIN * PX_PER_MIN}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${60 * PX_PER_MIN - 1}px, var(--line) ${60 * PX_PER_MIN - 1}px, var(--line) ${60 * PX_PER_MIN}px)` }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-item]")) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onSlotClick(col.id, openMin + (e.clientY - rect.top) / PX_PER_MIN);
              }}
              role={canWrite ? "button" : undefined}
              aria-label={`${col.name} sütunu`}
            >
              {props.timeOff.filter((t) => t.staff_id === col.id).map((t) => {
                const a = Math.max(openMin, minutesOfDay(t.starts_at)), b = Math.min(closeMin, minutesOfDay(t.ends_at));
                if (b <= a) return null;
                return <div key={t.starts_at} className="absolute left-0 right-0 bg-sunk/80 text-[11px] text-muted px-2 py-1" style={{ top: (a - openMin) * PX_PER_MIN, height: (b - a) * PX_PER_MIN }}>{t.reason || "Müsait değil"}</div>;
              })}
              {col.items.map((it) => {
                const a = minutesOfDay(it.starts_at), b = minutesOfDay(it.ends_at);
                const top = (a - openMin) * PX_PER_MIN, h = Math.max(22, (b - a) * PX_PER_MIN - 2);
                const c = it.visit.customer;
                const multi = items.filter((x) => x.visit_id === it.visit_id && x.status !== "cancelled").length > 1;
                return (
                  <button
                    key={it.id}
                    data-item
                    onClick={() => setSelectedVisit(it.visit_id)}
                    className="absolute left-1 right-1 rounded-lg text-left px-2 py-1 overflow-hidden shadow-card border"
                    style={{
                      top, height: h,
                      background: it.status === "completed" || it.status === "arrived" ? "var(--good-bg)" : it.status === "pending" ? "var(--warn-bg)" : it.status === "no_show" ? "var(--bad-bg)" : "var(--surface)",
                      borderColor: col.color, borderLeftWidth: 4,
                    }}
                    title={`${fmtTime(it.starts_at)}–${fmtTime(it.ends_at)} ${it.service_name}`}
                  >
                    <div className="text-[12px] font-bold truncate leading-tight">
                      {c ? fullName(c) : "Müşteri yok"} {multi && <span className="pill gold ml-1 px-1.5 py-0 text-[10px]">çoklu</span>}
                    </div>
                    <div className="text-[11px] text-muted truncate leading-tight">{fmtTime(it.starts_at)} · {it.service_name}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedVisit && (
        <VisitCard
          items={visitItems}
          date={date}
          staff={staff}
          canWrite={canWrite}
          onClose={() => setSelectedVisit(null)}
          onAdd={() => {
            const v = visitItems[0];
            const c = v?.visit.customer;
            setDraft({
              staffId: v?.staff_id ?? null,
              startHHMM: v ? hhmm(minutesOfDay(v.ends_at)) : hhmm(openMin),
              visitId: selectedVisit,
              customer: c ? { id: c.id, first_name: c.first_name, last_name: c.last_name, phone: c.phone } : undefined,
            });
          }}
        />
      )}

      {draft && (
        <NewItemDialog
          date={date}
          draft={draft}
          staff={staff}
          services={props.services}
          categories={props.categories}
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
function VisitCard(props: { items: DayItem[]; date: string; staff: Staff[]; canWrite: boolean; onClose: () => void; onAdd: () => void }) {
  const { items, staff, canWrite } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [closing, setClosing] = useState<DayVisit | null>(null);
  const v = items[0]?.visit;
  const c = v?.customer;
  const active = items.filter((i) => i.status !== "cancelled").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const subtotal = active.reduce((s, i) => s + Number(i.price) - Number(i.discount), 0);
  const total = Math.round(subtotal * (1 - Number(v?.discount_percent ?? 0) / 100));
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? "—";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr("");
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Hata");
      else router.refresh();
    });
  }

  if (!v) return null;
  return (
    <Modal onClose={props.onClose} title={c ? fullName(c) : "Müşterisiz ziyaret"}>
      <div className="grid gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {c && (
            <>
              <span className="w-10 h-10 rounded-full bg-green-soft text-green grid place-items-center font-bold">{initials(c.first_name, c.last_name)}</span>
              <div className="min-w-0">
                <a className="font-semibold hover:underline" href={`/panel/musteriler/${c.id}`}>{fullName(c)}</a>
                <div className="text-sm text-muted">{c.phone || "telefon yok"}{c.no_show_count > 0 && <span className="pill bad ml-2">{c.no_show_count} gelmedi</span>}</div>
              </div>
            </>
          )}
          <span className={`pill ${STATUS_CLASS[v.status]} ml-auto`}>{STATUS_LABEL[v.status]}</span>
        </div>

        <div className="eyebrow">Bugünkü hizmetler ({active.length})</div>
        <div className="grid gap-2">
          {active.map((i) => (
            <div key={i.id} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center rounded-xl bg-sunk px-3 py-2">
              <div className="num text-sm font-bold">{fmtTime(i.starts_at)}<div className="text-[11px] text-muted font-semibold">{duration(Math.round((new Date(i.ends_at).getTime() - new Date(i.starts_at).getTime()) / 60000))}</div></div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{i.service_name}</div>
                <div className="text-xs text-muted truncate">{staffName(i.staff_id)}{i.notes ? ` · ${i.notes}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="num font-bold">{money(Number(i.price) - Number(i.discount))}</div>
                {canWrite && (
                  <button className="text-[11px] text-bad hover:underline" disabled={pending} onClick={() => { if (confirm("Bu hizmet kalemi silinsin mi?")) run(() => deleteItem(i.id)); }}>sil</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-baseline justify-between border-t border-ink pt-2">
          <div className="text-sm text-muted">{v.discount_percent > 0 ? `Ara toplam ${money(subtotal)} · %${v.discount_percent} indirim` : "Toplam"}</div>
          <div className="num text-2xl font-bold font-display">{money(total)}</div>
        </div>
        {v.notes && <p className="text-sm"><span className="text-muted">Not:</span> {v.notes}</p>}
        {err && <p className="pill bad">{err}</p>}
        {canWrite && (
          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={props.onAdd}>+ Hizmet ekle</button>
            {v.status !== "completed" && <button className="btn ghost" disabled={pending} onClick={() => { setErr(""); start(async () => { const r = await loadVisitForClose(v.id); if (!r.ok) setErr(r.error); else setClosing(r.visit); }); }}>₺ Ödeme al</button>}
            {v.status !== "arrived" && v.status !== "completed" && <button className="btn ghost" disabled={pending} onClick={() => run(() => setVisitStatus(v.id, "arrived"))}>Geldi</button>}
            {v.status !== "completed" && <button className="btn ghost" disabled={pending} onClick={() => run(() => setVisitStatus(v.id, "completed"))}>Tamamlandı</button>}
            {v.status !== "no_show" && <button className="btn ghost" disabled={pending} onClick={() => run(() => setVisitStatus(v.id, "no_show"))}>Gelmedi</button>}
            <button className="btn danger ml-auto" disabled={pending} onClick={() => { if (confirm("Ziyaretin tamamı iptal edilsin mi?")) run(() => setVisitStatus(v.id, "cancelled")); }}>İptal</button>
          </div>
        )}
      </div>
      {closing && <CloseDialog v={closing} staffName={staffName} onClose={() => setClosing(null)} onDone={() => { setClosing(null); props.onClose(); router.refresh(); }} />}
    </Modal>
  );
}

/* ---------------------------------------------------------------
   Yeni hizmet kalemi
   --------------------------------------------------------------- */
function NewItemDialog(props: {
  date: string;
  draft: { staffId: string | null; startHHMM: string; visitId?: string; customer?: PickedCustomer };
  staff: Staff[];
  services: ServiceLite[];
  categories: CategoryLite[];
  slotMinutes: number;
  onClose: () => void;
  onCreated: (visitId: string) => void;
}) {
  const router = useRouter();
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
    const t = q.trim().toLowerCase();
    return props.services
      .filter((s) => !cat || s.category_id === cat)
      .filter((s) => !t || s.name_tr.toLowerCase().includes(t) || s.name_en.toLowerCase().includes(t) || (s.code ?? "").includes(t))
      .slice(0, 60);
  }, [props.services, q, cat]);

  const service = props.services.find((s) => s.id === serviceId);

  function submit() {
    if (!service) return setErr("Bir hizmet seçin.");
    if (!customer && !newCustomer?.first_name) return setErr("Müşteri seçin veya yeni müşteri girin.");
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
    <Modal onClose={props.onClose} title={props.draft.visitId ? "Ziyarete hizmet ekle" : "Yeni randevu"}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="f">Saat
            <span className="inp"><input type="time" step={props.slotMinutes * 60} value={time} onChange={(e) => setTime(e.target.value)} /></span>
          </label>
          <label className="f">Personel
            <span className="inp">
              <select value={staffId ?? ""} onChange={(e) => setStaffId(e.target.value || null)}>
                <option value="">Atanmamış</option>
                {props.staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </span>
          </label>
        </div>

        {!props.draft.visitId && (
          <div className="grid gap-2">
            <div className="eyebrow">Müşteri</div>
            <CustomerPicker value={customer} onChange={setCustomer} onNew={setNewCustomer} />
          </div>
        )}

        <div className="grid gap-2">
          <div className="eyebrow">Hizmet</div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <span className="inp"><input placeholder="Hizmet adı veya kod ara…" value={q} onChange={(e) => setQ(e.target.value)} /></span>
            <span className="inp">
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Tüm kategoriler</option>
                {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name_tr}</option>)}
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
                <span className="min-w-0"><span className="font-semibold text-sm block truncate">{s.name_tr}</span><span className="text-[11px] text-muted">{s.code ? `#${s.code} · ` : ""}{duration(s.duration_min)}</span></span>
                <span className="num text-sm font-bold">{money(s.price)}</span>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-4 text-sm text-muted">Sonuç yok.</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="f">Fiyat (boş = liste fiyatı{service ? ` ${money(service.price)}` : ""})
            <span className="inp"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={service ? String(service.price) : ""} /></span>
          </label>
          <label className="f">Not
            <span className="inp"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ör. 3. seans" /></span>
          </label>
        </div>

        {err && <p className="pill bad">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button className="btn ghost" onClick={props.onClose} type="button">Vazgeç</button>
          <button className="btn" onClick={submit} disabled={pending} type="button">{pending ? "Kaydediliyor…" : "Kaydet"}</button>
        </div>
      </div>
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className="bg-surface w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-card p-5 grid gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
