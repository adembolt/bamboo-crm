import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeLang, t, LANGS } from "@/lib/booking/i18n";
import { BookingWizard } from "./booking-wizard";
import { BambooLogo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Online Randevu · Bamboo Beauty Lifes",
  description: "Bamboo Beauty Lifes — Marmaris güzellik salonu online randevu",
  robots: { index: true, follow: true },
};

export default async function BookingPage({ searchParams }: PageProps<"/randevu">) {
  const sp = await searchParams;
  const lang = normalizeLang(typeof sp.lang === "string" ? sp.lang : "tr");
  const d = t(lang);
  const db = createAdminClient();

  const [{ data: settings }, { data: cats }, { data: svcs }, { data: staff }] = await Promise.all([
    db.from("settings").select("business_name, tagline, online_booking_enabled, whatsapp_number, online_requires_approval, online_max_days_ahead, open_days").eq("id", 1).single(),
    db.from("service_categories").select("id, name_tr, name_en, name_ru, sort_order, color").eq("is_active", true).order("sort_order"),
    db.from("services").select("id, category_id, name_tr, name_en, name_ru, description_tr, description_en, description_ru, duration_min, price, price_min, session_count").eq("is_active", true).eq("online_visible", true).order("sort_order").order("name_tr"),
    db.from("staff").select("id, full_name, title, color, languages").eq("is_active", true).eq("online_bookable", true).order("sort_order"),
  ]);

  const usedCatIds = new Set((svcs ?? []).map((s) => s.category_id));
  const categories = (cats ?? []).filter((c) => usedCatIds.has(c.id));
  const wa = settings?.whatsapp_number?.replace(/\D/g, "") ?? "";

  return (
    <main className="flex-1 px-4 py-6 md:py-10" lang={lang}>
      <div className="max-w-2xl mx-auto grid gap-5">
        <header className="flex items-center gap-3">
          <BambooLogo size={52} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight">{d.title}</h1>
            <p className="text-sm text-muted">{settings?.business_name ?? "Bamboo Beauty Lifes"} · {settings?.tagline ?? d.subtitle}</p>
          </div>
          <nav className="flex gap-1 bg-sunk p-1 rounded-full" aria-label="Language">
            {LANGS.map((l) => (
              <a key={l} href={`/randevu?lang=${l}`} className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${l === lang ? "bg-green text-white" : "text-muted"}`} aria-current={l === lang ? "page" : undefined}>{l}</a>
            ))}
          </nav>
        </header>

        {!settings?.online_booking_enabled || !(svcs ?? []).length ? (
          <div className="panel grid gap-3">
            <p>{d.closed}</p>
            {wa && <a className="btn w-max" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">{d.whatsapp}</a>}
          </div>
        ) : (
          <BookingWizard
            lang={lang}
            categories={categories}
            services={svcs ?? []}
            staff={staff ?? []}
            requiresApproval={settings.online_requires_approval}
            maxDaysAhead={settings.online_max_days_ahead}
            openDays={settings.open_days}
            whatsapp={wa}
          />
        )}
        <p className="text-center text-xs text-muted">© {new Date().getFullYear()} Bamboo Beauty Lifes · Marmaris</p>
      </div>
    </main>
  );
}
