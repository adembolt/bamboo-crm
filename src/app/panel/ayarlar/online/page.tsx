import Link from "next/link";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() { return { title: (await getT())("Online randevu") }; }
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bamboo-crm-tau.vercel.app";

/* DIKIDI "Online booking": durum, doğrudan bağlantı + QR, yerleştirme kodu, kurallar */
export default async function OnlineBookingPage() {
  const { supabase } = await requireSession();
  const t = await getT();
  const [{ data: s }, { count: svc }, { count: stf }, { count: pending }, { count: deals }] = await Promise.all([
    supabase.from("settings").select("online_booking_enabled, online_requires_approval, online_min_notice_minutes, online_max_days_ahead, online_cancel_limit_minutes").eq("id", 1).single(),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true).eq("online_visible", true),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("is_active", true).eq("online_bookable", true),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("deals").select("id", { count: "exact", head: true }).eq("is_published", true).eq("is_archived", false),
  ]);
  const url = `${SITE}/randevu`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#14261a", light: "#ffffff" } });
  const embed = `<iframe src="${url}" style="width:100%;min-height:760px;border:0" title="Bamboo Beauty Lifes online randevu"></iframe>`;
  const on = !!s?.online_booking_enabled;
  return (
    <div className="grid gap-4 max-w-4xl">
      <h1 className="text-xl font-bold">{t("Online randevu")}</h1>
      <section className={`panel flex items-center gap-3 ${on ? "border-good" : "border-warn"}`}>
        <span className="text-3xl">{on ? "✅" : "⏸"}</span>
        <div className="grid flex-1"><b>{on ? t("Online randevu açık") : t("Online randevu kapalı")}</b><span className="text-sm text-muted">{t("{s} hizmet ve {p} personel online görünüyor.", { s: svc ?? 0, p: stf ?? 0 })}{s?.online_requires_approval ? ` ${t("Talepler salon onayından sonra kesinleşir.")}` : ""}</span></div>
        <Link className="btn ghost sm" href="/panel/ayarlar#online">{t("Kuralları düzenle")}</Link>
      </section>
      <div className="grid md:grid-cols-[auto_minmax(0,1fr)] gap-4 items-start">
        <section className="panel grid gap-2 justify-items-center">
          <img src={qr} alt={t("Online randevu QR kodu")} width={180} height={180} className="rounded-lg" />
          <a className="btn ghost sm" href={qr} download="bamboo-randevu-qr.png">{t("QR kodu indir")}</a>
        </section>
        <section className="panel grid gap-2">
          <b>{t("Doğrudan bağlantı")}</b>
          <code className="text-sm bg-sunk rounded px-2 py-1 break-all">{url}</code>
          <div className="flex gap-2 flex-wrap">{(["tr", "en", "ru"] as const).map((l) => <a key={l} className="btn ghost sm" href={`/randevu?lang=${l}`} target="_blank" rel="noreferrer">{t("Aç")} · {l.toUpperCase()}</a>)}</div>
          <p className="text-xs text-muted">{t("Bu bağlantıyı Instagram profiline, Google İşletme Profili'ndeki “Randevu” alanına ve WhatsApp mesajlarına koyun.")}</p>
          <b className="mt-2">{t("Web sitesine ekle")}</b>
          <code className="text-[11px] bg-sunk rounded px-2 py-1 break-all">{embed}</code>
          <p className="text-xs text-muted">{t("Bu kodu bamboobeautylifes.com'da randevu sayfasına yapıştırın.")}</p>
        </section>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Link href="/panel/online" className="panel hover:border-green"><div className="text-sm text-muted">{t("Bekleyen talepler")}</div><b className="num text-2xl">{pending ?? 0}</b></Link>
        <Link href="/panel/tanitim/kampanyalar" className="panel hover:border-green"><div className="text-sm text-muted">{t("Yayındaki kampanyalar")}</div><b className="num text-2xl">{deals ?? 0}</b></Link>
        <Link href="/panel/hizmetler" className="panel hover:border-green"><div className="text-sm text-muted">{t("Online hizmetler")}</div><b className="num text-2xl">{svc ?? 0}</b></Link>
      </div>
      <section className="panel text-sm grid gap-1">
        <b>{t("Kurallar")}</b>
        <span>{t("En az {n} dk önceden", { n: s?.online_min_notice_minutes ?? 0 })} · {t("en fazla {n} gün ileri", { n: s?.online_max_days_ahead ?? 0 })} · {t("iptal sınırı {n} dk", { n: s?.online_cancel_limit_minutes ?? 0 })}</span>
      </section>
    </div>
  );
}
