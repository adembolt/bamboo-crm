"use client";
import { useEffect, useMemo, useState } from "react";
import { t, pickName, type Lang } from "@/lib/booking/i18n";
import { money, todayIso, addDays } from "@/lib/format";

type Cat = { id: string; name_tr: string; name_en: string; name_ru: string; sort_order: number; color: string };
type Svc = { id: string; category_id: string | null; name_tr: string; name_en: string; name_ru: string; description_tr: string; description_en: string; description_ru: string; duration_min: number; price: number; price_min: number | null; session_count: number };
type StaffLite = { id: string; full_name: string; title: string; color: string; languages: string[] };
type Slot = { time: string; staffIds: string[] };

export function BookingWizard(props: { lang: Lang; categories: Cat[]; services: Svc[]; staff: StaffLite[]; requiresApproval: boolean; maxDaysAhead: number; openDays: number[]; whatsapp: string }) {
  const { lang, categories, services, staff } = props;
  const d = t(lang);
  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [service, setService] = useState<Svc | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState<string>("");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", notes: "", consent: true });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { confirmed: boolean }>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return services.filter((x) => (!cat || x.category_id === cat) && (!s || [x.name_tr, x.name_en, x.name_ru].some((n) => n.toLowerCase().includes(s))));
  }, [services, q, cat]);

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i <= Math.min(props.maxDaysAhead, 45); i++) {
      const iso = addDays(todayIso(), i);
      const wd = ((new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7) + 1;
      if (props.openDays.includes(wd)) out.push(iso);
    }
    return out;
  }, [props.maxDaysAhead, props.openDays]);

  useEffect(() => {
    if (step !== 2 || !service) return;
    let alive = true;
    const reset = setTimeout(() => { setSlots(null); setTime(""); }, 0);
    fetch(`/api/booking/slots?service=${service.id}&staff=${staffId ?? ""}&date=${date}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setSlots(j.slots ?? []); })
      .catch(() => { if (alive) setSlots([]); });
    return () => { alive = false; clearTimeout(reset); };
  }, [step, service, staffId, date]);

  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? d.anyStaff;
  const fmtDay = (iso: string) => { const dt = new Date(iso + "T12:00:00Z"); const wd = ((dt.getUTCDay() + 6) % 7); return { wd: d.weekdays[wd], dm: `${dt.getUTCDate()}.${String(dt.getUTCMonth() + 1).padStart(2, "0")}` }; };

  async function submit() {
    setErr("");
    if (!form.firstName.trim()) return setErr(d.errName);
    if (form.phone.replace(/\D/g, "").length < 8) return setErr(d.errPhone);
    if (!service || !time) return;
    setBusy(true);
    try {
      const r = await fetch("/api/booking/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId: service.id, staffId, date, time, ...form, locale: lang }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error === "slot" ? d.errSlot : j.error === "phone" ? d.errPhone : j.error === "name" ? d.errName : j.error === "closed" ? d.closed : d.errGeneric); if (j.error === "slot") setStep(2); return; }
      setDone({ confirmed: !!j.confirmed }); setStep(4);
    } catch { setErr(d.errGeneric); } finally { setBusy(false); }
  }

  const steps = [d.stepService, d.stepStaff, d.stepTime, d.stepDetails, d.stepDone];

  return (
    <div className="panel grid gap-5 p-5">
      <ol className="flex gap-1 text-[11px] font-bold uppercase tracking-wide" aria-label="steps">
        {steps.map((s, i) => <li key={s} className={`flex-1 border-b-4 pb-1 ${i <= step ? "border-green text-green" : "border-line text-muted"}`}>{s}</li>)}
      </ol>

      {step === 0 && (
        <div className="grid gap-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <span className="inp"><input placeholder={d.search} value={q} onChange={(e) => setQ(e.target.value)} /></span>
            <span className="inp"><select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{d.allCategories}</option>{categories.map((c) => <option key={c.id} value={c.id}>{pickName(c, lang)}</option>)}</select></span>
          </div>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {categories.filter((c) => !cat || c.id === cat).map((c) => {
              const items = filtered.filter((s) => s.category_id === c.id);
              if (!items.length) return null;
              return (
                <div key={c.id} className="grid gap-1">
                  <div className="eyebrow flex items-center gap-2 mt-2"><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{pickName(c, lang)}</div>
                  {items.map((s) => (
                    <button key={s.id} type="button" onClick={() => { setService(s); setStep(1); }} className="text-left rounded-xl border border-line hover:border-green px-3 py-2 grid grid-cols-[1fr_auto] gap-3 items-center bg-surface">
                      <span className="min-w-0"><span className="font-semibold block">{pickName(s, lang)}</span><span className="text-xs text-muted">{s.duration_min} {d.min}{s.session_count > 1 ? ` · ${s.session_count}×` : ""}</span></span>
                      <span className="num font-bold whitespace-nowrap">{s.price_min ? `${money(s.price_min)}+` : money(s.price)}</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {!filtered.length && <p className="text-sm text-muted py-4">—</p>}
          </div>
        </div>
      )}

      {step === 1 && service && (
        <div className="grid gap-3">
          <Summary service={service} lang={lang} d={d} />
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => { setStaffId(null); setStep(2); }} className="rounded-xl border-2 border-dashed border-line hover:border-green px-3 py-3 text-left"><b>{d.anyStaff}</b><div className="text-xs text-muted">{d.anyStaffHint}</div></button>
            {staff.map((s) => (
              <button key={s.id} type="button" onClick={() => { setStaffId(s.id); setStep(2); }} className="rounded-xl border border-line hover:border-green px-3 py-3 text-left flex items-center gap-3">
                <span className="w-9 h-9 rounded-full grid place-items-center text-white font-bold flex-none" style={{ background: s.color }}>{s.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                <span className="min-w-0"><b className="block truncate">{s.full_name}</b><span className="text-xs text-muted">{s.title}{s.languages?.length ? ` · ${s.languages.join("/").toUpperCase()}` : ""}</span></span>
              </button>
            ))}
          </div>
          <button type="button" className="btn ghost w-max" onClick={() => setStep(0)}>‹ {d.back}</button>
        </div>
      )}

      {step === 2 && service && (
        <div className="grid gap-3">
          <Summary service={service} lang={lang} d={d} extra={staffName(staffId)} />
          <div className="eyebrow">{d.pickDate}</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((iso) => { const f = fmtDay(iso); return (
              <button key={iso} type="button" onClick={() => setDate(iso)} className={`flex-none w-16 rounded-xl border px-2 py-2 text-center ${iso === date ? "border-green bg-green-soft" : "border-line bg-surface"}`}>
                <div className="text-[11px] font-bold text-muted uppercase">{f.wd}</div><div className="font-bold num">{f.dm}</div>
              </button>
            ); })}
          </div>
          <div className="min-h-24">
            {slots === null && <p className="text-sm text-muted">{d.loading}</p>}
            {slots && !slots.length && <p className="text-sm text-muted">{d.noSlots}</p>}
            {slots && slots.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {slots.map((s) => <button key={s.time} type="button" onClick={() => setTime(s.time)} className={`rounded-lg border py-2 num font-semibold ${time === s.time ? "border-green bg-green text-white" : "border-line bg-surface hover:border-green"}`}>{s.time}</button>)}
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <button type="button" className="btn ghost" onClick={() => setStep(1)}>‹ {d.back}</button>
            <button type="button" className="btn" disabled={!time} onClick={() => setStep(3)}>{d.next} ›</button>
          </div>
        </div>
      )}

      {step === 3 && service && (
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Summary service={service} lang={lang} d={d} extra={`${staffName(staffId)} · ${fmtDay(date).dm} ${time}`} />
          <div className="grid grid-cols-2 gap-3">
            <label className="f">{d.firstName} *<span className="inp"><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" required /></span></label>
            <label className="f">{d.lastName}<span className="inp"><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" /></span></label>
            <label className="f col-span-2">{d.phone} *<span className="inp"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="+90 5xx xxx xx xx" required /></span></label>
            <label className="f col-span-2">{d.email}<span className="inp"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" autoComplete="email" /></span></label>
            <label className="f col-span-2">{d.notes}<span className="inp"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></span></label>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1" /> {d.consent}</label>
          {err && <p className="pill bad">{err}</p>}
          <div className="flex justify-between">
            <button type="button" className="btn ghost" onClick={() => setStep(2)}>‹ {d.back}</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? d.sending : d.submit}</button>
          </div>
        </form>
      )}

      {step === 4 && done && (
        <div className="grid gap-3 text-center py-6">
          <div className="text-5xl">✓</div>
          <h2 className="text-xl font-bold">{d.doneTitle}</h2>
          <p className="text-muted">{done.confirmed ? d.doneConfirmed : d.doneApproval}</p>
          {props.whatsapp && <a className="btn ghost justify-self-center" href={`https://wa.me/${props.whatsapp}`} target="_blank" rel="noreferrer">{d.whatsapp}</a>}
          <button type="button" className="btn justify-self-center" onClick={() => { setStep(0); setService(null); setStaffId(null); setTime(""); setDone(null); }}>{d.newBooking}</button>
        </div>
      )}
    </div>
  );
}

function Summary({ service, lang, d, extra }: { service: Svc; lang: Lang; d: ReturnType<typeof t>; extra?: string }) {
  return (
    <div className="rounded-xl bg-green-soft px-3 py-2 flex items-center gap-3">
      <div className="min-w-0 flex-1"><b className="block truncate">{pickName(service, lang)}</b><span className="text-xs text-muted">{d.duration}: {service.duration_min} {d.min}{extra ? ` · ${extra}` : ""}</span></div>
      <div className="num font-bold">{money(service.price)}</div>
    </div>
  );
}
