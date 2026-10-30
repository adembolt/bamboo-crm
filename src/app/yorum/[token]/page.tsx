import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { BambooLogo } from "@/components/logo";
import { pickLocale } from "@/lib/messages";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Bamboo Beauty Lifes", robots: { index: false, follow: false } };

const TXT = {
  tr: { hi: "Merhaba {ad}", ask: "Ziyaretiniz nasıldı?", sub: "Değerlendirmeniz bizim için çok değerli. 30 saniye sürer." },
  en: { hi: "Hello {ad}", ask: "How was your visit?", sub: "Your feedback means a lot to us. It takes 30 seconds." },
  ru: { hi: "Здравствуйте, {ad}", ask: "Как прошёл ваш визит?", sub: "Ваш отзыв очень важен для нас. Это займёт 30 секунд." },
};

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f]{20,64}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data: v } = await db.from("visits").select("id, visit_date, customer:customers(first_name, last_name, locale, phone, nationality), items:visit_items(service_name, status, staff:staff(full_name))").eq("review_token", token).maybeSingle();
  if (!v) notFound();
  const c = v.customer as { first_name: string; last_name: string; locale: string; phone: string; nationality: string } | null;
  const lang = (["tr", "en", "ru"].includes(String(sp.lang)) ? String(sp.lang) : c ? pickLocale(c) : "tr") as "tr" | "en" | "ru";
  const tx = TXT[lang];
  const { data: ex } = await db.from("reviews").select("rating, body").eq("visit_id", v.id).eq("source", "salon").maybeSingle();
  const items = ((v.items ?? []) as { service_name: string; status: string; staff: { full_name: string } | null }[]).filter((i) => i.status !== "cancelled");
  const date = new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }).format(new Date(`${v.visit_date}T12:00:00+03:00`));
  return (
    <main className="flex-1 px-4 py-8" lang={lang}>
      <div className="max-w-md mx-auto grid gap-5">
        <header className="flex items-center gap-3"><BambooLogo size={48} /><div><b>Bamboo Beauty Lifes</b><div className="text-xs text-muted">Beauty & Wellness · Marmaris</div></div></header>
        <section className="panel grid gap-3">
          <h1 className="text-xl font-bold">{tx.hi.replace("{ad}", c?.first_name ?? "")} 🌿</h1>
          <p className="font-semibold">{tx.ask}</p>
          <p className="text-sm text-muted">{date} · {[...new Set(items.map((i) => i.service_name))].slice(0, 3).join(", ")}{items[0]?.staff ? ` · ${[...new Set(items.map((i) => i.staff?.full_name.split(" ").slice(-1)[0]).filter(Boolean))].join(", ")}` : ""}</p>
          <p className="text-xs text-muted">{tx.sub}</p>
          <ReviewForm token={token} lang={lang} initial={ex ? { rating: ex.rating, body: ex.body } : null} />
        </section>
      </div>
    </main>
  );
}
