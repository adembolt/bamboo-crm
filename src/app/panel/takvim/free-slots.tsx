"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { useT, useLang } from "@/lib/i18n/client";
import { localName } from "@/lib/i18n/core";
import { fmtDateLong, money } from "@/lib/format";
import { findFreeSlots } from "./actions";

type Svc = { id: string; code: string | null; name_tr: string; name_en: string; name_ru?: string | null; duration_min: number; price: number };
type St = { id: string; full_name: string; color: string };

/** DIKIDI'deki "önce hizmet seç": hizmeti seç, önümüzdeki günlerde kimde ne zaman boş yer var gör, tıkla randevu aç */
export function FreeSlotFinder({ date, services, staff, staffServices }: { date: string; services: Svc[]; staff: St[]; staffServices: Record<string, string[]> }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [svc, setSvc] = useState<Svc | null>(null);
  const [staffId, setStaffId] = useState<string>("");
  const [from, setFrom] = useState(date);
  const [res, setRes] = useState<{ date: string; slots: { time: string; staffIds: string[] }[] }[] | null>(null);
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const qq = q.trim().toLocaleLowerCase("tr");
    if (!qq) return [];
    return services.filter((s) => `${s.code ?? ""} ${s.name_tr} ${s.name_en} ${s.name_ru ?? ""}`.toLocaleLowerCase("tr").includes(qq)).slice(0, 12);
  }, [q, services]);
  const able = svc ? staff.filter((s) => !staffServices[s.id]?.length || staffServices[s.id].includes(svc.id)) : staff;
  const search = (s: Svc, sid: string, f: string) => start(async () => { const r = await findFreeSlots({ serviceId: s.id, staffId: sid || null, from: f, days: 7 }); setRes(r.ok ? r.days : []); });
  const pick = (d: string, time: string, sid: string) => { setOpen(false); router.push(`/panel/takvim?d=${d}&new=${sid}~${time}~${svc!.id}`); };
  const sName = (id: string) => staff.find((x) => x.id === id);
  return (
    <>
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)} title={t("Önce hizmeti seçin, boş saatleri görün")}>🔍 {t("Boş saat bul")}</button>
      {open && (
        <Modal title={t("Boş saat bul")} onClose={() => setOpen(false)} wide>
          <div className="grid gap-3">
            {!svc ? (
              <div className="grid gap-2">
                <label className="f">{t("Hizmet")}<span className="inp"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Hizmet adı veya kodu")} /></span></label>
                <div className="grid gap-1">
                  {list.map((s) => (
                    <button key={s.id} type="button" className="text-left text-sm px-2 py-1.5 rounded hover:bg-sunk flex gap-2" onClick={() => { setSvc(s); setStaffId(""); search(s, "", from); }}>
                      <span className="num text-muted w-10">{s.code}</span><span className="flex-1">{localName(s, lang)}</span><span className="text-muted num">{s.duration_min} dk · {money(s.price)}</span>
                    </button>
                  ))}
                  {q.trim() && !list.length && <p className="text-sm text-muted">{t("Bulunamadı.")}</p>}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid"><span className="text-xs text-muted">{t("Hizmet")}</span><b>{localName(svc, lang)}</b></div>
                <button className="btn ghost sm" onClick={() => { setSvc(null); setRes(null); }}>{t("Değiştir")}</button>
                <label className="f ml-auto">{t("Uzman")}<span className="inp"><select value={staffId} onChange={(e) => { setStaffId(e.target.value); search(svc, e.target.value, from); }}><option value="">{t("Fark etmez")}</option>{able.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
                <label className="f">{t("Başlangıç")}<span className="inp"><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value) search(svc, staffId, e.target.value); }} /></span></label>
              </div>
            )}
            {svc && pending && <p className="text-sm text-muted">{t("Aranıyor…")}</p>}
            {svc && res && !pending && (
              <div className="grid gap-3 max-h-[60vh] overflow-auto">
                {res.map((d) => (
                  <div key={d.date} className="grid gap-1">
                    <b className="text-sm">{fmtDateLong(d.date, lang)}</b>
                    {!d.slots.length ? <p className="text-xs text-muted">{t("Boş yer yok.")}</p> : (
                      <div className="grid gap-1">
                        {[...new Set(d.slots.flatMap((sl) => sl.staffIds))].map((sid) => {
                          const s = sName(sid);
                          const times = d.slots.filter((sl) => sl.staffIds.includes(sid)).map((sl) => sl.time);
                          return (
                            <div key={sid} className="flex flex-wrap items-center gap-1">
                              <span className="text-xs font-semibold w-28 truncate" style={{ borderLeft: `3px solid ${s?.color ?? "#888"}`, paddingLeft: 6 }}>{s?.full_name ?? "?"}</span>
                              {times.slice(0, 24).map((time) => (
                                <button key={time} type="button" onClick={() => pick(d.date, time, sid)} className="pill num hover:brightness-110">{time}</button>
                              ))}
                              {times.length > 24 && <span className="text-xs text-muted">+{times.length - 24}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
