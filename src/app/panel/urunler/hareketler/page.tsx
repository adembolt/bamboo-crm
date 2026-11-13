import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fmtTime, money } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";

export async function generateMetadata() { return { title: (await getT())("Stok hareketleri") }; }

const KIND: Record<string, string> = { purchase: "Alış (giriş)", sale: "Satış", use: "Kullanım (sarf)", adjust: "Sayım düzeltmesi", return: "İade" };

/* DIKIDI "Flow of goods": ürün giriş-çıkışları tarih, tür ve ürüne göre */
export default async function StockFlowPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "month");
  const kindF = typeof sp.k === "string" && KIND[sp.k] ? sp.k : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const { supabase } = await requireSession();
  const t = await getT();
  type M = { id: string; kind: string; qty: number; unit_cost: number | null; note: string; created_at: string; product: { id: string; name: string; unit: string | null } | null; staff: { full_name: string } | null };
  let query = supabase.from("stock_moves").select("id, kind, qty, unit_cost, note, created_at, product:products!inner(id, name, unit), staff:staff(full_name)")
    .gte("created_at", `${period.from}T00:00:00+03:00`).lte("created_at", `${period.to}T23:59:59+03:00`).order("created_at", { ascending: false }).limit(1000);
  if (kindF) query = query.eq("kind", kindF as "purchase");
  if (q) query = query.ilike("product.name", `%${q}%`);
  const { data } = await query;
  const list = (data ?? []) as unknown as M[];
  const inQty = list.filter((m) => Number(m.qty) > 0).reduce((a, m) => a + Number(m.qty), 0);
  const outQty = list.filter((m) => Number(m.qty) < 0).reduce((a, m) => a - Number(m.qty), 0);
  const buy = list.filter((m) => m.kind === "purchase").reduce((a, m) => a + Number(m.qty) * Number(m.unit_cost ?? 0), 0);
  const keep = { k: kindF || undefined, q: q || undefined };
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Stok hareketleri")}</h1>
        <Link className="btn sm ml-auto" href="/panel/urunler">+ {t("Giriş / çıkış ekle")}</Link>
      </header>
      <PeriodBar base="/panel/urunler/hareketler" period={period} keep={keep} />
      <form className="flex gap-2 flex-wrap items-end">
        <input type="hidden" name="p" value={period.p} /><input type="hidden" name="d" value={period.d} />
        <label className="f">{t("İşlem")}<span className="inp"><select name="k" defaultValue={kindF}><option value="">{t("Tümü")}</option>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></span></label>
        <label className="f">{t("Ürün")}<span className="inp"><input name="q" defaultValue={q} placeholder={t("Ürün ara…")} /></span></label>
        <button className="btn ghost">{t("Uygula")}</button>
      </form>
      <div className="grid sm:grid-cols-3 gap-3">
        <section className="panel"><div className="text-sm text-muted">{t("Giriş (adet)")}</div><b className="num text-xl text-good">+{inQty}</b></section>
        <section className="panel"><div className="text-sm text-muted">{t("Çıkış (adet)")}</div><b className="num text-xl text-bad">−{outQty}</b></section>
        <section className="panel"><div className="text-sm text-muted">{t("Alış tutarı")}</div><b className="num text-xl">{money(buy)}</b></section>
      </div>
      <section className="panel grid gap-0.5">
        <div className="hidden sm:grid grid-cols-[150px_minmax(0,1fr)_150px_80px_100px_minmax(0,1fr)] gap-3 text-xs text-muted font-semibold pb-1 border-b border-line"><span>{t("Tarih")}</span><span>{t("Ürün")}</span><span>{t("İşlem")}</span><span className="text-right">{t("Miktar")}</span><span className="text-right">{t("Birim maliyet")}</span><span>{t("Not")}</span></div>
        {!list.length && <p className="text-sm text-muted py-2">{t("Bu dönemde stok hareketi yok.")}</p>}
        {list.map((m) => (
          <div key={m.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[150px_minmax(0,1fr)_150px_80px_100px_minmax(0,1fr)] gap-x-3 items-center text-sm py-1 border-b border-dashed border-line">
            <span className="num text-xs text-muted">{fmtDate(m.created_at)} {fmtTime(m.created_at)}</span>
            <b className="truncate">{m.product?.name ?? "—"}</b>
            <span className="text-xs">{t(KIND[m.kind] ?? m.kind)}</span>
            <b className={`num text-right ${Number(m.qty) < 0 ? "text-bad" : "text-good"}`}>{Number(m.qty) > 0 ? "+" : ""}{Number(m.qty)}</b>
            <span className="num text-right text-xs">{m.unit_cost !== null ? money(m.unit_cost) : "—"}</span>
            <span className="text-xs text-muted truncate">{[m.staff?.full_name, m.note].filter(Boolean).join(" · ") || "—"}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
