"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type Item = { href: string; label: string; icon: string; children?: { href: string; label: string }[] };

const items: Item[] = [
  { href: "/panel", label: "Bugün", icon: "◎" },
  { href: "/panel/takvim", label: "Takvim", icon: "▦" },
  { href: "/panel/kasa", label: "Kasa", icon: "₺" },
  {
    href: "/panel/musteriler", label: "Müşteriler", icon: "☺",
    children: [
      { href: "/panel/musteriler", label: "Müşteri listesi" },
      { href: "/panel/musteriler/tutma", label: "Müşteri tutma" },
      { href: "/panel/musteriler/paketler", label: "Paketler" },
      { href: "/panel/musteriler/sadakat", label: "Sadakat programı" },
      { href: "/panel/musteriler/formlar", label: "Danışan formları" },
      { href: "/panel/mesajlar/kampanya", label: "Toplu mesajlar" },
      { href: "/panel/kasa/hediye", label: "Hediye çekleri" },
      { href: "/panel/musteriler/yorumlar", label: "Yorumlar" },
    ],
  },
  { href: "/panel/hizmetler", label: "Hizmetler", icon: "✦" },
  { href: "/panel/urunler", label: "Ürünler", icon: "▤" },
  { href: "/panel/personel", label: "Personel", icon: "⚑" },
  { href: "/panel/online", label: "Online talepler", icon: "⇅" },
  { href: "/panel/mesajlar", label: "Mesajlar", icon: "✉" },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: "⚙" },
];

const under = (path: string, href: string) => path === href || path.startsWith(href + "/");
/** Alt menüde en uzun eşleşen bağlantı aktif sayılır (/panel/musteriler/tutma → "Müşteri tutma", /panel/musteriler/<id> → "Müşteri listesi") */
function activeChild(path: string, children: { href: string }[]) {
  return children.filter((c) => under(path, c.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

export function Nav() {
  const path = usePathname();
  const t = useT();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Alt sayfalardan birindeyken grup açık gelir
  useEffect(() => {
    for (const it of items) if (it.children && activeChild(path, it.children)) setOpen((o) => (o[it.href] === undefined ? { ...o, [it.href]: true } : o));
  }, [path]);

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto flex-1 md:flex-none" aria-label={t("Ana menü")}>
      {items.map((it) => {
        if (it.children) {
          const child = activeChild(path, it.children);
          const isOpen = !!open[it.href];
          return (
            <div key={it.href} className="flex md:flex-col gap-1">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [it.href]: !isOpen }))}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-left ${child && !isOpen ? "bg-green-soft text-green" : child ? "text-green" : "text-muted hover:bg-sunk hover:text-ink"}`}>
                <span aria-hidden className="w-4 text-center">{it.icon}</span>
                <span className="hidden sm:inline flex-1">{t(it.label)}</span>
                <span aria-hidden className={`hidden sm:inline text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {isOpen && (
                <div className="flex md:flex-col gap-0.5 md:ml-4 md:pl-2 md:border-l md:border-line">
                  {it.children.map((c) => (
                    <Link key={c.href} href={c.href} aria-current={child === c.href ? "page" : undefined}
                      className={`rounded-lg px-3 py-1.5 text-[13px] whitespace-nowrap ${child === c.href ? "bg-green-soft text-green font-semibold" : "text-muted hover:bg-sunk hover:text-ink"}`}>
                      {t(c.label)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }
        // Bir grubun alt sayfası olan yollar (ör. /panel/kasa/hediye) üst menüde de seçili görünmesin
        const inGroup = items.some((g) => g.children && g.href !== it.href && activeChild(path, g.children) && it.href !== "/panel" && g.children.some((c) => c.href.startsWith(it.href + "/") && under(path, c.href)));
        const active = it.href === "/panel" ? path === "/panel" : under(path, it.href) && !inGroup;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${active ? "bg-green-soft text-green" : "text-muted hover:bg-sunk hover:text-ink"}`}
          >
            <span aria-hidden className="w-4 text-center">{it.icon}</span>
            <span className="hidden sm:inline">{t(it.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
