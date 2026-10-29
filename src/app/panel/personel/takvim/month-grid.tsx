"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT, useLang } from "@/lib/i18n/client";
import { fmtWeekdayShort } from "@/lib/format";
import { setDayHours } from "../actions";

type Row = { staff_id: string; day: string; start_time: string; end_time: string };
type W = { staff_id: string; weekday: number; start_time: string; end_time: string };
type St = { id: string; full_name: string; color: string; mode: string | null; dikidi: boolean };
const wdOf = (d: string) => { const x = new Date(`${d}T12:00:00Z`).getUTCDay(); return x === 0 ? 7 : x; };
const short = (s: string) => s.replace(/:00$/, "");

/** DIKIDI'deki gibi ay görünümü: personel × gün, her güne ayrı saat; hücreleri seçip toplu saat ver */
export function MonthGrid(props: { days: string[]; today: string; staff: St[]; rows: Row[]; weekly: W[]; offs: { staff_id: string; starts_at: string; ends_at: string }[]; salon: { open: string; close: string; days: number[] }; counts: Record<string, number>; canManage: boolean }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [start, setStart] = useState(props.salon.open);
  const [end, setEnd] = useState(props.salon.close);
  const [split, setSplit] = useState(false);
  const [b1, setB1] = useState("14:00");
  const [b2, setB2] = useState("15:00");
  const [pending, run] = useTransition();
  const [err, setErr] = useState("");

  const hours = (s: St, d: string): string[] => {
    if (s.mode === "daily") return props.rows.filter((r) => r.staff_id === s.id && r.day === d).sort((a, b) => a.start_time.localeCompare(b.start_time)).map((r) => `${short(r.start_time)}–${short(r.end_time)}`);
    const mine = props.weekly.filter((r) => r.staff_id === s.id);
    if (!mine.length) return props.salon.days.includes(wdOf(d)) ? [`${short(props.salon.open)}–${short(props.salon.close)}`] : [];
    return mine.filter((r) => r.weekday === wdOf(d)).map((r) => `${short(r.start_time)}–${short(r.end_time)}`);
  };
  const isOff = (sid: string, d: string) => props.offs.some((o) => o.staff_id === sid && o.starts_at <= `${d}T23:59:59+03:00` && o.ends_at >= `${d}T00:00:00+03:00`);
  const key = (sid: string, d: string) => `${sid}|${d}`;
  const toggle = (k: string) => setSel((x) => { const n = new Set(x); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleMany = (ks: string[]) => setSel((x) => { const all = ks.every((k) => x.has(k)); const n = new Set(x); ks.forEach((k) => (all ? n.delete(k) : n.add(k))); return n; });
  const apply = (ranges: { start: string; end: string }[] | null) => {
    setErr("");
    const byStaff = new Map<string, string[]>();
    for (const k of sel) { const [sid, d] = k.split("|"); byStaff.set(sid, [...(byStaff.get(sid) ?? []), d]); }
    run(async () => {
      for (const [sid, ds] of byStaff) { const r = await setDayHours({ staffIds: [sid], days: ds, ranges }); if (!r.ok) { setErr(r.error); return; } }
      setSel(new Set()); router.refresh();
    });
  };
  const ranges = split ? [{ start, end: b1 }, { start: b2, end }] : [{ start, end }];
  const total = (sid: string) => props.days.reduce((n, d) => n + (hours(props.staff.find((s) => s.id === sid)!, d).length && !isOff(sid, d) ? 1 : 0), 0);

  return (
    <div className="grid gap-3">
      {props.canManage && (
        <section className="panel flex flex-wrap items-end gap-2 sticky top-0 z-10">
          <span className="text-sm"><b>{sel.size}</b> {t("hücre seçili")}</span>
          <label className="f">{t("Başlangıç")}<span className="inp"><input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} /></span></label>
          <label className="f">{t("Bitiş")}<span className="inp"><input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} /></span></label>
          <label className="flex items-center gap-1 text-sm pb-2"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />{t("Mola")}</label>
          {split && <><label className="f">{t("Mola başı")}<span className="inp"><input type="time" step={900} value={b1} onChange={(e) => setB1(e.target.value)} /></span></label><label className="f">{t("Mola sonu")}<span className="inp"><input type="time" step={900} value={b2} onChange={(e) => setB2(e.target.value)} /></span></label></>}
          <button className="btn sm" disabled={pending || !sel.size} onClick={() => apply(ranges)}>{t("Saatleri uygula")}</button>
          <button className="btn ghost sm" disabled={pending || !sel.size} onClick={() => apply(null)}>{t("Çalışmıyor yap")}</button>
          {sel.size > 0 && <button className="btn ghost sm" onClick={() => setSel(new Set())}>{t("Seçimi temizle")}</button>}
          {err && <span className="pill bad">{err}</span>}
        </section>
      )}
      <p className="text-xs text-muted">{t("Hücreye tıklayarak seçin; gün başlığına tıklayınca o gün herkes, isme tıklayınca kişinin tüm ayı seçilir. DIKIDI eşitlemesi açıkken DIKIDI'deki personelin takvimi her eşitlemede DIKIDI'den yeniden yazılır.")}</p>
      <div className="panel p-0 overflow-auto">
        <table className="text-xs border-collapse min-w-max">
          <thead>
            <tr className="bg-sunk">
              <th className="sticky left-0 bg-sunk z-[1] text-left px-2 py-1 min-w-[150px]">{t("Personel")}</th>
              {props.days.map((d) => (
                <th key={d} className={`px-1 py-1 font-semibold cursor-pointer select-none ${d === props.today ? "text-green" : wdOf(d) >= 6 ? "text-warn" : ""}`} onClick={() => props.canManage && toggleMany(props.staff.map((s) => key(s.id, d)))}>
                  <div className="num">{Number(d.slice(8))}</div><div className="font-normal text-muted">{fmtWeekdayShort(d, lang)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.staff.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="sticky left-0 bg-surface z-[1] px-2 py-1 cursor-pointer select-none" onClick={() => props.canManage && toggleMany(props.days.map((d) => key(s.id, d)))}>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} /><b className="truncate">{s.full_name}</b></div>
                  <div className="text-[10px] text-muted">{t("{n} gün", { n: total(s.id) })}{s.dikidi ? " · DIKIDI" : ""}</div>
                </td>
                {props.days.map((d) => {
                  const h = hours(s, d), off = isOff(s.id, d), k = key(s.id, d), c = props.counts[k] ?? 0;
                  return (
                    <td key={d} onClick={() => props.canManage && toggle(k)} className={`px-0.5 py-0.5 text-center align-top border-l border-line cursor-pointer select-none min-w-[46px] ${sel.has(k) ? "outline outline-2 outline-green -outline-offset-2 bg-green-soft" : ""} ${!h.length || off ? "bg-sunk/60" : ""}`}>
                      {off ? <span className="text-warn">{t("izin")}</span> : h.length ? h.map((x) => <div key={x} className="num leading-tight">{x}</div>) : <span className="text-muted">—</span>}
                      {c > 0 && <div className="text-[9px] text-muted">{c}✓</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
