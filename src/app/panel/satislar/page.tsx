import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fmtTime, fullName, money } from "@/lib/format";
import { readPeriod } from "@/lib/period";
import { PeriodBar } from "@/components/period-bar";

export async function generateMetadata() { return { title: (await getT())("Satış listesi") }; }

const KIND: Record<string, string> = { service: "Hizmetler", product: "Ürünler", package: "Paketler", gift_card: "Hediye çekleri", balance: "Bakiye yükleme" };
const METHOD: Record<string, string> = { cash: "Nakit", card: "Kart", transfer: "Havale", online: "Online", package: "Paket", gift_card: "Hediye çeki", points: "Puan", balance: "Bakiye", other: "Diğer" };
const NOT_MONEY = ["gift_card", "points", "balance"];

type Sale = { id: string; sale_date: string; created_at: string; total: number; discount: number; notes: string; customer: { id: string; first_name: string; last_name: string; phone: string } | null;
  items: { kind: string; name: string; staff_id: string | null; staff_name: string; qty: number; total: number; material_cost: number; product: { cost_price: number } | null }[]; payments: { method: string; amount: number }[] };

export default async function SalesListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, "day");
  const staffF = typeof sp.s === "string" ? sp.s : "";
  const kindF = typeof sp.k === "string" && KIND[sp.k] ? sp.k : "";
  const q = typeof sp.q === "string" ? sp.q.trim().toLocaleLowerCase("tr") : "";
  const { supabase } = await requireSession();
  const t = await getT();
  const all: Sale[] = [];
  for (let i = 0; i < 20000; i += 1000) {
    const { data } = await supabase.from("sales").select("id, sale_date, created_at, total, discount, notes, customer:customers(id, first_name, last_name, phone), items:sale_items(kind, name, staff_id, staff_name, qty, total, material_cost, product:products(cost_price)), payments:sale_payments(method, amount)")
      .gte("sale_date", period.from).lte("sale_date", period.to).order("sale_date", { ascending: false }).order("created_at", { ascending: false }).range(i, i + 999);
    all.push(...((data ?? []) as unknown as Sale[])); if (!data || data.length < 1000) break;
  }
  const { data: staff } = await supabase.from("staff").select("id, full_name").order("sort_order");
  const sName = (id: string | null, fb = "") => staff?.find((s) => s.id === id)?.full_name ?? fb;
  const sales = all.filter((s) =>
    (!staffF || s.items.some((i) => i.staff_id === staffF)) &&
    (!kindF || s.items.some((i) => i.kind === kindF)) &&
    (!q || (s.customer && (`${s.customer.first_name} ${s.customer.last_name}`.toLocaleLowerCase("tr").includes(q) || s.customer.phone.includes(q)))));

  // Özet: kalem türlerine göre satış, maliyet (malzeme + ürün alış), kâr
  const byKind: Record<string, number> = {}; let materials = 0, productCost = 0;
  for (const s of sales) for (const i of s.items) {
    if (staffF && i.staff_id !== staffF) continue;
    byKind[i.kind] = (byKind[i.kind] ?? 0) + Number(i.total);
    materials += Number(i.material_cost ?? 0);
    if (i.kind === "product" && i.product) productCost += Number(i.product.cost_price) * Number(i.qty);
  }
  const salesSum = Object.values(byKind).reduce((a, b) => a + b, 0);
  const received = sales.reduce((a, s) => a + s.payments.filter((p) => !NOT_MONEY.includes(p.method)).reduce((x, p) => x + Number(p.amount), 0), 0);
  const cost = materials + productCost;
  const keep = { s: staffF || undefined, k: kindF || undefined, q: q || undefined };

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Satış listesi")}</h1>
        <span className="ml-auto flex gap-2">
          <Link className="btn ghost sm" href="/panel/urunler">+ {t("Ürün satışı")}</Link>
          <Link className="btn ghost sm" href="/panel/musteriler/paketler">+ {t("Paket satışı")}</Link>
          <Link className="btn ghost sm" href="/panel/kasa/hediye">+ {t("Hediye çeki")}</Link>
        </span>
      </header>
      <PeriodBar base="/panel/satislar" period={period} keep={keep} />
      <form className="flex gap-2 flex-wrap items-end">
        <input type="hidden" name="p" value={period.p} /><input type="hidden" name="d" value={period.d} />
        <label className="f">{t("Personel")}<span className="inp"><select name="s" defaultValue={staffF}><option value="">{t("Tüm personel")}</option>{(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
        <label className="f">{t("Satış türü")}<span className="inp"><select name="k" defaultValue={kindF}><option value="">{t("Tümü")}</option>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></span></label>
        <label className="f">{t("Müşteri ara")}<span className="inp"><input name="q" defaultValue={q} placeholder={t("isim veya telefon")} /></span></label>
        <button className="btn ghost">{t("Uygula")}</button>
        {(staffF || kindF || q) && <Link className="btn ghost sm" href={`/panel/satislar?p=${period.p}&d=${period.d}`}>{t("Filtreleri temizle")}</Link>}
      </form>

      <div className="grid md:grid-cols-3 gap-3">
        <section className="panel grid gap-1">
          <div className="flex justify-between"><span className="text-sm text-muted">{t("Satış tutarı")}</span><b className="num text-lg">{money(salesSum)}</b></div>
          <div className="text-xs text-muted">{t("{n} satış · tahsilat {amount}", { n: sales.length, amount: money(received) })}</div>
          {Object.entries(KIND).map(([k, l]) => <div key={k} className="flex justify-between text-sm"><span>{t(l)}</span><span className="num">{money(byKind[k] ?? 0)}</span></div>)}
        </section>
        <section className="panel grid gap-1 content-start">
          <div className="flex justify-between"><span className="text-sm text-muted">{t("Maliyet")}</span><b className="num text-lg">{money(cost)}</b></div>
          <div className="flex justify-between text-sm"><span>{t("Malzeme (sarf)")}</span><span className="num">{money(materials)}</span></div>
          <div className="flex justify-between text-sm"><span>{t("Satılan ürünlerin alış maliyeti")}</span><span className="num">{money(productCost)}</span></div>
        </section>
        <section className="panel grid gap-1 content-start">
          <div className="flex justify-between"><span className="text-sm text-muted">{t("Brüt kâr")}</span><b className="num text-lg text-good">{money(salesSum - cost)}</b></div>
          <div className="text-xs text-muted">{t("Kârlılık %{p}", { p: salesSum ? Math.round(((salesSum - cost) / salesSum) * 1000) / 10 : 0 })}</div>
          <p className="text-xs text-muted">{t("Personel hak edişi ve giderler hariç; tam kâr için Finans › Ay özeti.")}</p>
        </section>
      </div>

      <section className="panel grid gap-0.5">
        {!sales.length && <p className="text-sm text-muted">{t("Bu dönemde satış yok.")}</p>}
        {sales.map((s) => (
          <div key={s.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.6fr)_110px_minmax(0,1fr)] gap-x-3 gap-y-0.5 items-center border-b border-dashed border-line py-2 text-sm">
            <span className="num text-muted text-xs">{fmtDate(s.sale_date)} {fmtTime(s.created_at)}</span>
            <span className="min-w-0 truncate font-semibold">{s.customer ? <Link className="hover:underline" href={`/panel/musteriler/${s.customer.id}`}>{fullName(s.customer)}</Link> : t("Anonim")}</span>
            <span className="min-w-0 truncate text-muted sm:text-ink">{s.items.map((i) => `${i.name}${Number(i.qty) > 1 ? ` ×${i.qty}` : ""}`).join(", ")}<span className="text-muted"> · {[...new Set(s.items.map((i) => sName(i.staff_id, i.staff_name)).filter(Boolean))].join(", ")}</span></span>
            <b className="num text-right">{money(s.total)}{Number(s.discount) > 0 && <span className="block text-[11px] text-muted font-normal">{t("indirim")} {money(s.discount)}</span>}</b>
            <span className="text-xs text-muted truncate">{s.payments.map((p) => `${t(METHOD[p.method] ?? p.method)} ${money(p.amount)}`).join(" + ")}</span>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted">{t("Satışı iptal etmek için Finans › Günlük kasa'da ilgili günü açın.")}</p>
    </div>
  );
}
