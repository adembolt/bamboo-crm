import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { fullName, initials, fmtDate } from "@/lib/format";
import { NewCustomerForm } from "./new-customer-form";

export const metadata = { title: "Müşteriler" };

export default async function CustomersPage({ searchParams }: PageProps<"/panel/musteriler">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const { supabase } = await requireSession();

  let query = supabase.from("customers").select("id, first_name, last_name, phone, tags, locale, no_show_count, is_blocked, updated_at").order("updated_at", { ascending: false }).limit(100);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const like = `%${q}%`;
    query = digits.length >= 3 ? query.or(`phone.ilike.%${digits}%,first_name.ilike.${like},last_name.ilike.${like}`) : query.or(`first_name.ilike.${like},last_name.ilike.${like}`);
  }
  const { data: customers } = await query;
  const { count } = await supabase.from("customers").select("id", { count: "exact", head: true });

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Müşteriler <span className="text-muted text-base font-sans">({count ?? 0})</span></h1>
        <form className="ml-auto flex gap-2" action="/panel/musteriler">
          <span className="inp"><input name="q" defaultValue={q} placeholder="Ad, soyad, telefon…" /></span>
          <button className="btn ghost" type="submit">Ara</button>
        </form>
      </header>
      <NewCustomerForm />
      <div className="panel p-0 overflow-hidden divide-y divide-line">
        {(customers ?? []).map((c) => (
          <Link key={c.id} href={`/panel/musteriler/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunk">
            <span className="w-9 h-9 rounded-full bg-green-soft text-green grid place-items-center text-sm font-bold flex-none">{initials(c.first_name, c.last_name)}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold block truncate">{fullName(c)} {c.is_blocked && <span className="pill bad ml-1">engelli</span>}</span>
              <span className="text-xs text-muted">{c.phone || "telefon yok"} · {c.locale.toUpperCase()}{c.tags?.length ? ` · ${c.tags.join(", ")}` : ""}</span>
            </span>
            <span className="text-xs text-muted hidden sm:block">{fmtDate(c.updated_at)}</span>
          </Link>
        ))}
        {!customers?.length && <p className="px-4 py-6 text-sm text-muted">{q ? "Sonuç yok." : "Henüz müşteri yok."}</p>}
      </div>
    </div>
  );
}
