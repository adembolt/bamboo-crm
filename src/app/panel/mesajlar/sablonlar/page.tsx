import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { VARS, type MsgLocale } from "@/lib/messages";
import { TemplateEditor } from "../template-editor";

export async function generateMetadata() { return { title: (await getT())("Bildirimler") }; }

/* DIKIDI "Notifications": müşteriye giden hatırlatma, teşekkür, doğum günü ve geri kazanım mesajlarının şablonları */
export default async function NotificationTemplatesPage() {
  const { supabase } = await requireManager();
  const t = await getT();
  const [{ data: tpls }, { data: wa }] = await Promise.all([
    supabase.from("message_templates").select("*"),
    supabase.from("wa_bridge").select("state, send_enabled").limit(1).maybeSingle(),
  ]);
  return (
    <div className="grid gap-4 max-w-5xl">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{t("Bildirimler")}</h1>
        <span className="ml-auto flex gap-2"><Link className="btn ghost sm" href="/panel/mesajlar">{t("Bugünün mesajları")}</Link><Link className="btn ghost sm" href="/panel/ayarlar/whatsapp">{t("WhatsApp bağlantısı")}</Link></span>
      </header>
      <section className="panel text-sm grid gap-1">
        <b>{t("Gönderim durumu")}</b>
        <span className="text-muted">{wa?.send_enabled ? t("WhatsApp üzerinden otomatik gönderim açık.") : t("Otomatik gönderim kapalı: mesajlar Sohbetler sayfasında hazırlanır, WhatsApp'ı siz açıp gönderirsiniz.")}</span>
      </section>
      <TemplateEditor templates={(tpls ?? []).map((x) => ({ kind: x.kind, locale: x.locale as MsgLocale, body: x.body }))} vars={VARS} />
    </div>
  );
}
