"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { useT, useLang } from "@/lib/i18n/client";
import { INTL } from "@/lib/i18n/core";
import { fmtDate, fmtTime, todayIso, addDays } from "@/lib/format";
import { saveSchedule, addTimeOff, deleteTimeOff } from "./actions";

type Iv = { start: string; end: string };
export type SchedRowLite = { weekday: number; start_time: string; end_time: string };
export type OffRowLite = { id: string; starts_at: string; ends_at: string; reason: string };

const REASONS = ["İzin", "Hastalık", "Eğitim", "Kişisel", "Diğer"];
const hm = (s: string) => s.slice(0, 5);

/** DIKIDI'deki gibi: personelin haftalık çalışma saatleri + izin günleri */
export function StaffScheduleDialog({ daily, staffId, staffName, rows, offs, openTime, closeTime, openDays, onClose }: {
  daily?: boolean; staffId: string; staffName: string; rows: SchedRowLite[]; offs: OffRowLite[]; openTime: string; closeTime: string; openDays: number[]; onClose: () => void;
}) {
  const t = useT(), lang = useLang();
  const router = useRouter();
  const [tab, setTab] = useState<"week" | "off">("week");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const open = hm(openTime), close = hm(closeTime);

  const initial = useMemo(() => {
    const d: Record<number, Iv[]> = {};
    for (let i = 1; i <= 7; i++) d[i] = rows.filter((r) => r.weekday === i).sort((a, b) => a.start_time.localeCompare(b.start_time)).map((r) => ({ start: hm(r.start_time), end: hm(r.end_time) }));
    return d;
  }, [rows]);
  const [useProgram, setUseProgram] = useState(rows.length > 0);
  const [days, setDays] = useState<Record<number, Iv[]>>(() => rows.length ? initial : Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, openDays.includes(i) ? [{ start: open, end: close }] : []])));
  const snap = JSON.stringify({ u: rows.length > 0, d: initial });
  const dirty = JSON.stringify({ u: useProgram, d: useProgram ? days : initial }) !== snap && !(rows.length === 0 && !useProgram);

  const dayName = (i: number) => { const n = new Intl.DateTimeFormat(INTL[lang], { weekday: "long" }).format(new Date(Date.UTC(2024, 0, i, 12))); return n.charAt(0).toLocaleUpperCase() + n.slice(1); };
  const setIv = (d: number, k: number, patch: Partial<Iv>) => setDays((x) => ({ ...x, [d]: x[d].map((iv, j) => (j === k ? { ...iv, ...patch } : iv)) }));
  const total = (d: number) => days[d].reduce((m, iv) => m + Math.max(0, toM(iv.end) - toM(iv.start)), 0);
  const weekTotal = [1, 2, 3, 4, 5, 6, 7].reduce((m, d) => m + total(d), 0);

  const save = () => { setMsg(null); start(async () => {
    const list = useProgram ? Object.entries(days).flatMap(([d, ivs]) => ivs.map((iv) => ({ weekday: Number(d), start: iv.start, end: iv.end }))) : [];
    const r = await saveSchedule(staffId, list);
    if (!r.ok) setMsg({ ok: false, text: r.error }); else { setMsg({ ok: true, text: t("Kaydedildi") }); router.refresh(); }
  }); };

  // izin formu
  const today = todayIso();
  const [oFrom, setOFrom] = useState(today), [oTo, setOTo] = useState(today), [allDay, setAllDay] = useState(true);
  const [oStart, setOStart] = useState("13:00"), [oEnd, setOEnd] = useState("14:00"), [reason, setReason] = useState(REASONS[0]);
  const upcoming = offs.filter((o) => o.ends_at >= new Date().toISOString()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const addOff = () => { setMsg(null); start(async () => {
    const r = await addTimeOff({ staffId, from: oFrom, to: allDay ? oTo : oFrom, allDay, start: oStart, end: oEnd, reason });
    if (!r.ok) setMsg({ ok: false, text: r.error }); else { setMsg({ ok: true, text: t("İzin eklendi") }); router.refresh(); }
  }); };
  const delOff = (id: string) => { if (!confirm(t("Bu izni silmek istiyor musunuz?"))) return; start(async () => { const r = await deleteTimeOff(id); if (!r.ok) setMsg({ ok: false, text: r.error }); else router.refresh(); }); };
  const offLabel = (o: OffRowLite) => {
    const s = new Date(o.starts_at), e = new Date(o.ends_at);
    const full = fmtTime(o.starts_at) === "00:00" && fmtTime(o.ends_at) === "00:00";
    if (full) { const last = fmtDate(new Date(e.getTime() - 3600_000)); const first = fmtDate(s); return first === last ? first : `${first} – ${last}`; }
    return `${fmtDate(s)} ${fmtTime(o.starts_at)}–${fmtTime(o.ends_at)}`;
  };

  const tryClose = () => { if (dirty && !confirm(t("Kaydedilmemiş değişiklikler var. Kapatılsın mı?"))) return; onClose(); };

  return (
    <Modal wide title={t("Çalışma saatleri · {name}", { name: staffName })} onClose={tryClose}
      headerExtra={<div className="flex gap-1 bg-sunk p-1 rounded-lg">{(["week", "off"] as const).map((k) => <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1 rounded-md text-sm font-semibold ${tab === k ? "bg-surface shadow-card" : "text-muted"}`}>{k === "week" ? t("Haftalık program") : t("İzinler ({n})", { n: upcoming.length })}</button>)}</div>}>
      {tab === "week" ? (
        <div className="grid gap-3">
          {daily && <p className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>{t("Bu uzmanın programı DIKIDI'den gün gün aktarıldı; saat girilmeyen gün çalışmıyor sayılır. Buradan haftalık program kaydederseniz gün gün program devre dışı kalır.")}</p>}
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={useProgram} onChange={(e) => setUseProgram(e.target.checked)} /> {t("Kişisel çalışma programı kullan")}</label>
          {!useProgram ? (
            <p className="text-sm text-muted">{t("Program yok: bu uzman salonun açık olduğu tüm saatlerde ({open}–{close}) müsait sayılır.", { open, close })}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn ghost sm" onClick={() => setDays((x) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, i === 1 ? x[1] : x[1].map((iv) => ({ ...iv }))])))}>{t("Pazartesiyi tüm günlere kopyala")}</button>
                <button type="button" className="btn ghost sm" onClick={() => setDays(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, i <= 5 ? [{ start: open, end: close }] : []])))}>{t("Hafta içi tam gün")}</button>
                <button type="button" className="btn ghost sm" onClick={() => setDays(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, openDays.includes(i) ? [{ start: open, end: close }] : []])))}>{t("Salon saatleri")}</button>
                <span className="ml-auto text-sm text-muted self-center">{t("Haftalık toplam: {h} saat", { h: (weekTotal / 60).toLocaleString(INTL[lang], { maximumFractionDigits: 1 }) })}</span>
              </div>
              <div className="grid gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const on = days[d].length > 0;
                  return (
                    <div key={d} className={`grid grid-cols-[130px_1fr_auto] items-center gap-2 rounded-xl border border-line px-3 py-2 ${on ? "" : "bg-sunk"}`}>
                      <label className="flex items-center gap-2 font-semibold text-sm"><input type="checkbox" checked={on} onChange={(e) => setDays((x) => ({ ...x, [d]: e.target.checked ? [{ start: open, end: close }] : [] }))} />{dayName(d)}</label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {!on && <span className="text-sm text-muted">{t("Çalışmıyor")}</span>}
                        {days[d].map((iv, k) => (
                          <span key={k} className="inline-flex items-center gap-1">
                            <span className="inp w-[118px]"><input type="time" step={900} value={iv.start} onChange={(e) => setIv(d, k, { start: e.target.value })} aria-label={t("Başlangıç")} /></span>
                            <span className="text-muted">–</span>
                            <span className="inp w-[118px]"><input type="time" step={900} value={iv.end} onChange={(e) => setIv(d, k, { end: e.target.value })} aria-label={t("Bitiş")} /></span>
                            {days[d].length > 1 && <button type="button" className="btn ghost sm px-1.5" aria-label={t("Aralığı kaldır")} onClick={() => setDays((x) => ({ ...x, [d]: x[d].filter((_, j) => j !== k) }))}>✕</button>}
                          </span>
                        ))}
                        {on && <button type="button" className="btn ghost sm" title={t("Öğle arası gibi bölünmüş çalışma için ikinci aralık")} onClick={() => setDays((x) => { const last = x[d][x[d].length - 1]; return { ...x, [d]: [...x[d], { start: last ? last.end : open, end: close }] }; })}>+ {t("Aralık ekle")}</button>}
                      </div>
                      <span className="text-xs text-muted num">{on ? `${Math.floor(total(d) / 60)}:${String(total(d) % 60).padStart(2, "0")}` : ""}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted">{t("Çalışılmayan saatler takvimde gri görünür ve online randevuda bu saatler verilmez. Takvimden yine de randevu girilebilir (uyarı gösterilir).")}</p>
            </>
          )}
          {msg && <p className={`pill ${msg.ok ? "good" : "bad"}`}>{msg.text}</p>}
          <div className="flex justify-end gap-2 items-center">
            {dirty && <span className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>{t("Kaydedilmedi")}</span>}
            <button type="button" className="btn ghost" onClick={tryClose}>{t("Kapat")}</button>
            <button type="button" className="btn" disabled={pending || !dirty} onClick={save}>{pending ? t("Kaydediliyor…") : t("Kaydet")}</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid sm:grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 items-end rounded-xl border border-line p-3">
            <label className="f">{t("Neden")}<span className="inp"><select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}</select></span></label>
            <label className="flex items-center gap-2 text-sm font-semibold pb-2"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> {t("Tam gün")}</label>
            {allDay ? (
              <>
                <label className="f">{t("Başlangıç tarihi")}<span className="inp"><input type="date" value={oFrom} onChange={(e) => { setOFrom(e.target.value); if (oTo < e.target.value) setOTo(e.target.value); }} /></span></label>
                <label className="f">{t("Bitiş tarihi")}<span className="inp"><input type="date" value={oTo} min={oFrom} onChange={(e) => setOTo(e.target.value)} /></span></label>
              </>
            ) : (
              <>
                <label className="f">{t("Tarih")}<span className="inp"><input type="date" value={oFrom} onChange={(e) => setOFrom(e.target.value)} /></span></label>
                <div className="flex gap-1 items-end">
                  <label className="f">{t("Başlangıç")}<span className="inp"><input type="time" step={900} value={oStart} onChange={(e) => setOStart(e.target.value)} /></span></label>
                  <label className="f">{t("Bitiş")}<span className="inp"><input type="time" step={900} value={oEnd} onChange={(e) => setOEnd(e.target.value)} /></span></label>
                </div>
              </>
            )}
            <button type="button" className="btn" disabled={pending} onClick={addOff}>{t("Ekle")}</button>
          </div>
          <div className="flex gap-2 flex-wrap text-xs">
            <button type="button" className="btn ghost sm" onClick={() => { setAllDay(true); setOFrom(addDays(today, 1)); setOTo(addDays(today, 1)); }}>{t("Yarın")}</button>
            <button type="button" className="btn ghost sm" onClick={() => { setAllDay(true); setOFrom(today); setOTo(addDays(today, 6)); }}>{t("1 hafta")}</button>
          </div>
          {msg && <p className={`pill ${msg.ok ? "good" : "bad"}`}>{msg.text}</p>}
          <div className="grid gap-1.5">
            {!upcoming.length && <p className="text-sm text-muted">{t("Planlanmış izin yok.")}</p>}
            {upcoming.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <span className="pill">{t(o.reason || "İzin")}</span>
                <span className="text-sm num">{offLabel(o)}</span>
                <button type="button" className="btn ghost sm ml-auto" disabled={pending} onClick={() => delOff(o.id)}>{t("Sil")}</button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">{t("İzinli saatler takvimde taralı görünür; online randevu verilmez. O saatlerde mevcut randevular silinmez, kontrol etmeyi unutmayın.")}</p>
        </div>
      )}
    </Modal>
  );
}

function toM(s: string) { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); }
