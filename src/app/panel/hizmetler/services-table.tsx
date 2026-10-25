"use client";
import { useMemo, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Service, ServiceCategory } from "@/lib/database.types";
import { money, duration } from "@/lib/format";
import { setServiceOnline, setServicesOnlineBulk, setCategoryOnline, setServiceActive, saveService } from "./actions";
import { Modal } from "@/app/panel/takvim/day-calendar";

export function ServicesTable(props: { categories: ServiceCategory[]; services: Service[]; canManage: boolean; initial: { cat: string; q: string; only: string } }) {
  const { categories, services, canManage } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cat, setCat] = useState(props.initial.cat);
  const [q, setQ] = useState(props.initial.q);
  const [only, setOnly] = useState(props.initial.only);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Service | "new" | null>(null);
  const [err, setErr] = useState("");

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name_tr ?? "Kategorisiz";

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return services.filter((s) => {
      if (cat && s.category_id !== cat) return false;
      if (only === "online" && !s.online_visible) return false;
      if (only === "offline" && s.online_visible) return false;
      if (only === "inactive" ? s.is_active : !s.is_active) return false;
      if (t && !(s.name_tr.toLowerCase().includes(t) || s.name_en.toLowerCase().includes(t) || s.name_ru.toLowerCase().includes(t) || (s.code ?? "").includes(t))) return false;
      return true;
    });
  }, [services, cat, q, only]);

  const onlineCount = services.filter((s) => s.is_active && s.online_visible).length;
  const activeCount = services.filter((s) => s.is_active).length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr("");
    start(async () => { const r = await fn(); if (!r.ok) setErr(r.error ?? "Hata"); else router.refresh(); });
  }
  function toggleAll(on: boolean) { setSel(on ? new Set(filtered.map((s) => s.id)) : new Set()); }

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Hizmetler</h1>
          <p className="text-sm text-muted">{activeCount} aktif hizmet · <b className="text-green">{onlineCount}</b> tanesi online randevuda görünüyor</p>
        </div>
        {canManage && <button className="btn ml-auto" onClick={() => setEdit("new")}>+ Yeni hizmet</button>}
      </header>

      <div className="panel grid gap-3">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <span className="inp"><input placeholder="Ad veya kod ara…" value={q} onChange={(e) => setQ(e.target.value)} /></span>
          <span className="inp"><select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Tüm kategoriler</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name_tr}</option>)}</select></span>
          <span className="inp"><select value={only} onChange={(e) => setOnly(e.target.value)}><option value="">Aktif hizmetler</option><option value="online">Sadece online görünenler</option><option value="offline">Online görünmeyenler</option><option value="inactive">Arşiv (pasif)</option></select></span>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={sel.size > 0 && sel.size === filtered.length} onChange={(e) => toggleAll(e.target.checked)} /> Listedekilerin tümü ({filtered.length})</label>
            {sel.size > 0 && (
              <>
                <span className="pill">{sel.size} seçili</span>
                <button className="btn sm" disabled={pending} onClick={() => run(() => setServicesOnlineBulk([...sel], true))}>Online göster</button>
                <button className="btn sm ghost" disabled={pending} onClick={() => run(() => setServicesOnlineBulk([...sel], false))}>Online gizle</button>
              </>
            )}
            {cat && (() => { const c = categories.find((x) => x.id === cat)!; return (
              <label className="ml-auto flex items-center gap-2 font-semibold">Kategori online görünür
                <button type="button" role="switch" aria-checked={c.online_visible} className="switch" disabled={pending} onClick={() => run(() => setCategoryOnline(c.id, !c.online_visible))} />
              </label>
            ); })()}
          </div>
        )}
        {err && <p className="pill bad">{err}</p>}
      </div>

      <div className="panel p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-sunk text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {canManage && <th className="w-8 px-3 py-2" />}
                <th className="text-left px-3 py-2">Hizmet</th>
                <th className="text-left px-3 py-2">Kategori</th>
                <th className="text-right px-3 py-2">Süre</th>
                <th className="text-right px-3 py-2">Fiyat</th>
                <th className="text-center px-3 py-2">Online</th>
                {canManage && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((s) => (
                <tr key={s.id} className={!s.is_active ? "opacity-60" : ""}>
                  {canManage && <td className="px-3 py-2"><input type="checkbox" checked={sel.has(s.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(s.id); else n.delete(s.id); setSel(n); }} /></td>}
                  <td className="px-3 py-2">
                    <div className="font-semibold">{s.name_tr}</div>
                    <div className="text-[11px] text-muted">{s.code ? `#${s.code}` : ""}{s.name_en ? ` · ${s.name_en}` : ""}{s.session_count > 1 ? ` · ${s.session_count} seans` : ""}</div>
                  </td>
                  <td className="px-3 py-2 text-muted">{catName(s.category_id)}</td>
                  <td className="px-3 py-2 text-right num">{duration(s.duration_min)}</td>
                  <td className="px-3 py-2 text-right num font-bold">{money(s.price)}</td>
                  <td className="px-3 py-2 text-center">
                    <button type="button" role="switch" aria-checked={s.online_visible} aria-label={`${s.name_tr} online görünürlük`} className="switch" disabled={!canManage || pending || !s.is_active} onClick={() => run(() => setServiceOnline(s.id, !s.online_visible))} />
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button className="text-green font-semibold hover:underline mr-3" onClick={() => setEdit(s)}>düzenle</button>
                      <button className="text-muted hover:underline" disabled={pending} onClick={() => run(() => setServiceActive(s.id, !s.is_active))}>{s.is_active ? "arşivle" : "geri al"}</button>
                    </td>
                  )}
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={7} className="px-3 py-6 text-muted">Sonuç yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {edit && <ServiceForm service={edit === "new" ? null : edit} categories={categories} onClose={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function ServiceForm({ service: s, categories, onClose }: { service: Service | null; categories: ServiceCategory[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(saveService, { error: "" });
  return (
    <Modal title={s ? "Hizmeti düzenle" : "Yeni hizmet"} onClose={onClose}>
      <form action={action} className="grid gap-3">
        {s && <input type="hidden" name="id" value={s.id} />}
        <div className="grid grid-cols-2 gap-3">
          <label className="f col-span-2">Ad (TR) *<span className="inp"><input name="name_tr" defaultValue={s?.name_tr} required /></span></label>
          <label className="f">Ad (EN)<span className="inp"><input name="name_en" defaultValue={s?.name_en} /></span></label>
          <label className="f">Ad (RU)<span className="inp"><input name="name_ru" defaultValue={s?.name_ru} /></span></label>
          <label className="f">Kategori<span className="inp"><select name="category_id" defaultValue={s?.category_id ?? ""}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name_tr}</option>)}</select></span></label>
          <label className="f">Kod<span className="inp"><input name="code" defaultValue={s?.code ?? ""} /></span></label>
          <label className="f">Süre (dk)<span className="inp"><input name="duration_min" inputMode="numeric" defaultValue={s?.duration_min ?? 60} /></span></label>
          <label className="f">Tampon (dk)<span className="inp"><input name="buffer_min" inputMode="numeric" defaultValue={s?.buffer_min ?? 0} /></span></label>
          <label className="f">Fiyat (₺)<span className="inp"><input name="price" inputMode="decimal" defaultValue={s?.price ?? 0} /></span></label>
          <label className="f">Seans sayısı<span className="inp"><input name="session_count" inputMode="numeric" defaultValue={s?.session_count ?? 1} /></span></label>
          <label className="f">Tür<span className="inp"><select name="kind" defaultValue={s?.kind ?? "service"}><option value="service">Hizmet</option><option value="package">Paket / kür</option><option value="consultation">Konsültasyon</option><option value="product_like">Ürün benzeri</option></select></span></label>
          <label className="f col-span-2">Açıklama (TR)<span className="inp"><textarea name="description_tr" rows={2} defaultValue={s?.description_tr} /></span></label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="online_visible" defaultChecked={s?.online_visible ?? false} /> Online randevu sayfasında göster</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="requires_consultation" defaultChecked={s?.requires_consultation ?? false} /> Önce konsültasyon gerekir</label>
        {state.error && <p className="pill bad">{state.error}</p>}
        {state.saved && <p className="pill good">Kaydedildi</p>}
        <div className="flex gap-2 justify-end"><button type="button" className="btn ghost" onClick={onClose}>Kapat</button><button className="btn" disabled={pending}>Kaydet</button></div>
      </form>
    </Modal>
  );
}
