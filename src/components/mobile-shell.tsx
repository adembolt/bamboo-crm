"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** Herhangi bir yerden çekmece menüyü açar (takvimdeki ☰ düğmesi gibi) */
export function openMobileMenu() { window.dispatchEvent(new Event("bamboo-menu")); }

export function MenuButton({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <button type="button" onClick={openMobileMenu} aria-label={t("Menü")} className={`w-11 h-11 rounded-full grid place-items-center bg-[var(--chip,var(--sunk))] ${className}`}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  );
}

const TABS = [
  { href: "/panel/takvim", label: "Randevular", icon: "appt" },
  { href: "/panel/personel/takvim", label: "Çalışma", icon: "sched" },
  { href: "/panel", label: "Kontrol", icon: "ctrl" },
  { href: "/panel/mesajlar", label: "Sohbetler", icon: "chat" },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: "set" },
] as const;

function Icon({ name }: { name: string }) {
  const p = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "appt") return <svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M8 3.5v17M11 8h6M11 12h6M11 16h4" /></svg>;
  if (name === "sched") return <svg {...p}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" /><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" strokeWidth="2.6" /></svg>;
  if (name === "ctrl") return <svg {...p} fill="currentColor" stroke="none"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.8" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="13" width="7.5" height="7.5" rx="1.8" /></svg>;
  if (name === "chat") return <svg {...p}><path d="M4 16.5c-1-1.1-1.5-2.4-1.5-3.8C2.5 9 6 6 10.5 6S18.5 9 18.5 12.7s-3.6 6.7-8 6.7c-1 0-2-.1-2.9-.4L4 20.5z" /><path d="M18.4 9.5c1.9.9 3.1 2.5 3.1 4.3 0 1.1-.4 2.1-1.2 3l.7 2.7-2.9-1.3" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.6A7.5 7.5 0 0 0 6.9 6.6l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2.6 1.5l.5 2.6h4l.5-2.6a7.5 7.5 0 0 0 2.6-1.5l2.3 1 2-3.4z" /></svg>;
}

/** Telefonda: üst çubuk (takvim hariç), sol çekmece menü ve DIKIDI'deki gibi alt sekme çubuğu */
export function MobileShell({ drawer }: { drawer: React.ReactNode }) {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("bamboo-menu", on);
    return () => window.removeEventListener("bamboo-menu", on);
  }, []);
  // sayfa değişince çekmece kapanır
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  const active = TABS.filter((x) => (x.href === "/panel" ? path === "/panel" : path === x.href || path.startsWith(x.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const onCalendar = path === "/panel/takvim";

  return (
    <>
      {!onCalendar && (
        <div className="md:hidden print:hidden sticky top-0 z-30 flex items-center gap-3 px-3 py-2 bg-surface/95 backdrop-blur border-b border-line">
          <MenuButton className="!w-10 !h-10" />
          <span className="font-display font-bold">Bamboo</span>
        </div>
      )}

      {open && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal aria-label={t("Menü")}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-surface border-r border-line shadow-card overflow-y-auto p-3 grid content-start gap-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-lg px-2">Bamboo</span>
              <button type="button" className="btn ghost sm" onClick={() => setOpen(false)} aria-label={t("Kapat")}>✕</button>
            </div>
            {drawer}
          </aside>
        </div>
      )}

      <nav aria-label={t("Alt menü")} className="mtabbar md:hidden print:hidden fixed z-40 left-3 right-3 rounded-[28px] border border-white/10 bg-[#1c1c1e]/95 backdrop-blur text-[#f2f2f7] shadow-card px-1.5 py-1.5 flex"
        style={{ bottom: "max(10px, env(safe-area-inset-bottom))" }}>
        {TABS.map((x) => {
          const on = active === x.href;
          return (
            <Link key={x.href} href={x.href} aria-current={on ? "page" : undefined}
              className={`flex-1 min-w-0 grid justify-items-center gap-0.5 rounded-[22px] py-1.5 text-[11px] font-medium ${on ? "bg-black/60 text-[var(--accent)]" : "text-[#f2f2f7]"}`}>
              <Icon name={x.icon} />
              <span className="truncate max-w-full px-1">{t(x.label)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
