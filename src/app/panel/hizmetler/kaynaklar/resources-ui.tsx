"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT, useLang } from "@/lib/i18n/client";
import { localName } from "@/lib/i18n/core";
import { saveResource, deleteResource } from "./actions";

type Cat = { id: string; name_tr: string; name_en?: string | null; name_ru?: string | null };
type Res = { id: string; name: string; kind: "room" | "device" | "other"; capacity: number; is_active: boolean; categoryIds: string[]; partial: string[]; serviceCount: number };
type Form = { id: string | null; name: string; kind: Res["kind"]; capacity: number; active: boolean; categoryIds: string[] };

export function ResourcesUI({ resources, categories, canManage }: { resources: Res[]; categories: Cat[]; canManage: boolean }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const catName = (id: string) => { const c = categories.find((x) => x.id === id); return c ? localName(c, lang) : "?"; };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => { setErr(""); start(async () => { const r = await fn(); if (!r.ok) setErr(r.error ?? t("Hata")); else { setF(null); router.refresh(); } }); };
  return (
    <div className="grid gap-3">
      {resources.map((r) => (
        <section key={r.id} className={`panel grid gap-1 ${r.is_active ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-2">
            <b>{r.name}</b>
            <span className="pill text-[10px]">{t(r.kind === "room" ? "Kabin" : r.kind === "device" ? "Cihaz" : "Diğer")}{r.capacity > 1 ? ` ×${r.capacity}` : ""}</span>
            {canManage && <button className="btn ghost sm ml-auto" onClick={() => setF({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity, active: r.is_active, categoryIds: r.categoryIds })}>{t("Düzenle")}</button>}
          </div>
          <p className="text-xs text-muted">{r.categoryIds.length ? r.categoryIds.map(catName).join(", ") : t("Henüz hizmet atanmadı")}{r.partial.length ? ` · ${t("kısmen")}: ${r.partial.map(catName).join(", ")}` : ""} · {t("{n} hizmet", { n: r.serviceCount })}</p>
        </section>
      ))}
      {!resources.length && <p className="text-sm text-muted">{t("Henüz kabin yok. DIKIDI'de 2 kabin vardı: masaj kabini ve kozmetolog kabini.")}</p>}
      {canManage && !f && <button className="btn sm justify-self-start" onClick={() => setF({ id: null, name: "", kind: "room", capacity: 1, active: true, categoryIds: [] })}>+ {t("Kabin / cihaz ekle")}</button>}
      {f && (
        <section className="panel grid gap-2">
          <div className="grid sm:grid-cols-[1fr_140px_100px] gap-2">
            <label className="f">{t("Ad")}<span className="inp"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("ör. Masaj kabini")} /></span></label>
            <label className="f">{t("Tür")}<span className="inp"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Res["kind"] })}><option value="room">{t("Kabin")}</option><option value="device">{t("Cihaz")}</option><option value="other">{t("Diğer")}</option></select></span></label>
            <label className="f">{t("Kapasite")}<span className="inp"><input type="number" min={1} max={20} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></span></label>
          </div>
          <div className="text-sm font-semibold">{t("Bu kabini kullanan kategoriler")}</div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = f.categoryIds.includes(c.id);
              return <button key={c.id} type="button" className={`pill ${on ? "good" : ""}`} onClick={() => setF({ ...f, categoryIds: on ? f.categoryIds.filter((x) => x !== c.id) : [...f.categoryIds, c.id] })}>{on ? "✓ " : ""}{localName(c, lang)}</button>;
            })}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />{t("Aktif")}</label>
          <div className="flex gap-2">
            <button className="btn sm" disabled={pending || !f.name.trim()} onClick={() => run(() => saveResource({ id: f.id, name: f.name, kind: f.kind, capacity: f.capacity, active: f.active, categoryIds: f.categoryIds }))}>{t("Kaydet")}</button>
            <button className="btn ghost sm" onClick={() => setF(null)}>{t("Vazgeç")}</button>
            {f.id && <button className="btn ghost sm text-bad ml-auto" disabled={pending} onClick={() => { if (confirm(t("Silinsin mi?"))) run(() => deleteResource(f.id!)); }}>{t("Sil")}</button>}
          </div>
        </section>
      )}
      {err && <p className="pill bad">{err}</p>}
    </div>
  );
}
