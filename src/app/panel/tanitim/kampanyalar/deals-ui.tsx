"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { Modal } from "@/components/modal";
import { fmtDate, money, todayIso } from "@/lib/format";
import type { Deal } from "@/lib/database.types";
import { saveDeal, deleteDeal, type DealInput } from "../actions";

type Svc = { id: string; name_tr: string; price: number };
const status = (d: Deal, today: string) => d.is_archived ? "archive" : d.ends_on && d.ends_on < today ? "ended" : d.starts_on > today ? "planned" : d.is_published ? "live" : "draft";

export function DealsList({ deals, services, canEdit }: { deals: Deal[]; services: Svc[]; canEdit: boolean }) {
  const t = useT();
  const router = useRouter();
  const today = todayIso();
  const [f, setF] = useState("active");
  const [edit, setEdit] = useState<DealInput | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const LABEL: Record<string, [string, string]> = { live: [t("Yayında"), "good"], draft: [t("Taslak"), ""], planned: [t("Planlandı"), "warn"], ended: [t("Süresi doldu"), "bad"], archive: [t("Arşiv"), ""] };
  const shown = deals.filter((d) => (f === "active" ? !d.is_archived : f === "archive" ? d.is_archived : true));
  const blank: DealInput = { title: "", description: "", discountPercent: null, price: null, oldPrice: null, startsOn: today, endsOn: null, serviceIds: [], isPublished: true, isArchived: false };
  const svcName = (id: string) => services.find((s) => s.id === id)?.name_tr ?? "";
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {[["active", t("Aktif")], ["archive", t("Arşiv")], ["all", t("Tümü")]].map(([k, l]) => <button key={k} className={`pill ${f === k ? "good" : ""}`} onClick={() => setF(k)}>{l}</button>)}
        {canEdit && <button className="btn sm ml-auto" onClick={() => { setErr(""); setEdit(blank); }}>+ {t("Kampanya ekle")}</button>}
      </div>
      <div className="panel grid gap-1">
        {!shown.length && <p className="text-sm text-muted">{t("Kampanya yok.")}</p>}
        {shown.map((d) => { const st = status(d, today); return (
          <div key={d.id} className="grid sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1 items-center border-b border-dashed border-line py-2">
            <div className="min-w-0"><b>{d.title}</b>
              <div className="text-xs text-muted">{fmtDate(d.starts_on)} → {d.ends_on ? fmtDate(d.ends_on) : t("süresiz")}{d.discount_percent ? ` · %${d.discount_percent}` : ""}{d.price ? ` · ${money(d.price)}` : ""}{d.service_ids.length ? ` · ${d.service_ids.map(svcName).filter(Boolean).slice(0, 3).join(", ")}${d.service_ids.length > 3 ? "…" : ""}` : ""}</div></div>
            <span className={`pill text-[10px] ${LABEL[st][1]}`}>{LABEL[st][0]}</span>
            {canEdit ? <button className="btn ghost sm" onClick={() => { setErr(""); setEdit({ id: d.id, title: d.title, description: d.description, discountPercent: d.discount_percent, price: d.price, oldPrice: d.old_price, startsOn: d.starts_on, endsOn: d.ends_on, serviceIds: d.service_ids, isPublished: d.is_published, isArchived: d.is_archived }); }}>{t("Düzenle")}</button> : <span />}
          </div>); })}
      </div>
      {edit && (
        <Modal title={edit.id ? t("Kampanyayı düzenle") : t("Yeni kampanya")} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3">
            <label className="f">{t("Başlık")}<span className="inp"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder={t("ör. Sonbahar lazer kampanyası")} /></span></label>
            <label className="f">{t("Açıklama")}<span className="inp"><textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></span></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="f">{t("İndirim %")}<span className="inp"><input inputMode="decimal" value={edit.discountPercent ?? ""} onChange={(e) => setEdit({ ...edit, discountPercent: Number(e.target.value) || null })} /></span></label>
              <label className="f">{t("Kampanya fiyatı")}<span className="inp"><input inputMode="decimal" value={edit.price ?? ""} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) || null })} /></span></label>
              <label className="f">{t("Eski fiyat")}<span className="inp"><input inputMode="decimal" value={edit.oldPrice ?? ""} onChange={(e) => setEdit({ ...edit, oldPrice: Number(e.target.value) || null })} /></span></label>
              <label className="f">{t("Başlangıç")}<span className="inp"><input type="date" value={edit.startsOn} onChange={(e) => setEdit({ ...edit, startsOn: e.target.value })} /></span></label>
              <label className="f">{t("Bitiş")}<span className="inp"><input type="date" value={edit.endsOn ?? ""} onChange={(e) => setEdit({ ...edit, endsOn: e.target.value || null })} /></span></label>
            </div>
            <div className="grid gap-1">
              <span className="text-sm font-semibold">{t("Hizmetler")} <span className="text-muted font-normal">({edit.serviceIds.length})</span></span>
              <span className="inp"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Hizmet ara…")} /></span>
              <div className="max-h-44 overflow-y-auto border border-line rounded-lg p-1 grid">
                {services.filter((s) => !q || s.name_tr.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")) || edit.serviceIds.includes(s.id)).slice(0, 60).map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-sunk rounded"><input type="checkbox" checked={edit.serviceIds.includes(s.id)} onChange={(e) => setEdit({ ...edit, serviceIds: e.target.checked ? [...edit.serviceIds, s.id] : edit.serviceIds.filter((x) => x !== s.id) })} /><span className="flex-1 truncate">{s.name_tr}</span><span className="num text-muted text-xs">{money(s.price)}</span></label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={edit.isPublished} onChange={(e) => setEdit({ ...edit, isPublished: e.target.checked })} />{t("Online randevu sayfasında yayınla")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.isArchived} onChange={(e) => setEdit({ ...edit, isArchived: e.target.checked })} />{t("Arşive kaldır")}</label>
            {err && <p className="pill bad">{err}</p>}
            <div className="flex gap-2">
              {edit.id && <button className="btn ghost text-bad" disabled={pending} onClick={() => { if (confirm(t("Kampanya silinsin mi?"))) start(async () => { await deleteDeal(edit.id!); setEdit(null); router.refresh(); }); }}>{t("Sil")}</button>}
              <button className="btn ghost ml-auto" onClick={() => setEdit(null)}>{t("Vazgeç")}</button>
              <button className="btn" disabled={pending} onClick={() => start(async () => { const r = await saveDeal(edit); if (!r.ok) setErr(r.error); else { setEdit(null); router.refresh(); } })}>{t("Kaydet")}</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
