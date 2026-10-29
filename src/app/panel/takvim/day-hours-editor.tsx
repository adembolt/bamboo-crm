"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT, useLang } from "@/lib/i18n/client";
import { fmtDateLong, addDays } from "@/lib/format";
import { setDayHours } from "../personel/actions";

const toM = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };
const toHM = (n: number) => `${String(Math.floor(Math.max(0, Math.min(1439, n)) / 60)).padStart(2, "0")}:${String(Math.max(0, Math.min(1439, n)) % 60).padStart(2, "0")}`;

export type DayHoursTarget = { staffId: string; staffName: string; date: string; windows: [number, number][]; x: number; y: number; items: { start: number; end: number }[] };

/** Takvim başlığındaki çalışma saatine tıklanınca açılan küçük pencere: o günün saatlerini uzat / kısalt / mola / çalışmıyor */
export function DayHoursEditor({ target, onClose }: { target: DayHoursTarget; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const w = target.windows;
  const [start, setStart] = useState(w.length ? toHM(w[0][0]) : "10:00");
  const [end, setEnd] = useState(w.length ? toHM(w[w.length - 1][1]) : "21:00");
  const [brk, setBrk] = useState(w.length > 1);
  const [b1, setB1] = useState(w.length > 1 ? toHM(w[0][1]) : "14:00");
  const [b2, setB2] = useState(w.length > 1 ? toHM(w[1][0]) : "15:00");
  const [scope, setScope] = useState<"day" | "weekday4" | "week">("day");
  const [err, setErr] = useState("");
  const [pending, start_] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("keydown", onKey); window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [onClose]);

  const days = scope === "day" ? [target.date]
    : scope === "weekday4" ? [0, 7, 14, 21].map((n) => addDays(target.date, n))
    : (() => { const wd = (new Date(`${target.date}T12:00:00Z`).getUTCDay() + 6) % 7; return Array.from({ length: 7 }, (_, i) => addDays(target.date, i - wd)); })();
  const ranges = brk ? [{ start, end: b1 }, { start: b2, end }] : [{ start, end }];
  // seçilen saatlerin dışında kalan randevu (sadece bu gün için uyarı)
  const outside = target.items.filter((it) => !ranges.some((r) => it.start >= toM(r.start) && it.end <= toM(r.end))).length;
  const save = (r: { start: string; end: string }[] | null) => {
    setErr("");
    start_(async () => {
      const res = await setDayHours({ staffIds: [target.staffId], days, ranges: r });
      if (!res.ok) setErr(res.error); else { onClose(); router.refresh(); }
    });
  };
  const bump = (which: "s" | "e", d: number) => (which === "s" ? setStart(toHM(toM(start) + d)) : setEnd(toHM(toM(end) + d)));
  const left = Math.max(8, Math.min(target.x - 150, (typeof window !== "undefined" ? window.innerWidth : 1200) - 316));
  const top = Math.max(8, Math.min(target.y + 8, (typeof window !== "undefined" ? window.innerHeight : 800) - 360));

  return (
    <div ref={ref} role="dialog" aria-label={t("Çalışma saati")} className="fixed z-50 w-[300px] rounded-xl border border-line bg-surface shadow-card p-3 grid gap-2 text-sm" style={{ left, top }}>
      <div className="leading-tight"><b>{target.staffName}</b><div className="text-xs text-muted">{fmtDateLong(target.date, lang)}</div></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <span className="text-xs text-muted">{t("Başlangıç")}</span>
          <span className="inp"><input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} /></span>
          <div className="flex gap-1"><button type="button" className="btn ghost sm flex-1" onClick={() => bump("s", -30)} title={t("Erken başla")}>−30</button><button type="button" className="btn ghost sm flex-1" onClick={() => bump("s", 30)} title={t("Geç başla")}>+30</button></div>
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted">{t("Bitiş")}</span>
          <span className="inp"><input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} /></span>
          <div className="flex gap-1"><button type="button" className="btn ghost sm flex-1" onClick={() => bump("e", -30)} title={t("Erken bitir")}>−30</button><button type="button" className="btn ghost sm flex-1" onClick={() => bump("e", 30)} title={t("Uzat")}>+30</button></div>
        </div>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={brk} onChange={(e) => setBrk(e.target.checked)} />{t("Mola")}</label>
      {brk && (
        <div className="grid grid-cols-2 gap-2">
          <span className="inp"><input type="time" step={900} value={b1} onChange={(e) => setB1(e.target.value)} aria-label={t("Mola başı")} /></span>
          <span className="inp"><input type="time" step={900} value={b2} onChange={(e) => setB2(e.target.value)} aria-label={t("Mola sonu")} /></span>
        </div>
      )}
      <label className="f">{t("Uygula")}<span className="inp"><select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
        <option value="day">{t("Sadece bu gün")}</option>
        <option value="weekday4">{t("Bu gün ve sonraki 3 haftanın aynı günü")}</option>
        <option value="week">{t("Bu haftanın tüm günleri")}</option>
      </select></span></label>
      {outside > 0 && scope === "day" && <p className="pill warn">{t("{n} randevu bu saatlerin dışında kalıyor.", { n: outside })}</p>}
      {err && <p className="pill bad">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn sm flex-1" disabled={pending || end <= start} onClick={() => save(ranges)}>{t("Kaydet")}</button>
        <button type="button" className="btn ghost sm" disabled={pending} onClick={() => save(null)} title={t("O gün çalışmıyor")}>{t("Çalışmıyor")}</button>
      </div>
    </div>
  );
}
