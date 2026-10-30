"use client";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { saveCampaign, translateCampaign, type Segment } from "./actions";
import { StyleHints } from "../template-editor";

const STARTER = "Merhaba {ad} 🌸\n\n(kısa teşekkür / giriş cümlesi) 💚\n\n✨ (kampanya / öneri)\n\n(nazik soru: size uygun bir gün ayarlayalım mı?)\n\nSevgilerimizle,\nBamboo Beauty Lifes 🌿";

type Cat = { id: string; name: string };
export type CampaignInit = { id?: string | null; name: string; segment: Segment; body_tr: string; body_en: string; body_ru: string };
export const EMPTY_SEGMENT: Segment = { langs: ["tr", "en", "ru"], lastVisit: "all", categoryId: null, consentOnly: false, tag: null };

export function CampaignForm({ init, categories, counts }: { init: CampaignInit; categories: Cat[]; counts?: { consent: number; total: number } }) {
  const t = useT();
  const [f, setF] = useState<CampaignInit>(init);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const seg = f.segment;
  const setSeg = (p: Partial<Segment>) => setF({ ...f, segment: { ...seg, ...p } });
  const toggleLang = (l: "tr" | "en" | "ru") => setSeg({ langs: seg.langs.includes(l) ? seg.langs.filter((x) => x !== l) : [...seg.langs, l] });
  const tr = async () => { setBusy(true); setErr(""); const r = await translateCampaign(f.body_tr); setBusy(false); if (!r.ok) setErr(r.error); else setF((x) => ({ ...x, body_en: r.en, body_ru: r.ru })); };
  const save = () => { setErr(""); start(async () => { const r = await saveCampaign(f); if (r && !r.ok) setErr(r.error); }); };
  return (
    <section className="panel grid gap-3">
      <label className="f">{t("Kampanya adı")}<span className="inp"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("ör. Kasım cilt bakımı fırsatı")} /></span></label>
      <fieldset className="grid gap-2 border border-line rounded-xl p-3">
        <legend className="text-sm font-bold px-1">{t("Kime")}</legend>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-sm">{t("Dil")}:</span>
          {(["tr", "en", "ru"] as const).map((l) => <button key={l} type="button" className={`pill ${seg.langs.includes(l) ? "good" : ""}`} onClick={() => toggleLang(l)}>{seg.langs.includes(l) ? "✓ " : ""}{l.toUpperCase()}</button>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="f">{t("Son ziyaret")}<span className="inp"><select value={seg.lastVisit} onChange={(e) => setSeg({ lastVisit: e.target.value as Segment["lastVisit"] })}>
            <option value="all">{t("Hepsi")}</option>
            <option value="active">{t("Son 90 günde gelenler")}</option>
            <option value="sleeping">{t("90–180 gündür gelmeyenler")}</option>
            <option value="lost">{t("180 günden uzun süredir gelmeyenler")}</option>
            <option value="never">{t("Hiç gelmemiş (kayıtlı)")}</option>
          </select></span></label>
          <label className="f">{t("Bu kategoride hizmet almış")}<span className="inp"><select value={seg.categoryId ?? ""} onChange={(e) => setSeg({ categoryId: e.target.value || null })}>
            <option value="">{t("Fark etmez")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></span></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seg.consentOnly} onChange={(e) => setSeg({ consentOnly: e.target.checked })} />{t("Sadece pazarlama izni verenler")}{counts ? <span className="text-muted">({t("{n} / {m} müşteri izinli", { n: counts.consent, m: counts.total })})</span> : null}</label>
      </fieldset>
      <fieldset className="grid gap-2 border border-line rounded-xl p-3">
        <legend className="text-sm font-bold px-1">{t("Mesaj")}</legend>
        <p className="text-xs text-muted">{t("{ad} müşterinin adıyla, {salon} salon adıyla değişir. Her müşteriye kendi dilindeki metin gider.")}</p>
        <label className="f">TR<textarea className="inp min-h-[200px] p-2" value={f.body_tr} onChange={(e) => setF({ ...f, body_tr: e.target.value })} placeholder={t("Merhaba {ad}, …")} /></label>
        {!f.body_tr.trim() && <button type="button" className="btn ghost sm justify-self-start" onClick={() => setF({ ...f, body_tr: STARTER })}>🌿 {t("Bamboo kalıbıyla başla")}</button>}
        <StyleHints text={f.body_tr} locale="tr" />
        <button type="button" className="btn ghost sm justify-self-start" disabled={busy || !f.body_tr.trim()} onClick={tr}>{busy ? t("Yazılıyor…") : `✨ ${t("İngilizce ve Rusçasını Claude yazsın")}`}</button>
        <label className="f">EN<textarea className="inp min-h-[200px] p-2" value={f.body_en} onChange={(e) => setF({ ...f, body_en: e.target.value })} /></label>
        <StyleHints text={f.body_en} locale="en" />
        <label className="f">RU<textarea className="inp min-h-[200px] p-2" value={f.body_ru} onChange={(e) => setF({ ...f, body_ru: e.target.value })} /></label>
        <StyleHints text={f.body_ru} locale="ru" />
      </fieldset>
      {err && <p className="pill bad">{err}</p>}
      <button className="btn justify-self-start" disabled={pending || !f.name.trim() || !seg.langs.length} onClick={save}>{t("Kaydet ve alıcıları göster")}</button>
    </section>
  );
}
