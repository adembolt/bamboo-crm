import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { getT, getLang } from "@/lib/i18n/server";
import { localName } from "@/lib/i18n/core";
import { addDays, fmtDate, fullName, todayIso } from "@/lib/format";
import { pickLocale, waLink } from "@/lib/messages";
import { MessageList, type MsgRow } from "../../message-list";
import { CampaignForm } from "../campaign-form";
import type { Segment } from "../actions";
import { DeleteCampaign } from "./delete-campaign";

export async function generateMetadata() { return { title: (await getT())("Kampanya") }; }

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireManager();
  const [t, lang] = [await getT(), await getLang()];
  const { data: c } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const seg = { langs: ["tr", "en", "ru"], lastVisit: "all", categoryId: null, consentOnly: false, tag: null, ...(c.segment as Partial<Segment>) } as Segment;
  const [{ data: st }, { data: cats }] = await Promise.all([
    supabase.from("settings").select("business_name").eq("id", 1).single(),
    supabase.from("service_categories").select("id, name_tr, name_en, name_ru").eq("is_active", true).order("sort_order"),
  ]);
  const salon = st?.business_name || "Bamboo Beauty Lifes";

  // müşteriler + son ziyaret (+ kategori)
  const custs: { id: string; first_name: string; last_name: string; phone: string; locale: string; nationality: string; is_blocked: boolean; consent_marketing: boolean }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase.from("customers").select("id, first_name, last_name, phone, locale, nationality, is_blocked, consent_marketing").eq("is_blocked", false).neq("phone", "").range(from, from + 999);
    custs.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const last = new Map<string, string>(); const inCat = new Set<string>();
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await supabase.from("visits").select("customer_id, visit_date, items:visit_items(service:services(category_id))").in("status", ["completed", "arrived"]).not("customer_id", "is", null).order("visit_date", { ascending: false }).range(from, from + 999);
    for (const v of (data ?? []) as unknown as { customer_id: string; visit_date: string; items: { service: { category_id: string | null } | null }[] }[]) {
      if (!last.has(v.customer_id)) last.set(v.customer_id, v.visit_date);
      if (seg.categoryId && v.items.some((i) => i.service?.category_id === seg.categoryId)) inCat.add(v.customer_id);
    }
    if (!data || data.length < 1000) break;
  }
  const today = todayIso(), d90 = addDays(today, -90), d180 = addDays(today, -180);
  const picked = custs.filter((cu) => {
    if (seg.consentOnly && !cu.consent_marketing) return false;
    const loc = pickLocale(cu); if (!seg.langs.includes(loc)) return false;
    const lv = last.get(cu.id);
    if (seg.lastVisit === "active" && !(lv && lv >= d90)) return false;
    if (seg.lastVisit === "sleeping" && !(lv && lv < d90 && lv >= d180)) return false;
    if (seg.lastVisit === "lost" && !(lv && lv < d180)) return false;
    if (seg.lastVisit === "never" && lv) return false;
    if (seg.categoryId && !inCat.has(cu.id)) return false;
    return true;
  });
  const kind = `camp:${c.id}`;
  const { data: logs } = await supabase.from("message_log").select("customer_id, sent_at").eq("kind", kind);
  const sentAt = new Map((logs ?? []).map((l) => [l.customer_id, l.sent_at]));
  const bodyFor = (loc: string) => (loc === "ru" ? c.body_ru : loc === "en" ? c.body_en : c.body_tr) || c.body_en || c.body_tr;
  const rows: MsgRow[] = picked.map((cu) => {
    const loc = pickLocale(cu);
    const body = bodyFor(loc).replace(/\{ad\}/g, cu.first_name).replace(/\{salon\}/g, salon);
    const lv = last.get(cu.id);
    return { id: cu.id, customerId: cu.id, visitId: null, name: fullName(cu), phone: cu.phone, locale: loc, meta: lv ? t("Son ziyaret {d}", { d: fmtDate(lv) }) : t("Hiç gelmemiş"), body, href: waLink(cu.phone, body), sentAt: sentAt.get(cu.id) ?? null, blocked: false };
  }).sort((a, b) => (a.sentAt ? 1 : 0) - (b.sentAt ? 1 : 0));
  const byLang = { tr: rows.filter((r) => r.locale === "tr").length, en: rows.filter((r) => r.locale === "en").length, ru: rows.filter((r) => r.locale === "ru").length };
  const editing = sp.edit === "1";
  return (
    <div className="grid gap-4 max-w-3xl">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/mesajlar/kampanya">‹</Link>
        <h1 className="text-xl font-bold">{c.name}</h1>
        <span className="text-sm text-muted">TR {byLang.tr} · EN {byLang.en} · RU {byLang.ru}</span>
        {!editing && <Link className="btn ghost sm ml-auto" href={`/panel/mesajlar/kampanya/${c.id}?edit=1`}>{t("Düzenle")}</Link>}
        <DeleteCampaign id={c.id} />
      </header>
      {editing
        ? <CampaignForm init={{ id: c.id, name: c.name, segment: seg, body_tr: c.body_tr, body_en: c.body_en, body_ru: c.body_ru }} categories={(cats ?? []).map((x) => ({ id: x.id, name: localName(x, lang) }))} />
        : <MessageList rows={rows} kind={kind} />}
    </div>
  );
}
