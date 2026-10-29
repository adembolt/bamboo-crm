import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT, getLang } from "@/lib/i18n/server";
import { localName } from "@/lib/i18n/core";
import { fmtDate } from "@/lib/format";
import { CampaignForm, EMPTY_SEGMENT } from "./campaign-form";

export async function generateMetadata() { return { title: (await getT())("Kampanyalar") }; }

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = await requireManager();
  const [t, lang] = [await getT(), await getLang()];
  const [{ data: list }, { data: cats }, { count: total }, { count: consent }, { data: logs }] = await Promise.all([
    supabase.from("campaigns").select("id, name, created_at").order("created_at", { ascending: false }),
    supabase.from("service_categories").select("id, name_tr, name_en, name_ru").eq("is_active", true).order("sort_order"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_blocked", false).neq("phone", ""),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_blocked", false).eq("consent_marketing", true).neq("phone", ""),
    supabase.from("message_log").select("kind").like("kind", "camp:%"),
  ]);
  const sent = new Map<string, number>(); for (const l of logs ?? []) sent.set(l.kind.slice(5), (sent.get(l.kind.slice(5)) ?? 0) + 1);
  return (
    <div className="grid gap-4 max-w-3xl">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/mesajlar">‹</Link>
        <h1 className="text-xl font-bold">{t("Kampanyalar")}</h1>
        {sp.new !== "1" && <Link className="btn sm ml-auto" href="/panel/mesajlar/kampanya?new=1">+ {t("Yeni kampanya")}</Link>}
      </header>
      <p className="text-sm text-muted">{t("Dil grubuna ve son ziyarete göre müşteri seçip her birine kendi dilinde WhatsApp mesajı hazırlayın. Mesajlar tek tek WhatsApp'ta açılır, siz gönderirsiniz (DIKIDI'de olduğu gibi günde 30 civarı önerilir).")}</p>
      {sp.new === "1" && <CampaignForm init={{ name: "", segment: EMPTY_SEGMENT, body_tr: "", body_en: "", body_ru: "" }} categories={(cats ?? []).map((c) => ({ id: c.id, name: localName(c, lang) }))} counts={{ consent: consent ?? 0, total: total ?? 0 }} />}
      <section className="panel grid gap-1">
        {!(list ?? []).length && <p className="text-sm text-muted">{t("Henüz kampanya yok.")}</p>}
        {(list ?? []).map((c) => (
          <Link key={c.id} href={`/panel/mesajlar/kampanya/${c.id}`} className="grid grid-cols-[1fr_auto] gap-2 py-2 border-b border-dashed border-line hover:bg-sunk rounded px-1">
            <span><b>{c.name}</b> <span className="text-xs text-muted">{fmtDate(c.created_at)}</span></span>
            <span className="text-sm text-muted">{t("{n} gönderildi", { n: sent.get(c.id) ?? 0 })}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
