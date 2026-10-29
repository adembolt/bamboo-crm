import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { fullName, initials, fmtDate, money, todayIso, addDays } from "@/lib/format";
import { NewCustomerForm } from "./new-customer-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Müşteriler") };
}

const PAGE = 50;
const FILTERS = [
  { key: "", label: "Tümü" },
  { key: "upcoming", label: "Randevusu olan" },
  { key: "lost", label: "Kayıp (60+ gün)" },
  { key: "birthday", label: "Doğum günü (7 gün)" },
  { key: "vip", label: "En çok harcayan" },
  { key: "balance", label: "Bakiyesi olan" },
  { key: "package", label: "Paketi olan" },
  { key: "noshow", label: "Gelmeme geçmişi" },
  { key: "new", label: "Yeni (30 gün)" },
] as const;
const SORTS = [
  { key: "last", label: "Son ziyaret" },
  { key: "name", label: "Ad" },
  { key: "spent", label: "Harcama" },
  { key: "visits", label: "Ziyaret sayısı" },
  { key: "created", label: "Kayıt tarihi" },
] as const;

export default async function CustomersPage({ searchParams }: PageProps<"/panel/musteriler">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const f = typeof sp.f === "string" ? sp.f : "";
  const sort = typeof sp.s === "string" && SORTS.some((x) => x.key === sp.s) ? sp.s : f === "vip" ? "spent" : f === "birthday" ? "bday" : f === "upcoming" ? "next" : "last";
  const page = Math.max(1, Number(sp.p) || 1);
  const { supabase, profile } = await requireSession();
  const t = await getT();
  const today = todayIso();

  let query = supabase.from("customer_list").select("*", { count: "exact" });
  if (q) {
    const digits = q.replace(/\D/g, "");
    const like = `%${q.replace(/[%,()]/g, " ")}%`;
    query = digits.length >= 3 ? query.or(`phone.ilike.%${digits}%,first_name.ilike.${like},last_name.ilike.${like}`) : query.or(`first_name.ilike.${like},last_name.ilike.${like}`);
  }
  if (f === "upcoming") query = query.not("next_visit", "is", null);
  if (f === "lost") query = query.lt("last_visit", addDays(today, -60)).is("next_visit", null);
  if (f === "birthday") query = query.lte("bday_in", 7);
  if (f === "vip") query = query.gt("spent", 0);
  if (f === "balance") query = query.gt("balance", 0);
  if (f === "package") query = query.gt("packages", 0);
  if (f === "noshow") query = query.gt("no_show_count", 0);
  if (f === "new") query = query.gte("created_at", addDays(today, -30));
  query =
    sort === "name" ? query.order("first_name").order("last_name")
    : sort === "spent" ? query.order("spent", { ascending: false })
    : sort === "visits" ? query.order("visits", { ascending: false })
    : sort === "created" ? query.order("created_at", { ascending: false })
    : sort === "bday" ? query.order("bday_in")
    : sort === "next" ? query.order("next_visit")
    : query.order("last_visit", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  const { data: rows, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const canExport = !!profile && ["owner", "manager"].includes(profile.role);

  const href = (patch: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = { q: q || undefined, f: f || undefined, s: typeof sp.s === "string" ? sp.s : undefined, p: page > 1 ? page : undefined, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "") u.set(k, String(v));
    const s = u.toString();
    return `/panel/musteriler${s ? "?" + s : ""}`;
  };
  const daysAgo = (d: string | null) => {
    if (!d) return null;
    const n = Math.round((new Date(today + "T12:00:00Z").getTime() - new Date(d + "T12:00:00Z").getTime()) / 864e5);
    return n <= 0 ? t("bugün") : t("{n} gün önce", { n });
  };

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Müşteriler")} <span className="text-muted text-base font-sans">({count ?? 0})</span></h1>
        <form className="ml-auto flex gap-2 flex-wrap" action="/panel/musteriler">
          {f && <input type="hidden" name="f" value={f} />}
          <span className="inp"><input name="q" type="search" defaultValue={q} placeholder={t("Ad, soyad, telefon…")} /></span>
          <span className="inp"><select name="s" defaultValue={typeof sp.s === "string" ? sp.s : ""} aria-label={t("Sırala")}>
            <option value="">{t("Sırala")}: {t("varsayılan")}</option>
            {SORTS.map((x) => <option key={x.key} value={x.key}>{t("Sırala")}: {t(x.label)}</option>)}
          </select></span>
          <button className="btn ghost" type="submit">{t("Ara")}</button>
          {canExport && <a className="btn ghost" href={`/panel/musteriler/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(f ? { f } : {}) }).toString()}`}>⬇ {t("Excel (CSV)")}</a>}
        </form>
      </header>
      <nav className="flex gap-1.5 flex-wrap" aria-label={t("Filtre")}>
        {FILTERS.map((x) => (
          <Link key={x.key} href={href({ f: x.key || undefined, p: undefined, s: undefined })} aria-current={f === x.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${f === x.key ? "bg-green-soft border-green text-ink" : "border-line text-muted hover:text-ink"}`}>{t(x.label)}</Link>
        ))}
      </nav>
      <NewCustomerForm />
      <div className="panel p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-[11px] uppercase tracking-wide text-muted bg-sunk">
            <tr>
              <th className="text-left px-4 py-2">{t("Müşteri")}</th>
              <th className="text-left px-3 py-2">{t("Son ziyaret")}</th>
              <th className="text-left px-3 py-2">{t("Sonraki randevu")}</th>
              <th className="text-right px-3 py-2">{t("Ziyaret")}</th>
              <th className="text-right px-3 py-2">{t("Harcama")}</th>
              <th className="text-left px-3 py-2">{t("Durum")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(rows ?? []).map((c) => {
              const lost = c.last_visit && c.last_visit < addDays(today, -60) && !c.next_visit;
              return (
                <tr key={c.id} className="hover:bg-sunk relative">
                  <td className="px-4 py-2.5">
                    <Link href={`/panel/musteriler/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <span className="w-9 h-9 rounded-full bg-green-soft text-green grid place-items-center text-sm font-bold flex-none">{initials(c.first_name, c.last_name)}</span>
                      <span className="min-w-0">
                        <span className="font-semibold block truncate">{fullName(c)}</span>
                        <span className="text-xs text-muted">{c.phone || t("telefon yok")} · {c.locale.toUpperCase()}{c.tags?.length ? ` · ${c.tags.join(", ")}` : ""}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 num">{c.last_visit ? <><span className="block">{fmtDate(c.last_visit)}</span><span className={`text-[11px] ${lost ? "text-warn font-semibold" : "text-muted"}`}>{daysAgo(c.last_visit)}</span></> : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2.5 num">{c.next_visit ? <span className="pill good">{fmtDate(c.next_visit)}</span> : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2.5 num text-right">{c.visits || <span className="text-muted">0</span>}</td>
                  <td className="px-3 py-2.5 num text-right font-semibold">{Number(c.spent) > 0 ? money(c.spent) : <span className="text-muted font-normal">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex gap-1 flex-wrap">
                      {c.bday_in !== null && c.bday_in <= 7 && <span className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>🎂 {c.bday_in === 0 ? t("bugün") : t("{n} gün", { n: c.bday_in })}</span>}
                      {Number(c.balance) > 0 && <span className="pill good">{t("Bakiye")} {money(c.balance)}</span>}
                      {c.packages > 0 && <span className="pill gold">{t("{n} paket", { n: c.packages })}</span>}
                      {c.no_show_count > 0 && <span className="pill bad">⚠ {c.no_show_count}</span>}
                      {c.is_blocked && <span className="pill bad">{t("engelli")}</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows?.length && <p className="px-4 py-6 text-sm text-muted">{q || f ? t("Sonuç yok.") : t("Henüz müşteri yok.")}</p>}
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-2 justify-center" aria-label={t("Sayfalar")}>
          {page > 1 ? <Link className="btn ghost sm" href={href({ p: page - 1 })}>‹ {t("Önceki")}</Link> : <span className="btn ghost sm opacity-40">‹ {t("Önceki")}</span>}
          <span className="text-sm text-muted num">{t("Sayfa {p} / {n}", { p: page, n: pages })}</span>
          {page < pages ? <Link className="btn ghost sm" href={href({ p: page + 1 })}>{t("Sonraki")} ›</Link> : <span className="btn ghost sm opacity-40">{t("Sonraki")} ›</span>}
        </nav>
      )}
    </div>
  );
}
