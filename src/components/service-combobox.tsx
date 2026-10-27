"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { money } from "@/lib/format";

type Svc = { id: string; category_id: string | null; code: string | null; name_tr: string; name_en?: string; duration_min: number; price: number };
type Cat = { id: string; name_tr: string; sort_order: number };

const norm = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

/** Yazarak aranabilen hizmet seçici: kod, Türkçe veya İngilizce ad; ↑↓ Enter Esc */
export function ServiceCombobox({ services, categories, value, label, onPick, disabled }: { services: Svc[]; categories: Cat[]; value: string | null; label: string; onPick: (id: string) => void; disabled?: boolean }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name_tr])), [categories]);
  const catOrder = useMemo(() => new Map(categories.map((c) => [c.id, c.sort_order])), [categories]);

  const results = useMemo(() => {
    const terms = norm(q.trim()).split(/\s+/).filter(Boolean);
    const all = services.map((s) => ({ s, hay: norm(`${s.code ?? ""} ${s.name_tr} ${s.name_en ?? ""} ${catName.get(s.category_id ?? "") ?? ""}`) }));
    const hit = terms.length ? all.filter((x) => terms.every((t) => x.hay.includes(t))) : all;
    // kod başta eşleşenler önce
    return hit.sort((a, b) => {
      if (terms.length) {
        const ac = norm(a.s.code ?? "").startsWith(terms[0]) ? 0 : 1, bc = norm(b.s.code ?? "").startsWith(terms[0]) ? 0 : 1;
        if (ac !== bc) return ac - bc;
      }
      return (catOrder.get(a.s.category_id ?? "") ?? 999) - (catOrder.get(b.s.category_id ?? "") ?? 999) || (a.s.code ?? "").localeCompare(b.s.code ?? "");
    }).slice(0, 60).map((x) => x.s);
  }, [q, services, catName, catOrder]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  useEffect(() => { list.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" }); }, [hi]);

  const pick = (id: string) => { onPick(id); setOpen(false); setQ(""); };
  const current = value ? services.find((s) => s.id === value) : null;

  return (
    <div ref={box} className="relative">
      <span className="inp">
        <input
          type="search" role="combobox" aria-expanded={open} aria-controls={listId} aria-label="Hizmet ara" disabled={disabled}
          placeholder={current ? `${current.code ? current.code + " " : ""}${current.name_tr}` : label || "Hizmet ara… (kod veya ad)"}
          value={open ? q : current ? `${current.code ? current.code + " " : ""}${current.name_tr}` : label}
          onFocus={(e) => { setOpen(true); setQ(""); setHi(0); e.currentTarget.select(); }}
          onChange={(e) => { setQ(e.target.value); setHi(0); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); if (results[hi]) pick(results[hi].id); }
            else if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
          }}
          className="truncate"
        />
      </span>
      {open && !disabled && (
        <ul id={listId} ref={list} role="listbox" className="absolute z-50 mt-1 left-0 min-w-full w-[min(520px,90vw)] max-h-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-card py-1">
          {!results.length && <li className="px-3 py-2 text-sm text-muted">Sonuç yok</li>}
          {results.map((s, i) => (
            <li key={s.id} data-i={i} role="option" aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); pick(s.id); }} onMouseEnter={() => setHi(i)}
              className={`px-3 py-1.5 cursor-pointer grid grid-cols-[1fr_auto] gap-2 items-center ${i === hi ? "bg-green-soft" : ""} ${s.id === value ? "font-semibold" : ""}`}>
              <span className="min-w-0"><span className="block truncate text-sm">{s.code ? <b className="num mr-1">{s.code}</b> : null}{s.name_tr}</span><span className="block text-[11px] text-muted truncate">{catName.get(s.category_id ?? "") ?? "Diğer"}</span></span>
              <span className="text-[11px] text-muted num text-right whitespace-nowrap">{s.duration_min} dk · {money(s.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
