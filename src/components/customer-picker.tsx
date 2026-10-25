"use client";
import { useEffect, useState } from "react";
import { fullName, initials } from "@/lib/format";

export type PickedCustomer = { id: string; first_name: string; last_name: string; phone: string };

export function CustomerPicker(props: {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
  onNew: (c: { first_name: string; last_name: string; phone: string } | null) => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<PickedCustomer[]>([]);
  const [mode, setMode] = useState<"search" | "new">("search");
  const [nc, setNc] = useState({ first_name: "", last_name: "", phone: "" });

  useEffect(() => {
    if (mode !== "search") return;
    const t = q.trim();
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      if (t.length < 2) { setRes([]); return; }
      try {
        const r = await fetch(`/api/customers/search?q=${encodeURIComponent(t)}`, { signal: ctl.signal });
        if (r.ok) setRes(await r.json());
      } catch {}
    }, t.length < 2 ? 0 : 200);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q, mode]);

  useEffect(() => { props.onNew(mode === "new" ? nc : null); }, [mode, nc]); // eslint-disable-line react-hooks/exhaustive-deps

  if (props.value) {
    const c = props.value;
    return (
      <div className="flex items-center gap-3 rounded-xl bg-green-soft px-3 py-2">
        <span className="w-8 h-8 rounded-full bg-surface text-green grid place-items-center text-sm font-bold">{initials(c.first_name, c.last_name)}</span>
        <div className="min-w-0 flex-1"><div className="font-semibold truncate">{fullName(c)}</div><div className="text-xs text-muted">{c.phone}</div></div>
        <button type="button" className="btn ghost sm" onClick={() => props.onChange(null)}>Değiştir</button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-1 bg-sunk p-1 rounded-lg w-max">
        <button type="button" className={`btn sm ${mode === "search" ? "" : "ghost"}`} onClick={() => setMode("search")}>Kayıtlı müşteri</button>
        <button type="button" className={`btn sm ${mode === "new" ? "" : "ghost"}`} onClick={() => setMode("new")}>Yeni müşteri</button>
      </div>
      {mode === "search" ? (
        <>
          <span className="inp"><input placeholder="Ad, soyad veya telefon…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></span>
          {res.length > 0 && (
            <div className="rounded-xl border border-line divide-y divide-line max-h-44 overflow-y-auto">
              {res.map((c) => (
                <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-sunk flex items-center gap-2" onClick={() => props.onChange(c)}>
                  <span className="w-7 h-7 rounded-full bg-green-soft text-green grid place-items-center text-xs font-bold">{initials(c.first_name, c.last_name)}</span>
                  <span className="min-w-0"><span className="font-semibold text-sm block truncate">{fullName(c)}</span><span className="text-[11px] text-muted">{c.phone}</span></span>
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 2 && !res.length && <p className="text-xs text-muted">Bulunamadı — “Yeni müşteri” ile ekleyin.</p>}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="f">Ad<span className="inp"><input value={nc.first_name} onChange={(e) => setNc({ ...nc, first_name: e.target.value })} autoFocus /></span></label>
          <label className="f">Soyad<span className="inp"><input value={nc.last_name} onChange={(e) => setNc({ ...nc, last_name: e.target.value })} /></span></label>
          <label className="f col-span-2">Telefon<span className="inp"><input inputMode="tel" placeholder="+90 5xx…" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></span></label>
        </div>
      )}
    </div>
  );
}
