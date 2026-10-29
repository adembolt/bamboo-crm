"use client";
import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Staff } from "@/lib/database.types";
import { saveStaff } from "./actions";
import { Modal } from "@/components/modal";
import { StaffServicesDialog } from "./staff-services";
import { StaffAvatar } from "@/components/staff-avatar";
import { useT } from "@/lib/i18n/client";

const PAY: Record<Staff["pay_model"], string> = { daily_prim: "Günlük prim", percent: "Ay sonu yüzde", fixed: "Sabit" };

type Svc = { id: string; category_id: string | null; code: string | null; name_tr: string; duration_min: number; price: number };
export function StaffList({ staff, canManage, services, categories, assigned }: { staff: Staff[]; canManage: boolean; services: Svc[]; categories: { id: string; name_tr: string; sort_order: number }[]; assigned: Record<string, string[]> }) {
  const [edit, setEdit] = useState<Staff | "new" | null>(null);
  const [svcFor, setSvcFor] = useState<Staff | null>(null);
  const router = useRouter();
  const t = useT();
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3"><h1 className="text-xl font-bold">{t("Personel")}</h1>{canManage && <button className="btn ml-auto" onClick={() => setEdit("new")}>+ {t("Personel ekle")}</button>}</header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {staff.map((s) => (
          <div key={s.id} className={`panel grid gap-2 ${!s.is_active ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-3">
              <StaffAvatar staff={s} size={48} editable={canManage} />
              <div className="min-w-0"><div className="font-bold truncate">{s.full_name}</div><div className="text-xs text-muted">{s.title || "—"}</div></div>
              {canManage && <button className="btn ghost sm ml-auto" onClick={() => setEdit(s)}>{t("Düzenle")}</button>}
            </div>
            <div className="flex gap-2 flex-wrap text-xs">
              <span className="pill">{t(PAY[s.pay_model])}{s.pay_model === "percent" ? ` %${s.pay_percent}` : ""}</span>
              <span className={`pill ${s.online_bookable ? "good" : ""}`}>{s.online_bookable ? t("Online seçilebilir") : t("Online kapalı")}</span>
              {!s.is_active && <span className="pill bad">{t("Pasif")}</span>}
            </div>
            <button type="button" className="btn ghost sm justify-self-start" disabled={!canManage} onClick={() => setSvcFor(s)} title={t("Bu uzmanın yapabildiği hizmetler")}>
              ✦ {t("Hizmetler")}: {assigned[s.id]?.length ? t("{n} hizmet", { n: assigned[s.id].length }) : t("atanmamış (tümü açık)")}
            </button>
          </div>
        ))}
        {!staff.length && <p className="text-muted text-sm">{t("Henüz personel yok.")}</p>}
      </div>
      {svcFor && <StaffServicesDialog staffId={svcFor.id} staffName={svcFor.full_name} services={services} categories={categories} assigned={assigned[svcFor.id] ?? []} onClose={() => setSvcFor(null)} />}
      {edit && <StaffForm staff={edit === "new" ? null : edit} onClose={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function StaffForm({ staff: s, onClose }: { staff: Staff | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(saveStaff, { error: "" });
  const t = useT();
  return (
    <Modal title={s ? t("Personeli düzenle") : t("Yeni personel")} onClose={onClose}>
      <form action={action} className="grid gap-3">
        {s && <input type="hidden" name="id" value={s.id} />}
        <div className="grid grid-cols-2 gap-3">
          <label className="f col-span-2">{t("Ad Soyad *")}<span className="inp"><input name="full_name" defaultValue={s?.full_name} required /></span></label>
          <label className="f">{t("Unvan")}<span className="inp"><input name="title" defaultValue={s?.title} placeholder={t("Kozmetolog, Masöz…")} /></span></label>
          <label className="f">{t("Telefon")}<span className="inp"><input name="phone" defaultValue={s?.phone} /></span></label>
          <label className="f">{t("Renk")}<span className="inp"><input name="color" type="color" defaultValue={s?.color ?? "#5E9E6C"} /></span></label>
          <label className="f">{t("Diller (virgül)")}<span className="inp"><input name="languages" defaultValue={s?.languages.join(", ") ?? "tr"} /></span></label>
          <label className="f">{t("Ücret modeli")}<span className="inp"><select name="pay_model" defaultValue={s?.pay_model ?? "percent"}><option value="percent">{t("Ay sonu yüzde")}</option><option value="daily_prim">{t("Günlük prim")}</option><option value="fixed">{t("Sabit")}</option></select></span></label>
          <label className="f">{t("Hizmet yüzdesi %")}<span className="inp"><input name="pay_percent" inputMode="decimal" defaultValue={s?.pay_percent ?? 0} /></span></label>
          <label className="f">{t("Ürün yüzdesi %")}<span className="inp"><input name="product_percent" inputMode="decimal" defaultValue={s?.product_percent ?? 0} /></span></label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="online_bookable" defaultChecked={s?.online_bookable ?? true} /> {t("Online randevuda seçilebilir")}</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_active" defaultChecked={s?.is_active ?? true} /> {t("Aktif")}</label>
        {state.error && <p className="pill bad">{state.error}</p>}
        {state.saved && <p className="pill good">{t("Kaydedildi")}</p>}
        <div className="flex gap-2 justify-end"><button type="button" className="btn ghost" onClick={onClose}>{t("Kapat")}</button><button className="btn" disabled={pending}>{t("Kaydet")}</button></div>
      </form>
    </Modal>
  );
}
