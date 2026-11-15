"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuButton } from "@/components/mobile-shell";
import { useT, useLang } from "@/lib/i18n/client";

const LOC: Record<string, string> = { tr: "tr-TR", en: "en-GB", ru: "ru-RU" };
const add = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmt = (iso: string, lang: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOC[lang] ?? "tr-TR", { ...o, timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));

type View = "day" | "week" | "month" | "list";

/** Telefonda takvimin üstü: ☰ · filtre · ⋯ / Gün–Ay–Liste / kaydırmalı tarih şeridi (DIKIDI uygulamasındaki gibi) */
export function MobileCalHeader({ date, view, today, more }: { date: string; view: View; today: string; more: React.ReactNode }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const days = Array.from({ length: 45 }, (_, i) => add(date, i - 14));
  const href = (d: string, v: View = view === "week" ? "day" : view) => `/panel/takvim?d=${d}${v === "day" ? "" : `&v=${v}`}`;

  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>("[data-on]");
    if (el && strip.current) strip.current.scrollLeft = el.offsetLeft - strip.current.clientWidth / 2 + el.clientWidth / 2;
  }, [date]);

  const seg = (v: View, label: string) => {
    const on = view === v || (v === "day" && view === "week");
    return <Link href={href(date, v)} aria-current={on ? "page" : undefined} className={`flex-1 text-center rounded-full py-2 text-[17px] ${on ? "bg-[#636366] text-white" : "text-[#f2f2f7]"}`}>{label}</Link>;
  };

  return (
    <div className="md:hidden grid gap-3 pt-1" style={{ paddingTop: "max(4px, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-3 px-3">
        <MenuButton />
        <span className="flex-1" />
        {(view === "day" || view === "week") && (
          <button type="button" onClick={() => window.dispatchEvent(new Event("bamboo-cal-filter"))} aria-label={t("Filtre")} className="w-11 h-11 rounded-full grid place-items-center bg-[var(--chip)]">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M3 5h14M5.5 10h9M8 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
        <button type="button" onClick={() => setMoreOpen(true)} aria-label={t("Diğer")} aria-expanded={moreOpen} className="w-11 h-11 rounded-full grid place-items-center bg-[var(--chip)]">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="currentColor"><circle cx="4" cy="10" r="1.8" /><circle cx="10" cy="10" r="1.8" /><circle cx="16" cy="10" r="1.8" /></svg>
        </button>
      </div>

      <div className="mx-3 flex gap-1 p-1 rounded-full bg-[var(--surface)]" role="tablist" aria-label={t("Görünüm")}>
        {seg("day", t("Gün"))}{seg("month", t("Ay"))}{seg("list", t("Liste"))}
      </div>

      {view !== "month" && (
        <div ref={strip} className="flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x">
          <button type="button" aria-label={t("Tarih seç")} onClick={() => { const el = dateInput.current; if (!el) return; try { el.showPicker(); } catch { el.click(); } }}
            className="relative flex-none w-[46px] h-[44px] self-center rounded-xl grid place-items-center bg-[var(--surface)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01" strokeWidth="2.4" strokeLinecap="round" /></svg>
            <input ref={dateInput} type="date" className="absolute inset-0 opacity-0 pointer-events-none" tabIndex={-1} aria-hidden defaultValue={date} onChange={(e) => e.target.value && router.push(href(e.target.value))} />
          </button>
          {days.map((d) => {
            const on = d === date;
            const wd = new Date(d + "T12:00:00Z").getUTCDay();
            const weekend = wd === 0 || wd === 6;
            return (
              <Link key={d} href={href(d)} data-on={on || undefined} aria-current={on ? "date" : undefined}
                className={`flex-none snap-center min-w-[64px] rounded-xl px-2.5 py-1.5 text-center leading-tight ${on ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)]"} ${!on && weekend ? "text-[var(--bad)]" : ""} ${d === today && !on ? "ring-1 ring-[var(--accent)]" : ""}`}>
                <span className="block text-[17px] font-medium whitespace-nowrap">{Number(d.slice(8))} {fmt(d, lang, { weekday: "short" }).replace(".", "").toLocaleLowerCase(LOC[lang])}</span>
                <span className={`block text-[13px] ${on ? "text-white/85" : weekend ? "" : "text-[var(--muted)]"}`}>{fmt(d, lang, { month: "short" }).replace(".", "").toLocaleLowerCase(LOC[lang])}</span>
              </Link>
            );
          })}
        </div>
      )}
      {view !== "month" && <div className="text-center text-[17px] text-[var(--muted)] -mt-1">{fmt(date, lang, { day: "numeric", month: "long", year: "numeric" })}</div>}

      {moreOpen && (
        <div className="fixed inset-0 z-[55]" role="dialog" aria-modal aria-label={t("Diğer")}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-[var(--surface)] border-t border-[var(--line)] p-4 grid gap-2 max-h-[80vh] overflow-y-auto" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setMoreOpen(false); }}>
            <div className="flex items-center justify-between"><b>{t("Diğer")}</b><button type="button" className="btn ghost sm" onClick={() => setMoreOpen(false)} aria-label={t("Kapat")}>✕</button></div>
            {more}
          </div>
        </div>
      )}
    </div>
  );
}

/** Sağ altta yüzen düğmeler: bugüne dön (←) ve yeni randevu (+) */
export function MobileFabs({ backHref, canWrite, view, date }: { backHref?: string; canWrite: boolean; view: View; date: string }) {
  const t = useT();
  const router = useRouter();
  const plus = () => {
    if (view === "day") window.dispatchEvent(new Event("bamboo-cal-new"));
    else router.push(`/panel/takvim?d=${date}&add=1`);
  };
  return (
    <div className="md:hidden fixed right-4 z-30 grid gap-4" style={{ bottom: "calc(max(10px, env(safe-area-inset-bottom)) + 84px)" }}>
      {backHref && <Link href={backHref} aria-label={t("Bugüne dön")} className="w-14 h-14 rounded-full grid place-items-center bg-[var(--accent)] text-white shadow-lg">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M10 5 3 12l7 7v-4.5h7.5a3.5 3.5 0 0 0 0-7H10z" /></svg>
      </Link>}
      {canWrite && <button type="button" onClick={plus} aria-label={t("Yeni randevu")} className="w-14 h-14 rounded-full grid place-items-center bg-[var(--accent)] text-white shadow-lg">
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
      </button>}
    </div>
  );
}
