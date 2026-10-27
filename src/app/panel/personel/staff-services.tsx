"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { money } from "@/lib/format";
import { setStaffServices } from "./actions";

type Svc = { id: string; category_id: string | null; code: string | null; name_tr: string; duration_min: number; price: number };
type Cat = { id: string; name_tr: string; sort_order: number };
const norm = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

/** DIKIDI'deki gibi: personelin yapabildiği hizmetleri kategori kategori işaretle */
export function StaffServicesDialog({ staffId, staffName, services, categories, assigned, onClose }: { staffId: string; staffName: string; services: Svc[]; categories: Cat[]; assigned: string[]; onClose: () => void }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set(assigned));
  const [q, setQ] = useState("");
  const [onlySel, setOnlySel] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const groups = useMemo(() => {
    const terms = norm(q.trim()).split(/\s+/).filter(Boolean);
    const cats = [...categories].sort((a, b) => a.sort_order - b.sort_order).concat(services.some((s) => !s.category_id) ? [{ id: "", name_tr: "Diğer", sort_order: 9999 }] : []);
    return cats.map((c) => {
      const all = services.filter((s) => (s.category_id ?? "") === c.id);
      const shown = all.filter((s) => (!onlySel || sel.has(s.id)) && (!terms.length || terms.every((t) => norm(`${s.code ?? ""} ${s.name_tr} ${c.name_tr}`).includes(t))));
      return { c, all, shown };
    }).filter((g) => g.all.length && g.shown.length);
  }, [categories, services, q, onlySel, sel]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setMany = (ids: string[], on: boolean) => setSel((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const searching = q.trim().length > 0;

  return (
    <Modal wide title={`Hizmetler · ${staffName}`} onClose={onClose} headerExtra={<span className="pill">{sel.size} / {services.length} seçili</span>}>
      <div className="grid gap-3">
        <p className="text-sm text-muted">Bu uzmanın yapabildiği hizmetleri işaretle. Takvimde bu uzmana randevu verirken yalnızca bu hizmetler listelenir; online randevuda da bu hizmetler için yalnızca işaretli uzmanlar seçilebilir. Hiç işaret yoksa tüm hizmetler açık sayılır.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="inp flex-1 min-w-[200px]"><input type="search" placeholder="Hizmet ara… (kod veya ad)" value={q} onChange={(e) => setQ(e.target.value)} /></span>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlySel} onChange={(e) => setOnlySel(e.target.checked)} /> Sadece seçililer</label>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(new Set(groups.map((g) => g.c.id)))}>Tümünü aç</button>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(new Set())}>Kapat</button>
        </div>
        <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {groups.map(({ c, all, shown }) => {
            const n = all.filter((s) => sel.has(s.id)).length;
            const isOpen = searching || open.has(c.id);
            const allOn = n === all.length, some = n > 0 && !allOn;
            return (
              <section key={c.id || "other"} className="rounded-xl border border-line">
                <div className="flex items-center gap-2 px-3 py-2">
                  <input type="checkbox" aria-label={`${c.name_tr} tümü`} checked={allOn} ref={(el) => { if (el) el.indeterminate = some; }} onChange={(e) => setMany(all.map((s) => s.id), e.target.checked)} />
                  <button type="button" className="flex-1 text-left font-semibold flex items-center gap-2" onClick={() => setOpen((o) => { const x = new Set(o); if (x.has(c.id)) x.delete(c.id); else x.add(c.id); return x; })} aria-expanded={isOpen}>
                    <span className="text-muted text-xs w-3">{isOpen ? "▾" : "▸"}</span>{c.name_tr}
                  </button>
                  <span className={`text-xs num ${n ? "text-good font-semibold" : "text-muted"}`}>{n}/{all.length}</span>
                </div>
                {isOpen && (
                  <div className="grid sm:grid-cols-2 gap-x-4 px-3 pb-2 border-t border-line pt-2">
                    {shown.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm py-1 min-w-0 cursor-pointer">
                        <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
                        <span className="truncate flex-1">{s.code ? <b className="num mr-1">{s.code}</b> : null}{s.name_tr}</span>
                        <span className="text-[11px] text-muted num whitespace-nowrap">{s.duration_min} dk · {money(s.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {!groups.length && <p className="text-sm text-muted">Eşleşen hizmet yok.</p>}
        </div>
        {err && <p className="pill bad">{err}</p>}
        <div className="flex justify-between gap-2 flex-wrap">
          <div className="flex gap-2"><button type="button" className="btn ghost sm" onClick={() => setSel(new Set(services.map((s) => s.id)))}>Hepsini seç</button><button type="button" className="btn ghost sm" onClick={() => setSel(new Set())}>Hepsini kaldır</button></div>
          <div className="flex gap-2"><button type="button" className="btn ghost" onClick={onClose}>Vazgeç</button>
            <button type="button" className="btn" disabled={pending} onClick={() => { setErr(""); start(async () => { const r = await setStaffServices(staffId, [...sel]); if (!r.ok) setErr(r.error); else { router.refresh(); onClose(); } }); }}>{pending ? "Kaydediliyor…" : "Kaydet"}</button></div>
        </div>
      </div>
    </Modal>
  );
}
