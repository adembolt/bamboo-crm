import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { todayIso, addDays, fmtDate, fmtTime, money, fullName } from "@/lib/format";
import { KINDS, VARS, pickLocale, fill, waLink, fmtForLocale, type MsgKind, type MsgLocale } from "@/lib/messages";
import { MessageList, type MsgRow } from "./message-list";
import { TemplateEditor } from "./template-editor";
import { getT } from "@/lib/i18n/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bamboo-crm-tau.vercel.app";

export async function generateMetadata() {
  return { title: (await getT())("Mesajlar") };
}

export default async function MessagesPage({ searchParams }: PageProps<"/panel/mesajlar">) {
  const sp = await searchParams;
  const kind = (KINDS.some((k) => k.key === sp.k) ? sp.k : "reminder") as MsgKind;
  const today = todayIso();
  const d = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : kind === "reminder" ? addDays(today, 1) : today;
  const { supabase, profile } = await requireSession();
  const isManager = !!profile && ["owner", "manager"].includes(profile.role);
  const t = await getT();

  const [{ data: tpls }, { data: settings }] = await Promise.all([
    supabase.from("message_templates").select("*"),
    supabase.from("settings").select("business_name, google_review_url").eq("id", 1).single(),
  ]);
  const tpl = (k: string, l: MsgLocale) => tpls?.find((x) => x.kind === k && x.locale === l)?.body ?? tpls?.find((x) => x.kind === k && x.locale === "en")?.body ?? "";
  const salon = settings?.business_name || "Bamboo Beauty Lifes";
  const review = settings?.google_review_url || "";

  let rows: MsgRow[] = [];

  if (kind === "reminder" || kind === "thanks") {
    const dayStart = new Date(`${d}T00:00:00+03:00`).toISOString(), dayEnd = new Date(`${d}T23:59:59+03:00`).toISOString();
    const { data: items } = await supabase.from("visit_items")
      .select("id, visit_id, service_name, starts_at, price, discount, status, staff:staff(full_name), visit:visits!inner(id, status, review_token, customer:customers(id, first_name, last_name, phone, locale, nationality, is_blocked))")
      .gte("starts_at", dayStart).lte("starts_at", dayEnd).order("starts_at");
    const wanted = kind === "reminder" ? ["pending", "confirmed"] : ["completed", "arrived"];
    const byVisit = new Map<string, NonNullable<typeof items>>();
    for (const it of items ?? []) { if (!wanted.includes(it.status) || !it.visit?.customer?.phone) continue; byVisit.set(it.visit_id, [...(byVisit.get(it.visit_id) ?? []), it]); }
    const visitIds = [...byVisit.keys()];
    const { data: logs } = visitIds.length ? await supabase.from("message_log").select("visit_id, sent_at").eq("kind", kind).in("visit_id", visitIds) : { data: [] };
    for (const [visitId, its] of byVisit) {
      const c = its[0].visit!.customer!;
      const loc = pickLocale(c);
      const services = its.map((i) => i.service_name).join(", ");
      const staffNames = [...new Set(its.map((i) => i.staff?.full_name).filter(Boolean))].join(", ");
      const total = its.reduce((a, i) => a + Number(i.price) - Number(i.discount), 0);
      // Teşekkür mesajında yorum linki: önce kendi puan sayfamız (4–5 yıldız Google'a yönlenir, düşük puan size kalır)
      const token = (its[0].visit as { review_token?: string } | null)?.review_token;
      const yorum = token ? `${SITE}/yorum/${token}` : review;
      let body = fill(tpl(kind, loc), { ad: c.first_name, tarih: fmtForLocale(d, loc), saat: fmtTime(its[0].starts_at), hizmetler: services, personel: staffNames, toplam: money(total), salon, yorum_link: yorum });
      // Şablonda "yarın" sabit; seçilen gün yarın değilse kaldır (tarih zaten yazılı)
      if (kind === "reminder" && d !== addDays(today, 1)) body = body.replace(d === today ? /\byarın\b/i : /\byarın\s+/i, d === today ? "bugün" : "").replace(d === today ? /\btomorrow\b/i : /\btomorrow,?\s*/i, d === today ? "today" : "").replace(d === today ? /завтра/i : /завтра,?\s*/i, d === today ? "сегодня" : "");
      rows.push({ id: visitId, customerId: c.id, visitId, name: fullName(c), phone: c.phone, locale: loc, meta: `${fmtTime(its[0].starts_at)} · ${services}${staffNames ? ` · ${staffNames}` : ""}`, body, href: waLink(c.phone, body), sentAt: logs?.find((l) => l.visit_id === visitId)?.sent_at ?? null, blocked: c.is_blocked });
    }
  } else if (kind === "birthday") {
    const { data: cs } = await supabase.from("customers").select("id, first_name, last_name, phone, locale, nationality, birth_date, is_blocked").not("birth_date", "is", null).neq("phone", "");
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i).slice(5));
    const soon = (cs ?? []).filter((c) => c.birth_date && days.includes(c.birth_date.slice(5))).sort((a, b) => days.indexOf(a.birth_date!.slice(5)) - days.indexOf(b.birth_date!.slice(5)));
    const since = addDays(today, -300);
    const { data: logs } = soon.length ? await supabase.from("message_log").select("customer_id, sent_at").eq("kind", "birthday").in("customer_id", soon.map((c) => c.id)).gte("sent_at", since) : { data: [] };
    rows = soon.map((c) => { const loc = pickLocale(c); const body = fill(tpl("birthday", loc), { ad: c.first_name, salon, yorum_link: review }); const dd = c.birth_date!.slice(5); const idx = days.indexOf(dd);
      return { id: c.id, customerId: c.id, visitId: null, name: fullName(c), phone: c.phone, locale: loc, meta: idx === 0 ? `${t("Bugün")} 🎂` : `${t("{n} gün sonra", { n: idx })} · ${fmtDate(addDays(today, idx))}`, body, href: waLink(c.phone, body), sentAt: logs?.find((l) => l.customer_id === c.id)?.sent_at ?? null, blocked: c.is_blocked }; });
  } else {
    // Geri kazanım: pazarlama izni olan, son tamamlanan ziyareti 60+ gün önce olan müşteriler
    const cutoff = addDays(today, -60);
    const { data: last } = await supabase.from("visits").select("customer_id, visit_date").eq("status", "completed").not("customer_id", "is", null).order("visit_date", { ascending: false }).limit(5000);
    const lastBy = new Map<string, string>();
    for (const v of last ?? []) if (v.customer_id && !lastBy.has(v.customer_id)) lastBy.set(v.customer_id, v.visit_date);
    const ids = [...lastBy.entries()].filter(([, dt]) => dt < cutoff).map(([id]) => id);
    const { data: cs } = ids.length ? await supabase.from("customers").select("id, first_name, last_name, phone, locale, nationality, is_blocked, consent_marketing").in("id", ids.slice(0, 500)).eq("consent_marketing", true).eq("is_blocked", false).neq("phone", "") : { data: [] };
    const since = addDays(today, -45);
    const { data: logs } = cs?.length ? await supabase.from("message_log").select("customer_id, sent_at").eq("kind", "winback").in("customer_id", cs.map((c) => c.id)).gte("sent_at", since) : { data: [] };
    rows = (cs ?? []).map((c) => { const loc = pickLocale(c); const lv = lastBy.get(c.id)!; const body = fill(tpl("winback", loc), { ad: c.first_name, salon, son_ziyaret: fmtDate(lv), yorum_link: review });
      return { id: c.id, customerId: c.id, visitId: null, name: fullName(c), phone: c.phone, locale: loc, meta: t("Son ziyaret {d}", { d: fmtDate(lv) }), body, href: waLink(c.phone, body), sentAt: logs?.find((l) => l.customer_id === c.id)?.sent_at ?? null, blocked: false }; })
      .sort((a, b) => (a.sentAt ? 1 : 0) - (b.sentAt ? 1 : 0));
  }

  const q = (k: string, dd?: string) => `/panel/mesajlar?k=${k}${dd ? `&d=${dd}` : ""}`;
  const info = KINDS.find((k) => k.key === kind)!;

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold">{t("Mesajlar")}</h1>
        <nav className="flex gap-1 bg-sunk p-1 rounded-lg">
          {KINDS.map((k) => <Link key={k.key} href={q(k.key)} className={`px-3 py-1 rounded-md text-sm font-semibold ${k.key === kind ? "bg-surface shadow-card" : "text-muted"}`}>{t(k.label)}</Link>)}
        </nav>
        {(kind === "reminder" || kind === "thanks") && (
          <span className="flex items-center gap-1"><Link className="btn ghost sm" href={q(kind, addDays(d, -1))}>‹</Link><b className="min-w-[110px] text-center">{fmtDate(d)}</b><Link className="btn ghost sm" href={q(kind, addDays(d, 1))}>›</Link></span>
        )}
        {isManager && <Link className="btn sm ml-auto" href="/panel/mesajlar/kampanya">📣 {t("Kampanyalar")}</Link>}
        {isManager && <Link className="btn ghost sm" href="/panel/ayarlar/whatsapp">{t("WhatsApp bağlantısı")} →</Link>}
        {isManager && <Link className="btn ghost sm" href="#sablonlar">{t("Şablonları düzenle")}</Link>}
      </header>
      <p className="text-sm text-muted -mt-2">{t("{hint}. WhatsApp'ta aç → mesaj hazır gelir, siz göndermeye basarsınız; ardından “Gönderildi” işaretleyin.", { hint: t(info.hint) })}</p>

      <MessageList rows={rows} kind={kind} />

      {isManager && <TemplateEditor templates={(tpls ?? []).map((x) => ({ kind: x.kind, locale: x.locale as MsgLocale, body: x.body }))} vars={VARS} />}
    </div>
  );
}
