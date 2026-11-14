"use client";
import { useState } from "react";
import { addDays, todayIso, fmtMonthYear, fmtWeekdayShort, fmtDate } from "@/lib/format";
import { useT, useLang } from "@/lib/i18n/client";

/* Büyük, okunaklı ay takvimi (tarayıcının küçük tarih kutusu yerine).
   value: YYYY-MM-DD · min: bu tarihten önceki günler seçilemez · mark: ayrıca işaretlenecek gün (ör. randevunun kendi günü) */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays("2024-01-01", i)); // Pazartesi'den başlar

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const shiftMonth = (first: string, n: number) => {
  const [y, m] = first.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};

export function DateGridPicker({ value, onChange, min, mark }: { value: string; onChange: (iso: string) => void; min?: string; mark?: string }) {
  const t = useT();
  const lang = useLang();
  const [view, setView] = useState(() => monthStart(value || todayIso()));
  // Dışarıdan tarih değişince (ör. "+2 hafta") görünen ayı ona taşı
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); if (value) setView(monthStart(value)); }

  const today = todayIso();
  const [y, m] = view.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${view.slice(0, 8)}${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const canPrev = !min || shiftMonth(view, -1) >= monthStart(min);

  return (
    <div className="grid gap-2 w-full sm:w-[400px]">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn ghost w-11 h-11 text-xl" disabled={!canPrev} aria-label={t("Önceki ay")} onClick={() => setView(shiftMonth(view, -1))}>‹</button>
        <b className="text-lg capitalize">{fmtMonthYear(view, lang)}</b>
        <button type="button" className="btn ghost w-11 h-11 text-xl" aria-label={t("Sonraki ay")} onClick={() => setView(shiftMonth(view, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
        {WEEK.map((w, i) => <span key={w} className={i >= 5 ? "text-bad" : ""}>{fmtWeekdayShort(w, lang)}</span>)}
      </div>
      <div role="grid" aria-label={fmtMonthYear(view, lang)} className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <span key={`e${i}`} />;
          const off = !!min && c < min;
          const sel = c === value;
          const weekend = i % 7 >= 5;
          return (
            <button key={c} type="button" disabled={off} aria-pressed={sel} aria-label={fmtDate(c)} onClick={() => onChange(c)}
              className={`relative h-11 rounded-xl text-base num grid place-items-center transition-colors
                ${sel ? "bg-green text-white font-bold" : off ? "opacity-30 cursor-not-allowed" : "hover:bg-sunk"}
                ${!sel && c === today ? "ring-2 ring-green font-bold" : ""}
                ${!sel && weekend && !off ? "text-bad" : ""}`}>
              {Number(c.slice(8))}
              {mark === c && !sel && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-gold" aria-hidden />}
            </button>
          );
        })}
      </div>
      {mark && <span className="text-xs text-muted flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-gold" aria-hidden />{t("Bu randevunun günü")}</span>}
    </div>
  );
}
