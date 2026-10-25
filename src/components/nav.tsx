"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/panel", label: "Bugün", icon: "◎" },
  { href: "/panel/takvim", label: "Takvim", icon: "▦" },
  { href: "/panel/musteriler", label: "Müşteriler", icon: "☺" },
  { href: "/panel/hizmetler", label: "Hizmetler", icon: "✦" },
  { href: "/panel/personel", label: "Personel", icon: "⚑" },
  { href: "/panel/online", label: "Online talepler", icon: "⇅" },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: "⚙" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto flex-1 md:flex-none" aria-label="Ana menü">
      {items.map((it) => {
        const active = it.href === "/panel" ? path === "/panel" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${active ? "bg-green-soft text-green" : "text-muted hover:bg-sunk hover:text-ink"}`}
          >
            <span aria-hidden className="w-4 text-center">{it.icon}</span>
            <span className="hidden sm:inline">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
