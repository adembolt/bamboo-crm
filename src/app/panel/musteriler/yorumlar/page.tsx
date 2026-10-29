import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate } from "@/lib/format";

export async function generateMetadata() { return { title: (await getT())("Yorumlar") }; }

export default async function ReviewsPage() {
  const { supabase } = await requireSession();
  const t = await getT();
  const { data } = await supabase.from("reviews").select("id, author_name, rating, body, reply, is_public, source, created_at, customer:customers(id, first_name, last_name)").order("created_at", { ascending: false }).limit(300);
  const list = data ?? [];
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const withText = list.filter((r) => r.body).length;
  const unanswered = list.filter((r) => r.body && !r.reply).length;
  return (
    <div className="grid gap-4 max-w-3xl">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/musteriler">‹</Link>
        <h1 className="text-xl font-bold">{t("Yorumlar")}</h1>
        <span className="pill good">★ {avg.toFixed(1)}</span>
        <span className="text-sm text-muted">{t("{n} değerlendirme · {w} yazılı · {u} cevapsız", { n: list.length, w: withText, u: unanswered })}</span>
      </header>
      {list.map((r) => (
        <article key={r.id} className="panel grid gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <b>{r.customer ? <Link href={`/panel/musteriler/${r.customer.id}`} className="hover:underline">{r.customer.first_name} {r.customer.last_name}</Link> : r.author_name || "—"}</b>
            <span className="text-warn">{"★".repeat(r.rating)}<span className="text-muted">{"★".repeat(5 - r.rating)}</span></span>
            <span className="text-xs text-muted ml-auto">{fmtDate(r.created_at)} · {r.source === "dikidi" ? "DIKIDI" : t(r.source)}{r.is_public ? "" : ` · ${t("gizli")}`}</span>
          </div>
          {r.body ? <p className="text-sm whitespace-pre-line">{r.body}</p> : <p className="text-sm text-muted">{t("Yorum yazılmamış, sadece puan.")}</p>}
          {r.reply && <p className="text-sm whitespace-pre-line border-l-4 border-green/40 pl-3 text-muted">{r.reply}</p>}
        </article>
      ))}
      {!list.length && <p className="text-sm text-muted">{t("Henüz yorum yok.")}</p>}
    </div>
  );
}
