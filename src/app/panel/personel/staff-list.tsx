"use client";
import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Staff } from "@/lib/database.types";
import { saveStaff } from "./actions";
import { Modal } from "@/app/panel/takvim/day-calendar";

const PAY: Record<Staff["pay_model"], string> = { daily_prim: "Günlük prim", percent: "Ay sonu yüzde", fixed: "Sabit" };

export function StaffList({ staff, canManage }: { staff: Staff[]; canManage: boolean }) {
  const [edit, setEdit] = useState<Staff | "new" | null>(null);
  const router = useRouter();
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3"><h1 className="text-xl font-bold">Personel</h1>{canManage && <button className="btn ml-auto" onClick={() => setEdit("new")}>+ Personel ekle</button>}</header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {staff.map((s) => (
          <div key={s.id} className={`panel grid gap-2 ${!s.is_active ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full grid place-items-center font-bold text-white" style={{ background: s.color }}>{s.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
              <div className="min-w-0"><div className="font-bold truncate">{s.full_name}</div><div className="text-xs text-muted">{s.title || "—"}</div></div>
              {canManage && <button className="btn ghost sm ml-auto" onClick={() => setEdit(s)}>Düzenle</button>}
            </div>
            <div className="flex gap-2 flex-wrap text-xs">
              <span className="pill">{PAY[s.pay_model]}{s.pay_model === "percent" ? ` %${s.pay_percent}` : ""}</span>
              <span className={`pill ${s.online_bookable ? "good" : ""}`}>{s.online_bookable ? "Online seçilebilir" : "Online kapalı"}</span>
              {!s.is_active && <span className="pill bad">Pasif</span>}
            </div>
          </div>
        ))}
        {!staff.length && <p className="text-muted text-sm">Henüz personel yok.</p>}
      </div>
      {edit && <StaffForm staff={edit === "new" ? null : edit} onClose={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function StaffForm({ staff: s, onClose }: { staff: Staff | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(saveStaff, { error: "" });
  return (
    <Modal title={s ? "Personeli düzenle" : "Yeni personel"} onClose={onClose}>
      <form action={action} className="grid gap-3">
        {s && <input type="hidden" name="id" value={s.id} />}
        <div className="grid grid-cols-2 gap-3">
          <label className="f col-span-2">Ad Soyad *<span className="inp"><input name="full_name" defaultValue={s?.full_name} required /></span></label>
          <label className="f">Unvan<span className="inp"><input name="title" defaultValue={s?.title} placeholder="Kozmetolog, Masöz…" /></span></label>
          <label className="f">Telefon<span className="inp"><input name="phone" defaultValue={s?.phone} /></span></label>
          <label className="f">Renk<span className="inp"><input name="color" type="color" defaultValue={s?.color ?? "#5E9E6C"} /></span></label>
          <label className="f">Diller (virgül)<span className="inp"><input name="languages" defaultValue={s?.languages.join(", ") ?? "tr"} /></span></label>
          <label className="f">Ücret modeli<span className="inp"><select name="pay_model" defaultValue={s?.pay_model ?? "percent"}><option value="percent">Ay sonu yüzde</option><option value="daily_prim">Günlük prim</option><option value="fixed">Sabit</option></select></span></label>
          <label className="f">Hizmet yüzdesi %<span className="inp"><input name="pay_percent" inputMode="decimal" defaultValue={s?.pay_percent ?? 0} /></span></label>
          <label className="f">Ürün yüzdesi %<span className="inp"><input name="product_percent" inputMode="decimal" defaultValue={s?.product_percent ?? 0} /></span></label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="online_bookable" defaultChecked={s?.online_bookable ?? true} /> Online randevuda seçilebilir</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_active" defaultChecked={s?.is_active ?? true} /> Aktif</label>
        {state.error && <p className="pill bad">{state.error}</p>}
        {state.saved && <p className="pill good">Kaydedildi</p>}
        <div className="flex gap-2 justify-end"><button type="button" className="btn ghost" onClick={onClose}>Kapat</button><button className="btn" disabled={pending}>Kaydet</button></div>
      </form>
    </Modal>
  );
}
