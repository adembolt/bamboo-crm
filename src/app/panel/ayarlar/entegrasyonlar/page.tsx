import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fmtTime } from "@/lib/format";

export async function generateMetadata() { return { title: (await getT())("Entegrasyonlar") }; }

export default async function IntegrationsPage() {
  const { supabase } = await requireManager();
  const t = await getT();
  const [{ data: wa }, { data: sync }, { data: s }] = await Promise.all([
    supabase.from("wa_bridge").select("state, phone, last_seen, send_enabled").limit(1).maybeSingle(),
    supabase.from("sync_runs").select("finished_at, ok").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("settings").select("google_review_url, instagram_url").eq("id", 1).single(),
  ]);
  const cards = [
    { href: "/panel/ayarlar/whatsapp", icon: "🟢", name: "WhatsApp", status: wa?.state === "connected" ? `${t("Bağlı")}${wa.phone ? ` · ${wa.phone}` : ""}${wa.send_enabled ? "" : ` · ${t("gönderim kapalı")}`}` : t("Bağlı değil"), ok: wa?.state === "connected" },
    { href: "/panel/ayarlar/dikidi", icon: "D", name: t("DIKIDI eşitleme"), status: sync?.finished_at ? `${t("Son eşitleme")}: ${fmtDate(sync.finished_at)} ${fmtTime(sync.finished_at)}${sync.ok ? "" : ` · ${t("hata")}`}` : t("Henüz eşitlenmedi"), ok: !!sync?.ok },
    { href: "/panel/ayarlar?g=1", icon: "G", name: t("Google yorum bağlantısı"), status: s?.google_review_url ? t("Ayarlı") : t("Eksik — yorum isteyen mesajlar Google'a yönlendiremez"), ok: !!s?.google_review_url },
    { href: "/panel/ayarlar", icon: "◎", name: "Instagram", status: s?.instagram_url || t("Eksik"), ok: !!s?.instagram_url },
    { href: "/panel/ayarlar/online", icon: "🌐", name: t("Online randevu sayfası"), status: "/randevu", ok: true },
  ];
  return (
    <div className="grid gap-4 max-w-3xl">
      <h1 className="text-xl font-bold">{t("Entegrasyonlar")}</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link key={c.href + c.name} href={c.href} className="panel flex items-center gap-3 hover:border-green">
            <span className="w-9 h-9 rounded-full bg-sunk grid place-items-center font-bold">{c.icon}</span>
            <span className="grid min-w-0"><b>{c.name}</b><span className={`text-xs truncate ${c.ok ? "text-good" : "text-warn"}`}>{c.status}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
