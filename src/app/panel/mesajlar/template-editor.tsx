"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTemplates, resetTemplates } from "./actions";
import { KINDS, fill, type MsgLocale } from "@/lib/messages";
import { styleIssues, DEFAULT_TEMPLATES } from "@/lib/brand-voice";
import { useT } from "@/lib/i18n/client";

const LOCALES: { key: MsgLocale; label: string }[] = [{ key: "tr", label: "Türkçe" }, { key: "en", label: "English" }, { key: "ru", label: "Русский" }];

const SAMPLE: Record<MsgLocale, Parameters<typeof fill>[1]> = {
  tr: { ad: "Ayşe", tarih: "1 Kasım Cumartesi", saat: "14:00", hizmetler: "Lazer epilasyon · tüm bacak", personel: "Seler", toplam: "2.500 ₺", salon: "Bamboo Beauty Lifes", yorum_link: "https://bamboo-crm-tau.vercel.app/yorum/…", son_ziyaret: "12.08.2026" },
  en: { ad: "Emma", tarih: "Saturday, 1 November", saat: "14:00", hizmetler: "Laser hair removal · full legs", personel: "Seler", toplam: "2,500 ₺", salon: "Bamboo Beauty Lifes", yorum_link: "https://bamboo-crm-tau.vercel.app/yorum/…", son_ziyaret: "12.08.2026" },
  ru: { ad: "Анна", tarih: "суббота, 1 ноября", saat: "14:00", hizmetler: "Лазерная эпиляция · ноги полностью", personel: "Seler", toplam: "2 500 ₺", salon: "Bamboo Beauty Lifes", yorum_link: "https://bamboo-crm-tau.vercel.app/yorum/…", son_ziyaret: "12.08.2026" },
};

/** Üslup uyarıları (marka imzası, emoji, paragraf, yasaklı ifadeler) */
export function StyleHints({ text, locale }: { text: string; locale: MsgLocale }) {
  const t = useT();
  const issues = styleIssues(text, locale);
  if (!text.trim()) return null;
  return issues.length
    ? <ul className="text-xs text-warn grid gap-0.5">{issues.map((i) => <li key={i}>⚠ {t(i)}</li>)}</ul>
    : <p className="text-xs text-good font-semibold">✓ {t("Bamboo üslubuna uygun")}</p>;
}

/** WhatsApp balonu görünümünde önizleme (*kalın* destekli) */
function Bubble({ text }: { text: string }) {
  return (
    <div className="rounded-2xl rounded-tr-sm bg-[#DCF8C6] text-[#111B21] px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap shadow-sm max-w-[340px] justify-self-end">
      {text.split(/(\*[^*\n]+\*)/g).map((p, i) => p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <b key={i}>{p.slice(1, -1)}</b> : <span key={i}>{p}</span>)}
    </div>
  );
}

export function TemplateEditor({ templates, vars }: { templates: { kind: string; locale: MsgLocale; body: string }[]; vars: string[] }) {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState(KINDS[0].key as string);
  const get = (k: string, l: MsgLocale) => templates.find((x) => x.kind === k && x.locale === l)?.body ?? "";
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(KINDS.flatMap((k) => LOCALES.map((l) => [`${k.key}:${l.key}`, get(k.key, l.key)]))));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const loadDefaults = (k: string) => setVals((v) => ({ ...v, ...Object.fromEntries(LOCALES.map((l) => [`${k}:${l.key}`, DEFAULT_TEMPLATES[k as keyof typeof DEFAULT_TEMPLATES][l.key]])) }));
  return (
    <section id="sablonlar" className="panel grid gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-bold">{t("Mesaj şablonları")}</h2>
        <div className="flex gap-1 bg-sunk p-1 rounded-lg flex-wrap">{KINDS.map((k) => <button key={k.key} type="button" onClick={() => setKind(k.key)} className={`px-3 py-1 rounded-md text-sm font-semibold ${kind === k.key ? "bg-surface shadow-card" : "text-muted"}`}>{t(k.label)}</button>)}</div>
        <button type="button" className="btn ghost sm ml-auto" onClick={() => loadDefaults(kind)}>🌿 {t("Bamboo üslubunu yükle")}</button>
      </div>
      <div className="rounded-xl bg-sunk px-3 py-2 text-xs grid gap-1">
        <b>{t("Bamboo WhatsApp üslubu")}</b>
        <span>{t("🌸 selamlama → teşekkür / bilgi (kısa paragraflar, aralarda boş satır; liste için •, öneriler için ✨) → nazik soru → imza.")}</span>
        <span>{t("En az 3 emoji, yalnızca 🌸 ✨ 💚 🌿. Son satır her zaman “Bamboo Beauty Lifes 🌿”. “Anladık” kullanılmaz; HIFU, botoks, dolgu şablonlarda geçmez.")}</span>
      </div>
      <p className="text-xs text-muted">{t("Değişkenler:")} {vars.map((v) => <code key={v} className="mr-2">{v}</code>)}. {t("Değeri boş kalan değişkenin satırı mesajdan çıkarılır (ör. uzman yoksa “Uzmanınız” satırı).")} {t("Müşterinin dili yoksa telefon koduna göre seçilir (+90 TR, +7 RU, diğer EN).")}</p>
      <form action={async (fd) => { await saveTemplates(fd); setMsg(t("Kaydedildi")); router.refresh(); }} className="grid gap-4">
        {KINDS.map((k) => LOCALES.map((l) => {
          const key = `${k.key}:${l.key}`, v = vals[key] ?? "";
          return (
            <div key={key} style={{ display: k.key === kind ? undefined : "none" }} className="grid md:grid-cols-[1fr_340px] gap-3 items-start border-b border-dashed border-line pb-4">
              <div className="grid gap-1">
                <label className="f">{l.label}
                  <textarea name={`tpl:${key}`} value={v} onChange={(e) => setVals((x) => ({ ...x, [key]: e.target.value }))} rows={13} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono leading-relaxed" />
                </label>
                <StyleHints text={v} locale={l.key} />
              </div>
              <div className="grid gap-1 rounded-2xl bg-[#ECE5DD] p-3">
                <span className="text-[10px] font-semibold text-[#54656F]">{t("Önizleme")}</span>
                <Bubble text={fill(v, SAMPLE[l.key])} />
              </div>
            </div>
          );
        }))}
        <div className="flex gap-2 flex-wrap items-center">
          <button className="btn">{t("Şablonları kaydet")}</button>
          <button type="button" className="btn ghost" disabled={pending} onClick={() => { if (!confirm(t("Tüm şablonlar Bamboo üslubundaki varsayılanlarla değiştirilsin mi?"))) return; start(async () => { const r = await resetTemplates(); if (r.ok) { setVals(Object.fromEntries(KINDS.flatMap((k) => LOCALES.map((l) => [`${k.key}:${l.key}`, DEFAULT_TEMPLATES[k.key][l.key]])))); setMsg(t("Tüm şablonlar güncellendi")); router.refresh(); } else setMsg(r.error); }); }}>{t("Tümünü varsayılana döndür")}</button>
          {msg && <span className="pill good">{msg}</span>}
        </div>
      </form>
    </section>
  );
}
