"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { fmtDate } from "@/lib/format";
import type { AppRole } from "@/lib/database.types";
import { inviteUser, updateUser, setUserBlocked, sendPasswordReset } from "./actions";

export type UserRow = { id: string; name: string; role: AppRole; staffId: string | null; email: string; lastSignIn: string | null; invited: boolean; blocked: boolean; me: boolean };
const ROLE: Record<AppRole, [string, string]> = {
  owner: ["Sahip", "Her şey, kullanıcı ve yönetici atama"],
  manager: ["Yönetici", "Her şey: ayarlar, personel, maaş, raporlar"],
  reception: ["Resepsiyon", "Randevu, müşteri, kasa; ayar ve maaş yok"],
  staff: ["Personel", "Sadece kendi takvimini görür, değişiklik yapamaz"],
};

export function UsersUI({ rows, staff, isOwner }: { rows: UserRow[]; staff: { id: string; full_name: string }[]; isOwner: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inv, setInv] = useState({ email: "", name: "", role: "reception" as AppRole, staffId: "" });
  const [edit, setEdit] = useState<UserRow | null>(null);
  const roles = (Object.keys(ROLE) as AppRole[]).filter((r) => isOwner || (r !== "owner" && r !== "manager"));
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) => { setMsg(null); start(async () => { try { const r = await fn(); if (!r.ok) setMsg({ ok: false, text: t(r.error ?? "Hata") }); else { after?.(); setMsg({ ok: true, text: ok }); router.refresh(); } } catch (e) { setMsg({ ok: false, text: e instanceof Error ? t(e.message) : String(e) }); } }); };
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name;
  return (
    <div className="grid gap-4">
      <section className="panel grid gap-1">
        {rows.map((u) => (
          <div key={u.id} className={`grid gap-2 py-2 border-b border-dashed border-line ${u.blocked ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <b>{u.name || u.email}</b>{u.me && <span className="pill text-[10px]">{t("siz")}</span>}
              <span className={`pill text-[10px] ${u.role === "owner" || u.role === "manager" ? "good" : ""}`}>{t(ROLE[u.role][0])}</span>
              {staffName(u.staffId) && <span className="text-xs text-muted">↔ {staffName(u.staffId)}</span>}
              {u.invited && <span className="pill warn text-[10px]">{t("davet bekliyor")}</span>}
              {u.blocked && <span className="pill bad text-[10px]">{t("erişim kapalı")}</span>}
              <span className="text-xs text-muted ml-auto">{u.email}{u.lastSignIn ? ` · ${t("son giriş")} ${fmtDate(u.lastSignIn)}` : ""}</span>
            </div>
            {edit?.id === u.id ? (
              <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <label className="f">{t("Ad")}<span className="inp"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></span></label>
                <label className="f">{t("Rol")}<span className="inp"><select value={edit.role} disabled={u.me} onChange={(e) => setEdit({ ...edit, role: e.target.value as AppRole })}>{(roles.includes(edit.role) ? roles : [edit.role, ...roles]).map((r) => <option key={r} value={r}>{t(ROLE[r][0])}</option>)}</select></span></label>
                <label className="f">{t("Personel kaydı")}<span className="inp"><select value={edit.staffId ?? ""} onChange={(e) => setEdit({ ...edit, staffId: e.target.value || null })}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
                <div className="flex gap-1"><button className="btn sm" disabled={pending} onClick={() => run(() => updateUser({ id: u.id, role: edit.role, staffId: edit.staffId, name: edit.name }), t("Kaydedildi."), () => setEdit(null))}>{t("Kaydet")}</button><button className="btn ghost sm" onClick={() => setEdit(null)}>{t("Vazgeç")}</button></div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button className="btn ghost sm" onClick={() => setEdit(u)}>{t("Düzenle")}</button>
                {u.email && <button className="btn ghost sm" disabled={pending} onClick={() => run(() => sendPasswordReset(u.email), t("Şifre belirleme e-postası gönderildi."))}>{t("Şifre e-postası gönder")}</button>}
                {!u.me && u.role !== "owner" && <button className="btn ghost sm" disabled={pending} onClick={() => { if (u.blocked || confirm(t("Bu kullanıcının girişi kapatılsın mı?"))) run(() => setUserBlocked(u.id, !u.blocked), u.blocked ? t("Erişim açıldı.") : t("Erişim kapatıldı.")); }}>{u.blocked ? t("Erişimi aç") : t("Erişimi kapat")}</button>}
              </div>
            )}
          </div>
        ))}
      </section>
      <section className="panel grid gap-2">
        <h2 className="font-bold">{t("Yeni kullanıcı davet et")}</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="f">{t("E-posta")}<span className="inp"><input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} placeholder="ornek@gmail.com" /></span></label>
          <label className="f">{t("Ad")}<span className="inp"><input value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} /></span></label>
          <label className="f">{t("Rol")}<span className="inp"><select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as AppRole })}>{roles.map((r) => <option key={r} value={r}>{t(ROLE[r][0])} — {t(ROLE[r][1])}</option>)}</select></span></label>
          <label className="f">{t("Personel kaydı (takvimdeki sütunu)")}<span className="inp"><select value={inv.staffId} onChange={(e) => setInv({ ...inv, staffId: e.target.value })}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
        </div>
        <button className="btn sm justify-self-start" disabled={pending || !inv.email} onClick={() => run(() => inviteUser({ ...inv, staffId: inv.staffId || null }), t("Davet e-postası gönderildi."), () => setInv({ email: "", name: "", role: "reception", staffId: "" }))}>{t("Davet gönder")}</button>
        <ul className="text-xs text-muted list-disc pl-5">{(Object.keys(ROLE) as AppRole[]).map((r) => <li key={r}><b>{t(ROLE[r][0])}</b>: {t(ROLE[r][1])}</li>)}</ul>
      </section>
      {msg && <p className={`pill ${msg.ok ? "good" : "bad"} justify-self-start`}>{msg.text}</p>}
    </div>
  );
}
