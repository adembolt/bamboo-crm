import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { todayIso, addDays, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() { return { title: (await getT())("Rapor indir") }; }

const SHEETS: [string, string, string][] = [
  ["gunluk", "Günlük", "Her gün: satış sayısı, ciro, nakit / kart / havale, gider"],
  ["satislar", "Satışlar", "Her satış: müşteri, kalemler, uzman, indirim, ödeme"],
  ["kalemler", "Hizmet ve ürünler", "Satılan her hizmet ve ürün satırı, malzeme maliyetiyle"],
  ["odemeler", "Ödemeler", "Tahsilatlar ödeme yöntemine göre"],
  ["giderler", "Giderler", "Tüm giderler, kategori ve açıklamayla"],
  ["personel", "Personel hak edişi", "Prim, günlük ücret, garanti, avans ve ödenenler"],
];

export default async function DownloadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { profile } = await requireSession();
  const t = await getT();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const today = todayIso(), m = today.slice(0, 7);
  const lastMonthEnd = addDays(`${m}-01`, -1);
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const presets: [string, string, string][] = [
    [t("Bugün"), today, today],
    [t("Bu hafta"), addDays(today, -wd), today],
    [t("Bu ay"), `${m}-01`, today],
    [t("Geçen ay"), `${lastMonthEnd.slice(0, 7)}-01`, lastMonthEnd],
    [t("Son 3 ay"), addDays(today, -90), today],
    [t("Bu yıl"), `${today.slice(0, 4)}-01-01`, today],
  ];
  const ok = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = ok(sp.from) ? String(sp.from) : `${m}-01`, to = ok(sp.to) ? String(sp.to) : today;
  const q = (extra: string) => `/api/kasa/rapor?from=${from}&to=${to}${extra}`;

  if (!isManager) return <p className="pill bad">{t("Bu rapor için yönetici yetkisi gerekir.")}</p>;
  return (
    <div className="grid gap-4 max-w-3xl">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/kasa">‹</Link>
        <h1 className="text-xl font-bold">{t("Rapor indir")}</h1>
      </header>

      <section className="panel grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map(([l, a, b]) => <Link key={l} href={`/panel/kasa/indir?from=${a}&to=${b}`} className={`pill ${a === from && b === to ? "good" : ""}`}>{l}</Link>)}
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <label className="f">{t("Başlangıç")}<span className="inp"><input type="date" name="from" defaultValue={from} /></span></label>
          <label className="f">{t("Bitiş")}<span className="inp"><input type="date" name="to" defaultValue={to} /></span></label>
          <button className="btn ghost">{t("Uygula")}</button>
        </form>
        <p className="text-sm">{t("Seçili dönem")}: <b>{fmtDate(from)} – {fmtDate(to)}</b></p>
        <a className="btn justify-self-start" href={q("&format=xlsx")} download>⬇ {t("Tam rapor (Excel, tüm sayfalar)")}</a>
        <p className="text-xs text-muted">{t("Excel dosyasında Özet, Günlük, Satışlar, Hizmet ve ürünler, Ödemeler, Giderler ve Personel hak edişi sayfaları bulunur; tutarlar sayı olarak gelir, toplam satırları formüldür.")}</p>
      </section>

      <section className="panel grid gap-2">
        <h2 className="font-bold">{t("Tek rapor")}</h2>
        {SHEETS.map(([k, n, d]) => (
          <div key={k} className="flex items-center gap-2 flex-wrap border-b border-dashed border-line pb-2">
            <div className="grid min-w-0 flex-1"><b className="text-sm">{t(n)}</b><span className="text-xs text-muted">{t(d)}</span></div>
            <a className="btn ghost sm" href={q(`&format=xlsx&sheet=${k}`)} download>Excel</a>
            <a className="btn ghost sm" href={q(`&format=csv&sheet=${k}`)} download>CSV</a>
          </div>
        ))}
      </section>
    </div>
  );
}
