"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { useT } from "@/lib/i18n/client";
import { money, fullName } from "@/lib/format";
import { SellDialog, type Tpl } from "../[id]/package-sale";
import { saveTemplate, deleteTemplate, type TemplateInput } from "./actions";

type Svc = { id: string; name_tr: string; price: number; session_count: number; kind: string };
type Row = Tpl & { is_active: boolean };

export function TemplatesPanel({ templates, services, isManager }: { templates: Row[]; services: Svc[]; isManager: boolean }) {
  const t = useT();
  const router = useRouter();
  const [edit, setEdit] = useState<TemplateInput | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const svcName = (id: string | null) => services.find((s) => s.id === id)?.name_tr ?? "";
  const blank: TemplateInput = { name: "", serviceId: null, sessions: 5, price: 0, validDays: 90, description: "", isActive: true };
  return (
    <section className="panel grid gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-bold">{t("Paket şablonları")}</h2>
        <span className="text-xs text-muted">{t("Satışta tek tıkla doldurulur: ad, seans, fiyat, geçerlilik.")}</span>
        {isManager && <button className="btn sm ml-auto" onClick={() => { setErr(""); setEdit(blank); }}>+ {t("Yeni şablon")}</button>}
      </div>
      {!templates.length && <p className="text-sm text-muted">{t("Henüz şablon yok.")}</p>}
      {templates.map((p) => (
        <div key={p.id} className={`grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_auto] gap-x-4 gap-y-1 items-center rounded-xl border border-line px-3 py-2.5 ${p.is_active ? "" : "opacity-55"}`}>
          <div className="grid min-w-0">
            <b className="text-sm">{p.name}</b>
            <span className="text-xs text-muted">{t("{n} seans", { n: p.sessions })}{p.valid_days ? ` · ${t("{n} gün geçerli", { n: p.valid_days })}` : ` · ${t("süresiz")}`}</span>
          </div>
          <div className="grid min-w-0">
            <b className="num">{money(p.price)}</b>
            <span className="text-xs text-muted truncate">{[p.service_id ? `${p.sessions} × ${svcName(p.service_id)}` : "", p.description].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="flex gap-1.5 items-center">
            {!p.is_active && <span className="pill">{t("Pasif")}</span>}
            {isManager && <button className="btn ghost sm" onClick={() => { setErr(""); setEdit({ id: p.id, name: p.name, serviceId: p.service_id, sessions: p.sessions, price: p.price, validDays: p.valid_days, description: p.description, isActive: p.is_active }); }}>{t("Düzenle")}</button>}
          </div>
        </div>
      ))}
      {edit && (
        <Modal title={edit.id ? t("Şablonu düzenle") : t("Yeni paket şablonu")} onClose={() => setEdit(null)}>
          <div className="grid gap-3">
            <label className="f">{t("Paket adı")}<span className="inp"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={t("ör. Lazer koltuk altı 6 seans")} /></span></label>
            <label className="f">{t("Hizmet (seans düşerken eşleşir)")}<span className="inp"><select value={edit.serviceId ?? ""} onChange={(e) => setEdit({ ...edit, serviceId: e.target.value || null })}>
              <option value="">—</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name_tr} · {money(s.price)}</option>)}
            </select></span></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="f">{t("Seans")}<span className="inp"><input inputMode="numeric" value={edit.sessions} onChange={(e) => setEdit({ ...edit, sessions: Number(e.target.value) || 0 })} /></span></label>
              <label className="f">{t("Fiyat")}<span className="inp"><input inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) || 0 })} /></span></label>
              <label className="f">{t("Geçerlilik (gün)")}<span className="inp"><input inputMode="numeric" value={edit.validDays ?? ""} placeholder={t("süresiz")} onChange={(e) => setEdit({ ...edit, validDays: Number(e.target.value) || null })} /></span></label>
            </div>
            <label className="f">{t("Açıklama")}<span className="inp"><input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder={t("ör. 4 seans kart sahibine + 1 seans sevdiği birine")} /></span></label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> {t("Satışta görünsün")}</label>
            {err && <p className="pill bad">{err}</p>}
            <div className="flex gap-2">
              {edit.id && <button className="btn ghost text-bad" disabled={pending} onClick={() => { if (!confirm(t("Şablon silinsin mi? Satılmış paketler etkilenmez."))) return; start(async () => { const r = await deleteTemplate(edit.id!); if (r.ok) { setEdit(null); router.refresh(); } else setErr(r.error); }); }}>{t("Sil")}</button>}
              <button className="btn ghost ml-auto" onClick={() => setEdit(null)}>{t("Vazgeç")}</button>
              <button className="btn" disabled={pending} onClick={() => start(async () => { const r = await saveTemplate(edit); if (r.ok) { setEdit(null); router.refresh(); } else setErr(r.error); })}>{t("Kaydet")}</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

/** Paketler sayfasından paket satışı: önce müşteri seçilir, sonra satış penceresi açılır */
export function SellAnyCustomer({ templates, services, staff, defaultMonths }: { templates: Tpl[]; services: Svc[]; staff: { id: string; full_name: string }[]; defaultMonths: number }) {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<"" | "pick" | "sell">("");
  const [c, setC] = useState<PickedCustomer | null>(null);
  return (
    <>
      <button className="btn sm" onClick={() => { setC(null); setStep("pick"); }}>{t("Paket sat")}</button>
      {step === "pick" && (
        <Modal title={t("Paket sat — müşteri seçin")} onClose={() => setStep("")}>
          <div className="grid gap-3">
            <CustomerPicker value={c} onChange={setC} onNew={() => {}} />
            <div className="flex justify-end gap-2"><button className="btn ghost" onClick={() => setStep("")}>{t("Vazgeç")}</button><button className="btn" disabled={!c} onClick={() => setStep("sell")}>{t("Devam")}</button></div>
          </div>
        </Modal>
      )}
      {step === "sell" && c && (
        <SellDialog customerId={c.id} title={`${t("Seans paketi sat")} · ${fullName(c)}`} templates={templates} services={services} staff={staff} defaultMonths={defaultMonths}
          onClose={() => setStep("")} onDone={() => { setStep(""); router.push(`/panel/musteriler/${c.id}`); }} />
      )}
    </>
  );
}
