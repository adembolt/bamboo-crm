"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { useT } from "@/lib/i18n/client";
import { fmtDate, todayIso } from "@/lib/format";
import { FORMS, FORM_KEYS, SESSIONS, GUIDES, type FormKey } from "@/lib/forms/schemas";
import { guideText } from "@/lib/forms/guide";
import { brandMessage } from "@/lib/brand-voice";
import type { MsgLocale } from "@/lib/messages";
import { createFormLink, addClientSession, deleteClientSession, recordGuide } from "./formlar/actions";
import { waLink } from "./formlar/[formId]/view-form";

export type FormRow = { id: string; form_key: string; form_date: string; status: string; flags: string[]; staff_name: string; signed: boolean; visit_id: string | null };
export type SessionRow = { id: string; kind: string; session_date: string; fields: Record<string, string>; staff_name: string };
export type GuideRow = { id: string; guide_key: string; given_at: string };

export function FormsPanel({ customerId, phone, firstName, locale, flags, forms, sessions, guides, staffNames, me, canDeleteSessions }: {
  customerId: string; phone: string; firstName: string; locale: string; flags: string[]; forms: FormRow[]; sessions: SessionRow[]; guides: GuideRow[];
  staffNames: string[]; me: string; canDeleteSessions: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [modal, setModal] = useState<"" | "link" | "session" | "guide">("");
  const [pending, start] = useTransition();
  const hasIntake = forms.some((f) => f.form_key === "intake" && f.status !== "pending");
  const byKind = new Map<string, SessionRow[]>();
  for (const s of sessions) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s]);

  return (
    <section className="panel grid gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-bold">{t("Formlar ve sağlık")}</h2>
        <span className="text-xs text-muted">{t("{n} form · {s} seans", { n: forms.length, s: sessions.length })}</span>
      </div>
      {flags.length > 0 && <div className="flex flex-wrap gap-1.5">{flags.map((f) => <span key={f} className="pill warn">⚠ {f}</span>)}</div>}
      {!hasIntake && <p className="text-sm rounded-lg bg-warn-bg px-3 py-2 font-semibold">{t("Bu danışanın kabul formu yok. İlk ziyarette doldurulması önerilir.")}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FORM_KEYS.map((k) => (
          <Link key={k} href={`/panel/musteriler/${customerId}/formlar/yeni?tur=${k}`} className="rounded-xl border border-line px-3 py-2 hover:border-green hover:bg-green-soft grid">
            <b className="text-sm">{t(FORMS[k].short)}</b>
            <span className="text-[11px] text-muted">{t(FORMS[k].group)}{FORMS[k].sign ? ` · ${t("imzalı")}` : ""}</span>
          </Link>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className="btn ghost sm" onClick={() => setModal("link")}>{t("Danışana bağlantı gönder")}</button>
        <button className="btn ghost sm" onClick={() => setModal("session")}>+ {t("Seans kaydı")}</button>
        <button className="btn ghost sm" onClick={() => setModal("guide")}>{t("Bakım rehberi ver")}</button>
      </div>

      {forms.length > 0 && (
        <div className="grid gap-1">
          {forms.map((f) => (
            <Link key={f.id} href={`/panel/musteriler/${customerId}/formlar/${f.id}`} className="grid grid-cols-[84px_1fr_auto] gap-2 items-center rounded-lg px-2 py-1.5 hover:bg-sunk text-sm">
              <span className="num text-muted">{fmtDate(f.form_date)}</span>
              <span className="min-w-0"><b>{t(FORMS[f.form_key as FormKey]?.title ?? f.form_key)}</b>
                {f.staff_name && <span className="text-muted"> · {f.staff_name}</span>}
                {f.flags.length > 0 && <span className="text-warn text-xs"> · ⚠ {f.flags.length}</span>}</span>
              <span className={`pill text-[10px] ${f.status === "pending" ? "warn" : "good"}`}>{f.status === "pending" ? t("bekleniyor") : f.signed ? t("imzalı") : t("kayıtlı")}</span>
            </Link>
          ))}
        </div>
      )}

      {byKind.size > 0 && (
        <div className="grid gap-3">
          {[...byKind].map(([k, list]) => {
            const T = SESSIONS[k] ?? SESSIONS.other;
            const rows = [...list].sort((a, b) => a.session_date.localeCompare(b.session_date));
            return (
              <div key={k} className="grid gap-1">
                <b className="text-sm">{t(T.name)} · {t("{n} seans", { n: list.length })}</b>
                <div className="overflow-x-auto"><table className="w-full text-xs">
                  <thead><tr className="text-muted text-left"><th className="pr-2">#</th><th className="pr-2">{t("Tarih")}</th>{T.fields.map(([fk, fl]) => <th key={fk} className="pr-2">{t(fl)}</th>)}<th className="pr-2">{t("Uzman")}</th><th /></tr></thead>
                  <tbody>{rows.map((s, i) => (
                    <tr key={s.id} className="border-t border-line"><td className="pr-2 py-1">{i + 1}</td><td className="pr-2 num">{fmtDate(s.session_date)}</td>
                      {T.fields.map(([fk]) => <td key={fk} className="pr-2">{s.fields[fk] ?? ""}</td>)}<td className="pr-2">{s.staff_name}</td>
                      <td>{canDeleteSessions && <button className="text-bad hover:underline" disabled={pending} onClick={() => { if (confirm(t("Seans kaydı silinsin mi?"))) start(async () => { await deleteClientSession(s.id, customerId); router.refresh(); }); }}>{t("sil")}</button>}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            );
          })}
        </div>
      )}
      {guides.length > 0 && <p className="text-xs text-muted">{t("Verilen bakım rehberleri")}: {guides.map((g) => `${t(GUIDES[g.guide_key]?.name ?? g.guide_key)} (${fmtDate(g.given_at)})`).join(", ")}</p>}

      {modal === "link" && <LinkDialog customerId={customerId} phone={phone} firstName={firstName} locale={locale} onClose={() => { setModal(""); router.refresh(); }} />}
      {modal === "session" && <SessionDialog customerId={customerId} staffNames={staffNames} me={me} onClose={() => { setModal(""); router.refresh(); }} />}
      {modal === "guide" && <GuideDialog customerId={customerId} phone={phone} onClose={() => { setModal(""); router.refresh(); }} />}
    </section>
  );
}

function LinkDialog({ customerId, phone, firstName, locale, onClose }: { customerId: string; phone: string; firstName: string; locale: string; onClose: () => void }) {
  const t = useT();
  const [key, setKey] = useState<FormKey>("intake");
  const [lang, setLang] = useState(["en", "ru"].includes(locale) ? locale : "tr");
  const [res, setRes] = useState<{ url: string } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const MSG: Record<string, { greet: string; body: string[]; ask: string }> = {
    tr: { greet: "Merhaba {ad} 🌸", body: ["Randevunuzdan önce sizin için kısa bir form hazırladık; birkaç dakikada doldurup telefonunuzdan imzalayabilirsiniz ✨\n{link}", "Bilgileriniz yalnızca işleminizin güvenli ve size özel planlanması için kullanılır 💚"], ask: "Sorunuz olursa bu mesaja yazmanız yeterli." },
    en: { greet: "Hello {ad} 🌸", body: ["Before your appointment, we've prepared a short form for you — it takes just a few minutes to fill in and sign on your phone ✨\n{link}", "Your information is used only to plan your treatment safely and just for you 💚"], ask: "If you have any questions, simply reply to this message." },
    ru: { greet: "Здравствуйте, {ad} 🌸", body: ["Перед визитом мы подготовили для вас короткую анкету — её можно заполнить и подписать на телефоне за несколько минут ✨\n{link}", "Ваши данные используются только для безопасного и индивидуального планирования процедуры 💚"], ask: "Если появятся вопросы, просто ответьте на это сообщение." },
  };
  const m = MSG[lang] ?? MSG.tr;
  const text = res ? brandMessage(lang as MsgLocale, { greet: m.greet.replace("{ad}", firstName), body: m.body.map((b) => b.replace("{link}", res.url)), ask: m.ask }) : "";
  return (
    <Modal title={t("Danışana bağlantı gönder")} onClose={onClose}>
      <div className="grid gap-3">
        <p className="text-sm text-muted">{t("Danışan formu kendi telefonundan doldurup imzalar (otel, yat, ön kayıt). Mesaj otomatik gönderilmez; WhatsApp'ı siz açarsınız.")}</p>
        <label className="f">{t("Form")}<span className="inp"><select value={key} onChange={(e) => { setKey(e.target.value as FormKey); setRes(null); }}>
          {FORM_KEYS.filter((k) => !FORMS[k].staffForm).map((k) => <option key={k} value={k}>{t(FORMS[k].title)}</option>)}</select></span></label>
        <label className="f">{t("Dil")}<span className="inp"><select value={lang} onChange={(e) => { setLang(e.target.value); setRes(null); }}>
          <option value="tr">Türkçe</option><option value="en">English</option><option value="ru">Русский</option></select></span></label>
        {!res && <button className="btn justify-self-start" disabled={pending} onClick={() => start(async () => { const r = await createFormLink({ customerId, visitId: null, formKey: key, lang }); if (r.ok) setRes({ url: r.url }); else setErr(r.error); })}>{t("Bağlantı oluştur")}</button>}
        {res && (
          <div className="grid gap-2">
            <textarea readOnly className="inp p-2 text-sm min-h-[90px]" value={text} onFocus={(e) => e.target.select()} />
            <div className="flex gap-2 flex-wrap">
              <button className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(text)}>{t("Kopyala")}</button>
              {phone && <a className="btn sm" target="_blank" rel="noreferrer" href={waLink(phone, text)}>{t("WhatsApp'ta aç")}</a>}
            </div>
          </div>
        )}
        {err && <p className="pill bad">{err}</p>}
      </div>
    </Modal>
  );
}

function SessionDialog({ customerId, staffNames, me, onClose }: { customerId: string; staffNames: string[]; me: string; onClose: () => void }) {
  const t = useT();
  const [kind, setKind] = useState("laser");
  const [date, setDate] = useState(todayIso());
  const [staff, setStaff] = useState(me);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const T = SESSIONS[kind];
  return (
    <Modal title={t("Seans kaydı")} onClose={onClose}>
      <div className="grid gap-3">
        <label className="f">{t("İşlem türü")}<span className="inp"><select value={kind} onChange={(e) => { setKind(e.target.value); setFields({}); }}>
          {Object.entries(SESSIONS).map(([k, s]) => <option key={k} value={k}>{t(s.name)}</option>)}</select></span></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="f">{t("Tarih")}<span className="inp"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></span></label>
          <label className="f">{t("Uzman")}<span className="inp"><input list="sess-staff" value={staff} onChange={(e) => setStaff(e.target.value)} /></span></label>
          <datalist id="sess-staff">{staffNames.map((n) => <option key={n} value={n} />)}</datalist>
          {T.fields.map(([k, l]) => <label key={kind + k} className="f">{t(l)}<span className="inp"><input value={fields[k] ?? ""} onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))} /></span></label>)}
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled={pending} onClick={() => start(async () => { const r = await addClientSession({ customerId, visitId: null, kind, date, fields, staffName: staff }); if (r.ok) onClose(); else setErr(r.error); })}>{t("Kaydet")}</button>
          <button className="btn ghost" onClick={onClose}>{t("Vazgeç")}</button>
        </div>
        {err && <p className="pill bad">{err}</p>}
      </div>
    </Modal>
  );
}

function GuideDialog({ customerId, phone, onClose }: { customerId: string; phone: string; onClose: () => void }) {
  const t = useT();
  const [key, setKey] = useState("skin");
  const [lang, setLang] = useState("tr");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const text = guideText(key, lang);
  const record = () => { if (!done) start(async () => { const r = await recordGuide({ customerId, visitId: null, key }); if (r.ok) setDone(true); }); };
  return (
    <Modal title={t("Bakım rehberi ver")} onClose={onClose}>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="f">{t("Rehber")}<span className="inp"><select value={key} onChange={(e) => { setKey(e.target.value); setDone(false); }}>
            {Object.entries(GUIDES).map(([k, g]) => <option key={k} value={k}>{t(g.name)}</option>)}</select></span></label>
          <label className="f">{t("Dil")}<span className="inp"><select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="tr">Türkçe</option><option value="en">English</option><option value="ru">Русский</option></select></span></label>
        </div>
        <textarea readOnly className="inp p-2 text-sm min-h-[220px]" value={text} />
        <div className="flex gap-2 flex-wrap items-center">
          <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(text); record(); }}>{t("Kopyala")}</button>
          {phone && <a className="btn sm" target="_blank" rel="noreferrer" href={waLink(phone, text)} onClick={record}>{t("WhatsApp'ta aç")}</a>}
          {done && <span className="pill good">{t("Karta işlendi")}</span>}
        </div>
      </div>
    </Modal>
  );
}
