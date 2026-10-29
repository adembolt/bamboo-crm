"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { saveSupplier, deleteSupplier, saveWarehouse } from "./actions";

type Sup = { id: string; name: string; phone: string; notes: string };
type Wh = { id: string; name: string; responsible_staff_id: string | null; is_active: boolean };

export function SupplierUI({ suppliers, warehouses, staff, canManage }: { suppliers: Sup[]; warehouses: Wh[]; staff: { id: string; full_name: string }[]; canManage: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [s, setS] = useState<Sup | null>(null);
  const [w, setW] = useState<Wh | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) => { setErr(""); start(async () => { const r = await fn(); if (!r.ok) setErr(r.error ?? t("Hata")); else { after(); router.refresh(); } }); };
  const staffName = (id: string | null) => staff.find((x) => x.id === id)?.full_name ?? "—";
  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      <section className="panel grid gap-2">
        <div className="flex items-center"><h2 className="font-bold">{t("Tedarikçiler")} <span className="text-muted text-sm">({suppliers.length})</span></h2>{canManage && <button className="btn ghost sm ml-auto" onClick={() => setS({ id: "", name: "", phone: "", notes: "" })}>+ {t("Ekle")}</button>}</div>
        {s && (
          <div className="grid gap-2 border border-line rounded-xl p-2">
            <label className="f">{t("Ad")}<span className="inp"><input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></span></label>
            <label className="f">{t("Telefon")}<span className="inp"><input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></span></label>
            <label className="f">{t("Not")}<span className="inp"><input value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} /></span></label>
            <div className="flex gap-2">
              <button className="btn sm" disabled={pending || !s.name.trim()} onClick={() => run(() => saveSupplier({ id: s.id || null, name: s.name, phone: s.phone, notes: s.notes }), () => setS(null))}>{t("Kaydet")}</button>
              <button className="btn ghost sm" onClick={() => setS(null)}>{t("Vazgeç")}</button>
              {s.id && <button className="btn ghost sm text-bad ml-auto" disabled={pending} onClick={() => { if (confirm(t("Silinsin mi?"))) run(() => deleteSupplier(s.id), () => setS(null)); }}>{t("Sil")}</button>}
            </div>
          </div>
        )}
        {suppliers.map((x) => (
          <button key={x.id} type="button" disabled={!canManage} onClick={() => setS(x)} className="grid grid-cols-[1fr_auto] gap-2 text-left text-sm py-1 border-b border-dashed border-line hover:bg-sunk rounded px-1">
            <span className="min-w-0"><b className="block truncate">{x.name}</b>{x.notes && <span className="text-xs text-muted">{x.notes}</span>}</span>
            <span className="num text-muted">{x.phone || "—"}</span>
          </button>
        ))}
      </section>
      <section className="panel grid gap-2">
        <div className="flex items-center"><h2 className="font-bold">{t("Depolar")} <span className="text-muted text-sm">({warehouses.length})</span></h2>{canManage && <button className="btn ghost sm ml-auto" onClick={() => setW({ id: "", name: "", responsible_staff_id: null, is_active: true })}>+ {t("Ekle")}</button>}</div>
        {w && (
          <div className="grid gap-2 border border-line rounded-xl p-2">
            <label className="f">{t("Ad")}<span className="inp"><input value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} /></span></label>
            <label className="f">{t("Sorumlu")}<span className="inp"><select value={w.responsible_staff_id ?? ""} onChange={(e) => setW({ ...w, responsible_staff_id: e.target.value || null })}><option value="">—</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></span></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={w.is_active} onChange={(e) => setW({ ...w, is_active: e.target.checked })} />{t("Aktif")}</label>
            <div className="flex gap-2">
              <button className="btn sm" disabled={pending || !w.name.trim()} onClick={() => run(() => saveWarehouse({ id: w.id || null, name: w.name, staffId: w.responsible_staff_id, active: w.is_active }), () => setW(null))}>{t("Kaydet")}</button>
              <button className="btn ghost sm" onClick={() => setW(null)}>{t("Vazgeç")}</button>
            </div>
          </div>
        )}
        {warehouses.map((x) => (
          <button key={x.id} type="button" disabled={!canManage} onClick={() => setW(x)} className={`grid grid-cols-[1fr_auto] gap-2 text-left text-sm py-1 border-b border-dashed border-line hover:bg-sunk rounded px-1 ${x.is_active ? "" : "opacity-50"}`}>
            <b className="truncate">{x.name}</b>
            <span className="text-muted text-xs">{staffName(x.responsible_staff_id)}</span>
          </button>
        ))}
      </section>
      {err && <p className="pill bad">{err}</p>}
    </div>
  );
}
