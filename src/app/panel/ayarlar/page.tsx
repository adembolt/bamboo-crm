import { requireSession } from "@/lib/auth";
import { saveSettings } from "./actions";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage({ searchParams }: PageProps<"/panel/ayarlar">) {
  const sp = await searchParams;
  const { supabase, profile } = await requireSession();
  const canManage = !!profile && ["owner", "manager"].includes(profile.role);
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (!s) return null;
  const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  return (
    <div className="grid gap-4 max-w-2xl">
      <header><h1 className="text-xl font-bold">Ayarlar</h1><p className="text-sm text-muted">İşletme bilgileri, çalışma saatleri ve online randevu kuralları</p></header>
      <div className="panel grid gap-1">
        <div className="eyebrow">Online randevu sayfası</div>
        <div className="flex flex-wrap gap-2 items-center">
          {(["tr", "en", "ru"] as const).map((l) => <a key={l} className="btn ghost sm" href={`/randevu?lang=${l}`} target="_blank" rel="noreferrer">/randevu · {l.toUpperCase()}</a>)}
        </div>
        <p className="text-xs text-muted">Sadece Hizmetler sekmesinde “Online” açık olan hizmetler görünür. Bu linki Instagram bio, Google profili ve WhatsApp mesajlarına koyabilirsin.</p>
      </div>
      <form action={saveSettings} className="panel grid gap-4">
        <fieldset disabled={!canManage} className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="f">İşletme adı<span className="inp"><input name="business_name" defaultValue={s.business_name} /></span></label>
            <label className="f">Slogan<span className="inp"><input name="tagline" defaultValue={s.tagline} /></span></label>
            <label className="f">WhatsApp numarası<span className="inp"><input name="whatsapp_number" defaultValue={s.whatsapp_number} placeholder="+90…" /></span></label>
            <label className="f">Google yorum linki<span className="inp"><input name="google_review_url" defaultValue={s.google_review_url} /></span></label>
            <label className="f">Instagram<span className="inp"><input name="instagram_url" defaultValue={s.instagram_url} /></span></label>
            <label className="f">KDV oranı<span className="inp"><input name="kdv_rate" defaultValue={String(s.kdv_rate)} inputMode="decimal" /></span></label>
          </div>
          <div className="eyebrow">Çalışma saatleri</div>
          <div className="grid grid-cols-3 gap-3">
            <label className="f">Açılış<span className="inp"><input name="open_time" type="time" defaultValue={s.open_time.slice(0, 5)} /></span></label>
            <label className="f">Kapanış<span className="inp"><input name="close_time" type="time" defaultValue={s.close_time.slice(0, 5)} /></span></label>
            <label className="f">Takvim aralığı (dk)<span className="inp"><select name="slot_minutes" defaultValue={String(s.slot_minutes)}>{[10, 15, 20, 30].map((m) => <option key={m} value={m}>{m}</option>)}</select></span></label>
          </div>
          <div className="flex gap-2 flex-wrap">{days.map((d, i) => <label key={d} className="flex items-center gap-1 text-sm font-semibold"><input type="checkbox" name="open_days" value={i + 1} defaultChecked={s.open_days.includes(i + 1)} /> {d}</label>)}</div>
          <div className="eyebrow">Online randevu</div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="online_booking_enabled" defaultChecked={s.online_booking_enabled} /> Online randevu açık</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="online_requires_approval" defaultChecked={s.online_requires_approval} /> Talepler salon onayından sonra kesinleşir</label>
          <div className="grid grid-cols-3 gap-3">
            <label className="f">En az kaç dk önce<span className="inp"><input name="online_min_notice_minutes" inputMode="numeric" defaultValue={s.online_min_notice_minutes} /></span></label>
            <label className="f">En fazla kaç gün ileri<span className="inp"><input name="online_max_days_ahead" inputMode="numeric" defaultValue={s.online_max_days_ahead} /></span></label>
            <label className="f">İptal sınırı (dk)<span className="inp"><input name="online_cancel_limit_minutes" inputMode="numeric" defaultValue={s.online_cancel_limit_minutes} /></span></label>
          </div>
        </fieldset>
        {sp.saved && <p className="pill good">Kaydedildi</p>}
        {canManage && <button className="btn justify-self-end">Kaydet</button>}
      </form>
    </div>
  );
}
