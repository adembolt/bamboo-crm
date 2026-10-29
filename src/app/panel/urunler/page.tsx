import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { money } from "@/lib/format";
import { ProductsUI } from "./products-ui";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Ürünler") };
}

export default async function ProductsPage({ searchParams }: PageProps<"/panel/urunler">) {
  const sp = await searchParams;
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const [{ data: products }, { data: staff }, { data: moves }] = await Promise.all([
    supabase.from("products").select("*").order("is_active", { ascending: false }).order("name"),
    supabase.from("staff").select("id, full_name").eq("is_active", true).order("sort_order"),
    supabase.from("stock_moves").select("id, product_id, kind, qty, unit_cost, note, created_at, staff:staff(full_name)").order("created_at", { ascending: false }).limit(300),
  ]);
  const list = (products ?? []).map((p) => ({ ...p, sale_price: Number(p.sale_price), cost_price: Number(p.cost_price), stock_qty: Number(p.stock_qty), min_stock: Number(p.min_stock) }));
  const active = list.filter((p) => p.is_active);
  const low = active.filter((p) => p.min_stock > 0 && p.stock_qty <= p.min_stock);
  const value = active.reduce((s, p) => s + Math.max(0, p.stock_qty) * p.cost_price, 0);
  const retailValue = active.filter((p) => p.is_retail).reduce((s, p) => s + Math.max(0, p.stock_qty) * p.sale_price, 0);
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Ürünler & stok")}</h1>
        <Link className="btn ghost sm ml-auto" href="/panel/urunler/tedarikciler">{t("Tedarikçiler ve depolar")}</Link>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={t("Aktif ürün")} value={String(active.length)} sub={t("{n} satışta", { n: active.filter((p) => p.is_retail).length })} />
        <Kpi label={t("Kritik stok")} value={String(low.length)} sub={low.slice(0, 2).map((p) => p.name).join(", ") || t("yok")} warn={low.length > 0} />
        <Kpi label={t("Stok değeri (alış)")} value={money(value)} sub={t("eldeki miktar × alış fiyatı")} />
        <Kpi label={t("Satış değeri")} value={money(retailValue)} sub={t("satışa açık ürünler")} />
      </div>
      <ProductsUI products={list} staff={staff ?? []} moves={(moves ?? []).map((m) => ({ ...m, qty: Number(m.qty), unit_cost: m.unit_cost == null ? null : Number(m.unit_cost), staff_name: m.staff?.full_name ?? null }))} canWrite={canWrite} initialFilter={typeof sp.f === "string" ? sp.f : ""} />
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-3 grid gap-1 border ${warn ? "bg-warn-bg border-warn/30" : "bg-surface border-line"}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-display text-xl num">{value}</b>
      <span className="text-[11px] text-muted truncate">{sub}</span>
    </div>
  );
}
