import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fmtTime, fullName, addDays, todayIso } from "@/lib/format";

export async function generateMetadata() { return { title: (await getT())("Uyarılar") }; }

type A = { at: string; icon: string; title: string; detail: string; href: string; tone: "warn" | "bad" | "good" | "" };

/* DIKIDI "Alerts" (yeni online randevu, değişiklik, iptal) — burada e-posta yerine panel içi uyarı akışı */
export default async function AlertsPage() {
  const { supabase } = await requireSession();
  const t = await getT();
  const today = todayIso(), since = `${addDays(today, -7)}T00:00:00+03:00`;
  type Cust = { id: string; first_name: string; last_name: string } | null;
  const [{ data: reqs }, { data: cancels }, { data: noshows }, { data: revs }, { data: pforms }, { data: pkgs }, { data: prods }] = await Promise.all([
    supabase.from("booking_requests").select("id, first_name, last_name, starts_at, created_at, status, service:services(name_tr)").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("visit_items").select("service_name, starts_at, updated_at, visit:visits!inner(source, customer:customers(id, first_name, last_name))").eq("status", "cancelled").gte("updated_at", since).order("updated_at", { ascending: false }).limit(50),
    supabase.from("visit_items").select("service_name, starts_at, visit:visits!inner(customer:customers(id, first_name, last_name))").eq("status", "no_show").gte("starts_at", since).order("starts_at", { ascending: false }).limit(50),
    supabase.from("reviews").select("id, rating, body, author_name, created_at, handled").lte("rating", 3).eq("handled", false).gte("created_at", `${addDays(today, -60)}T00:00:00+03:00`).limit(20),
    supabase.from("client_forms").select("id, form_key, created_at, customer:customers(id, first_name, last_name)").eq("status", "pending").limit(30),
    supabase.from("customer_packages").select("name, expires_at, total_sessions, used_sessions, customer:customers(id, first_name, last_name)").eq("is_active", true).gte("expires_at", today).lte("expires_at", addDays(today, 14)).limit(30),
    supabase.from("products").select("id, name, stock_qty, min_stock").eq("is_active", true).gt("min_stock", 0).limit(500),
  ]);
  const al: A[] = [];
  for (const r of reqs ?? []) al.push({ at: r.created_at, icon: "🌐", title: r.status === "new" ? t("Yeni online randevu talebi") : t("Online randevu talebi"), detail: `${r.first_name} ${r.last_name} · ${(r.service as { name_tr: string } | null)?.name_tr ?? ""} · ${fmtDate(r.starts_at)} ${fmtTime(r.starts_at)}`, href: "/panel/online", tone: r.status === "new" ? "warn" : "" });
  for (const x of (cancels ?? []) as unknown as { service_name: string; starts_at: string; updated_at: string; visit: { source: string; customer: Cust } }[]) al.push({ at: x.updated_at, icon: "✕", title: t("Randevu iptal edildi"), detail: `${x.visit.customer ? fullName(x.visit.customer) : t("Müşteri yok")} · ${x.service_name} · ${fmtDate(x.starts_at)} ${fmtTime(x.starts_at)}`, href: `/panel/takvim?d=${x.starts_at.slice(0, 10)}`, tone: "bad" });
  for (const x of (noshows ?? []) as unknown as { service_name: string; starts_at: string; visit: { customer: Cust } }[]) al.push({ at: x.starts_at, icon: "⚠", title: t("Müşteri gelmedi"), detail: `${x.visit.customer ? fullName(x.visit.customer) : "—"} · ${x.service_name}`, href: "/panel/musteriler/cezalar", tone: "bad" });
  for (const r of revs ?? []) al.push({ at: r.created_at, icon: "★", title: t("Düşük puanlı yorum ({n}★)", { n: r.rating }), detail: `${r.author_name} · ${r.body.slice(0, 80)}`, href: "/panel/musteriler/yorumlar?low=1", tone: "warn" });
  for (const f of (pforms ?? []) as unknown as { id: string; form_key: string; created_at: string; customer: Cust }[]) al.push({ at: f.created_at, icon: "✍", title: t("Danışan formu bekleniyor"), detail: f.customer ? fullName(f.customer) : "—", href: "/panel/musteriler/formlar?durum=bekleyen", tone: "" });
  for (const p of (pkgs ?? []) as unknown as { name: string; expires_at: string; total_sessions: number; used_sessions: number; customer: Cust }[]) al.push({ at: `${p.expires_at}T09:00:00+03:00`, icon: "⏳", title: t("Paketin süresi doluyor"), detail: `${p.customer ? fullName(p.customer) : "—"} · ${p.name} · ${t("kalan {n} seans", { n: p.total_sessions - p.used_sessions })} · ${fmtDate(p.expires_at)}`, href: p.customer ? `/panel/musteriler/${p.customer.id}` : "/panel/musteriler/paketler?tab=satilan", tone: "warn" });
  const low = (prods ?? []).filter((p) => Number(p.stock_qty) <= Number(p.min_stock));
  if (low.length) al.push({ at: new Date().toISOString(), icon: "▤", title: t("Kritik stok: {n} ürün", { n: low.length }), detail: low.slice(0, 5).map((p) => `${p.name} (${Number(p.stock_qty)})`).join(", "), href: "/panel/urunler", tone: "warn" });
  al.sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="grid gap-4 max-w-3xl">
      <h1 className="text-xl font-bold">{t("Uyarılar")}</h1>
      <p className="text-sm text-muted">{t("Son 7 günün önemli olayları: yeni online talepler, iptaller, gelmeyenler, düşük puanlı yorumlar, bekleyen formlar, süresi dolan paketler ve kritik stok.")}</p>
      <section className="panel grid gap-0.5">
        {!al.length && <p className="text-sm text-muted">{t("Yeni uyarı yok.")}</p>}
        {al.map((a, i) => (
          <Link key={i} href={a.href} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-2 items-start rounded-lg px-2 py-2 hover:bg-sunk border-b border-dashed border-line">
            <span className={`text-center ${a.tone === "bad" ? "text-bad" : a.tone === "warn" ? "text-warn" : "text-green"}`}>{a.icon}</span>
            <span className="min-w-0"><b className="text-sm">{a.title}</b><span className="block text-xs text-muted truncate">{a.detail}</span></span>
            <span className="text-[11px] text-muted num whitespace-nowrap">{fmtDate(a.at)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
