import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fullName } from "@/lib/format";
import { FORMS, FORM_KEYS, type FormKey } from "@/lib/forms/schemas";

export async function generateMetadata() { return { title: (await getT())("Danışan formları") }; }

export default async function FormsListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const key = typeof sp.tur === "string" && (FORM_KEYS as string[]).includes(sp.tur) ? sp.tur : "";
  const st = sp.durum === "bekleyen" ? "pending" : sp.durum === "uyari" ? "flag" : "";
  const { supabase } = await requireSession();
  const t = await getT();
  let q = supabase.from("client_forms").select("id, form_key, form_date, status, flags, staff_name, customer:customers(id, first_name, last_name)").order("created_at", { ascending: false }).limit(300);
  if (key) q = q.eq("form_key", key);
  if (st === "pending") q = q.eq("status", "pending");
  if (st === "flag") q = q.not("flags", "eq", "{}");
  type R = { id: string; form_key: string; form_date: string; status: string; flags: string[]; staff_name: string; customer: { id: string; first_name: string; last_name: string } | null };
  const { data } = await q;
  const rows = (data ?? []) as unknown as R[];
  const link = (p: Record<string, string>) => { const u = new URLSearchParams({ ...(key ? { tur: key } : {}), ...(sp.durum ? { durum: String(sp.durum) } : {}), ...p }); for (const [k, v] of [...u]) if (!v) u.delete(k); return `/panel/musteriler/formlar${u.size ? "?" + u : ""}`; };
  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="text-xl font-bold">{t("Danışan formları")}</h1>
        <p className="text-sm text-muted">{t("Yeni form müşteri kartındaki “Formlar ve sağlık” bölümünden doldurulur.")}</p>
      </header>
      <div className="flex gap-1.5 flex-wrap">
        <Link href={link({ tur: "" })} className={`pill ${!key ? "good" : ""}`}>{t("Tüm formlar")}</Link>
        {FORM_KEYS.map((k) => <Link key={k} href={link({ tur: k })} className={`pill ${key === k ? "good" : ""}`}>{t(FORMS[k].short)}</Link>)}
        <span className="w-px bg-line mx-1" />
        <Link href={link({ durum: "" })} className={`pill ${!st ? "good" : ""}`}>{t("Hepsi")}</Link>
        <Link href={link({ durum: "bekleyen" })} className={`pill ${st === "pending" ? "good" : ""}`}>{t("Danışan bekleniyor")}</Link>
        <Link href={link({ durum: "uyari" })} className={`pill ${st === "flag" ? "good" : ""}`}>⚠ {t("Sağlık uyarısı olan")}</Link>
      </div>
      <section className="panel grid gap-1">
        {!rows.length && <p className="text-sm text-muted">{t("Bu listede form yok.")}</p>}
        {rows.map((f) => (
          <Link key={f.id} href={f.customer ? `/panel/musteriler/${f.customer.id}/formlar/${f.id}` : "#"} className="grid grid-cols-[84px_1fr_auto] sm:grid-cols-[90px_minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-x-3 items-center rounded-lg px-2 py-1.5 hover:bg-sunk text-sm">
            <span className="num text-muted">{fmtDate(f.form_date)}</span>
            <b className="truncate">{f.customer ? fullName(f.customer) : "—"}</b>
            <span className="truncate hidden sm:block">{t(FORMS[f.form_key as FormKey]?.title ?? f.form_key)}{f.staff_name ? <span className="text-muted"> · {f.staff_name}</span> : null}{f.flags.length > 0 && <span className="text-warn text-xs"> · ⚠ {f.flags.slice(0, 3).join(", ")}{f.flags.length > 3 ? "…" : ""}</span>}</span>
            <span className={`pill text-[10px] ${f.status === "pending" ? "warn" : "good"}`}>{f.status === "pending" ? t("bekleniyor") : t("imzalı")}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
