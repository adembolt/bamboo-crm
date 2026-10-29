"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchAppointments } from "./visit-actions";
import { useT } from "@/lib/i18n/client";
import { fmtDate, todayIso } from "@/lib/format";

type Hit = Awaited<ReturnType<typeof searchAppointments>>[number];

/** Takvimde müşteri adı/telefonla randevu bul → o güne git ve kartı aç */
export function AppointmentSearch() {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const id = setTimeout(async () => {
      if (term.length < 2) { setHits(null); return; }
      const my = ++seq.current;
      const r = await searchAppointments(term);
      if (my === seq.current) { setHits(r); setHi(0); }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const go = (h: Hit) => { setOpen(false); setQ(""); router.push(`/panel/takvim?d=${h.date}&open=${h.id}`); };
  const today = todayIso();

  return (
    <div ref={box} className="relative w-full sm:w-64">
      <span className="inp">
        <input type="search" value={q} placeholder={t("Randevu ara: isim veya telefon")} aria-label={t("Randevu ara")}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (!hits?.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((x) => Math.min(x + 1, hits.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((x) => Math.max(x - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(hits[hi]); }
            else if (e.key === "Escape") setOpen(false);
          }} />
      </span>
      {open && hits && (
        <ul role="listbox" className="absolute right-0 z-50 mt-1 w-[min(420px,92vw)] max-h-80 overflow-y-auto rounded-xl border border-line bg-surface shadow-card py-1">
          {!hits.length && <li className="px-3 py-2 text-sm text-muted">{t("Randevu bulunamadı.")}</li>}
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); go(h); }}
              className={`px-3 py-2 cursor-pointer grid grid-cols-[auto_1fr] gap-x-3 ${i === hi ? "bg-green-soft" : ""} ${h.date < today ? "opacity-60" : ""}`}>
              <span className="num text-sm font-bold row-span-2">{fmtDate(h.date).slice(0, 5)}<span className="block text-[11px] text-muted font-normal">{h.time}</span></span>
              <span className="text-sm font-semibold truncate">{h.name} <span className="text-[11px] text-muted font-normal">{h.phone}</span></span>
              <span className="text-[11px] text-muted truncate">{h.services}{h.staff ? ` · ${h.staff}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
