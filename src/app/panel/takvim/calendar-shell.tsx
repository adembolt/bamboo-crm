"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

/** Takvim + sağ panel; sağ panel katlanabilir (tercih bu tarayıcıda hatırlanır) */
export function CalendarShell({ side, children }: { side: React.ReactNode; children: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => { try { const v = localStorage.getItem("bamboo-cal-side"); if (v) setOpen(v === "1"); } catch {} }, 0);
    return () => clearTimeout(id);
  }, []);
  const toggle = () => setOpen((o) => { try { localStorage.setItem("bamboo-cal-side", o ? "0" : "1"); } catch {} return !o; });
  return (
    <div className={`grid gap-3 items-start ${open ? "lg:grid-cols-[minmax(0,1fr)_240px]" : "grid-cols-[minmax(0,1fr)]"}`}>
      <div className="min-w-0 relative">
        {children}
        <button type="button" onClick={toggle} className="hidden lg:grid absolute -right-2 top-2 z-40 w-5 h-10 place-items-center rounded-l-md border border-line bg-surface text-muted hover:text-ink text-xs shadow-card"
          title={open ? t("Sağ paneli gizle") : t("Sağ paneli göster")} aria-label={open ? t("Sağ paneli gizle") : t("Sağ paneli göster")} aria-expanded={open}>{open ? "›" : "‹"}</button>
      </div>
      {open && <aside className="grid gap-3 lg:sticky lg:top-3 min-w-0">{side}</aside>}
    </div>
  );
}
