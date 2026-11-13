"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type Child = { href: string; label: string };
type Item = { key: string; href?: string; label: string; icon: string; children?: Child[] };

/* Menü DIKIDI ile aynı sıra ve gruplarla; "Bugün" bizim ana ekranımız */
export const NAV: Item[] = [
  { key: "bugun", href: "/panel", label: "Bugün", icon: "◎" },
  { key: "randevular", href: "/panel/takvim", label: "Randevular", icon: "▦" },
  { key: "calisma", href: "/panel/personel/takvim", label: "Çalışma takvimi", icon: "◷" },
  {
    key: "musteriler", label: "Müşteriler", icon: "☺",
    children: [
      { href: "/panel/musteriler", label: "Müşteri listesi" },
      { href: "/panel/musteriler/tutma", label: "Müşteri tutma" },
      { href: "/panel/musteriler/paketler", label: "Paketler" },
      { href: "/panel/musteriler/sadakat", label: "Sadakat programı" },
      { href: "/panel/mesajlar/kampanya", label: "Toplu mesajlar" },
      { href: "/panel/musteriler/aramalar", label: "Aramalar" },
      { href: "/panel/kasa/hediye", label: "Hediye çekleri" },
      { href: "/panel/musteriler/bahsisler", label: "Bahşişler" },
      { href: "/panel/musteriler/yorumlar", label: "Yorumlar" },
      { href: "/panel/musteriler/cezalar", label: "Cezalar" },
      { href: "/panel/musteriler/formlar", label: "Danışan formları" },
    ],
  },
  {
    key: "tanitim", label: "Tanıtım", icon: "✺",
    children: [
      { href: "/panel/tanitim/referans", label: "Referans programı" },
      { href: "/panel/tanitim/kampanyalar", label: "Kampanyalar" },
      { href: "/panel/online", label: "Online randevu talepleri" },
    ],
  },
  { key: "sohbet", href: "/panel/mesajlar", label: "Sohbetler", icon: "✉" },
  {
    key: "maas", label: "Maaş", icon: "⚖",
    children: [
      { href: "/panel/maas/hesaplama", label: "Bordro hesaplama" },
      { href: "/panel/kasa/maas", label: "Hesaplaşmalar" },
      { href: "/panel/maas/tahakkuklar", label: "Tahakkuklar" },
      { href: "/panel/maas/semalar", label: "Maaş şemaları" },
    ],
  },
  {
    key: "satislar", label: "Satışlar", icon: "▤",
    children: [
      { href: "/panel/satislar", label: "Satış listesi" },
      { href: "/panel/kasa/rapor", label: "Analitik" },
    ],
  },
  {
    key: "finans", label: "Finans", icon: "₺",
    children: [
      { href: "/panel/kasa", label: "Günlük kasa" },
      { href: "/panel/finans/akis", label: "Nakit akışı" },
      { href: "/panel/kasa/hesaplar", label: "Kasa ve banka" },
      { href: "/panel/kasa/ay", label: "Ay özeti" },
      { href: "/panel/kasa/indir", label: "Rapor indir" },
      { href: "/panel/urunler/tedarikciler?k=1", label: "Karşı taraflar" },
    ],
  },
  {
    key: "urunler", label: "Ürünler", icon: "◫",
    children: [
      { href: "/panel/urunler", label: "Ürün listesi" },
      { href: "/panel/urunler/hareketler", label: "Stok hareketleri" },
      { href: "/panel/urunler/tedarikciler#depolar", label: "Depolar" },
      { href: "/panel/urunler/tedarikciler", label: "Tedarikçiler" },
    ],
  },
  {
    key: "ayarlar", label: "Ayarlar", icon: "⚙",
    children: [
      { href: "/panel/ayarlar", label: "Profil" },
      { href: "/panel/personel", label: "Personel" },
      { href: "/panel/hizmetler", label: "Hizmetler" },
      { href: "/panel/ayarlar/online", label: "Online randevu" },
      { href: "/panel/mesajlar/sablonlar", label: "Bildirimler" },
      { href: "/panel/hizmetler/kaynaklar", label: "Kaynaklar" },
      { href: "/panel/ayarlar/uyarilar", label: "Uyarılar" },
      { href: "/panel/ayarlar/kullanicilar", label: "Kullanıcılar ve yetkiler" },
      { href: "/panel/ayarlar/entegrasyonlar", label: "Entegrasyonlar" },
    ],
  },
];

const bare = (h: string) => h.split(/[?#]/)[0];
const under = (path: string, href: string) => { const b = bare(href); return b === "/panel" ? path === "/panel" : path === b || path.startsWith(b + "/"); };

/** Tüm menüde en uzun eşleşen bağlantı seçili sayılır (ör. /panel/kasa/hediye → Müşteriler › Hediye çekleri) */
function bestHref(path: string) {
  let best: string | null = null;
  for (const it of NAV) for (const h of it.children ? it.children.map((c) => c.href) : [it.href!]) {
    if (under(path, h) && (!best || bare(h).length >= bare(best).length)) best = h;
  }
  return best;
}

export function Nav() {
  const path = usePathname();
  const t = useT();
  const best = bestHref(path);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Bulunduğunuz sayfanın grubu açık gelir
  useEffect(() => {
    const g = NAV.find((it) => it.children?.some((c) => c.href === best));
    if (g) setOpen((o) => (o[g.key] === undefined ? { ...o, [g.key]: true } : o));
  }, [best]);

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto flex-1 md:flex-none" aria-label={t("Ana menü")}>
      {NAV.map((it) => {
        if (it.children) {
          const has = it.children.some((c) => c.href === best);
          const isOpen = !!open[it.key];
          return (
            <div key={it.key} className="flex md:flex-col gap-0.5">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [it.key]: !isOpen }))}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-left ${has && !isOpen ? "bg-green-soft text-green" : has ? "text-green" : "text-muted hover:bg-sunk hover:text-ink"}`}>
                <span aria-hidden className="w-4 text-center">{it.icon}</span>
                <span className="hidden sm:inline flex-1">{t(it.label)}</span>
                <span aria-hidden className={`hidden sm:inline text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {isOpen && (
                <div className="flex md:flex-col gap-0.5 md:ml-4 md:pl-2 md:border-l md:border-line md:mb-1">
                  {it.children.map((c) => (
                    <Link key={c.href} href={c.href} aria-current={best === c.href ? "page" : undefined}
                      className={`rounded-lg px-3 py-1.5 text-[13px] whitespace-nowrap ${best === c.href ? "bg-green-soft text-green font-semibold" : "text-muted hover:bg-sunk hover:text-ink"}`}>
                      {t(c.label)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }
        const active = best === it.href;
        return (
          <Link key={it.key} href={it.href!} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${active ? "bg-green-soft text-green" : "text-muted hover:bg-sunk hover:text-ink"}`}>
            <span aria-hidden className="w-4 text-center">{it.icon}</span>
            <span className="hidden sm:inline">{t(it.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
