"use client";
import { useEffect, useRef, useState } from "react";
import { FORMS, MARKS, VIEWS, RAMP, missingFields, type Field, type FormKey, type FormData, type Signatures, type YesNo, type Mark } from "@/lib/forms/schemas";

type Tx = (s: string) => string;
const id = (s: string) => s;

export type FormSubmit = { data: FormData; sig: Signatures; staffName: string; date: string };

/** Şemadan form çizer. mode="client": salon bölümleri ve uzman alanları gizli (danışanın kendi telefonu).
    editable="staff": yalnız salon bölümleri ve uzman imzası değiştirilebilir (danışan imzaladıktan sonra). */
export function FormFiller({
  formKey, initialData = {}, initialSig = {}, initialStaff = "", initialDate, mode = "panel", editable = "all", tx = id,
  staffNames = [], submitLabel, onSubmit, footer,
}: {
  formKey: FormKey; initialData?: FormData; initialSig?: Signatures; initialStaff?: string; initialDate?: string;
  mode?: "panel" | "client"; editable?: "all" | "staff" | "none"; tx?: Tx; staffNames?: string[];
  submitLabel?: string; onSubmit?: (p: FormSubmit) => Promise<string | null>; footer?: React.ReactNode;
}) {
  const F = FORMS[formKey];
  const [data, setData] = useState<FormData>(() => JSON.parse(JSON.stringify(initialData ?? {})));
  const [sig, setSig] = useState<Signatures>(initialSig ?? {});
  const [staffName, setStaffName] = useState(initialStaff);
  const [date, setDate] = useState(initialDate ?? new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));

  const canEdit = (staffOnly?: boolean) => editable === "all" || (editable === "staff" && !!staffOnly);
  const sections = F.sections.filter((s) => mode === "panel" || !s.staffOnly);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit) return;
    const miss = editable === "all" ? missingFields(formKey, data, sig, { skipStaff: mode === "client" }) : [];
    if (miss.length) { setErr(`${tx("Eksik")}: ${miss.map(tx).join(", ")}`); return; }
    setErr(""); setBusy(true);
    const r = await onSubmit({ data, sig, staffName: staffName.trim(), date });
    setBusy(false);
    if (r) setErr(r);
  }

  return (
    <form className="grid gap-4 bf-form" onSubmit={submit} noValidate>
      {sections.map((s, si) => {
        const ro = !canEdit(s.staffOnly);
        return (
          <section key={si} className={`panel grid gap-3 bf-sec ${s.staffOnly ? "border-dashed bg-sunk" : ""}`}>
            <h3 className="font-bold text-base flex items-center gap-2">{tx(s.title)}{s.staffOnly && <span className="pill text-[10px]">{tx("uzman doldurur")}</span>}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {s.fields.map((f, fi) => <FieldView key={f.id ?? fi} f={f} v={f.id ? data[f.id] : undefined} ro={ro} tx={tx} onChange={(v) => f.id && set(f.id, v)} />)}
            </div>
          </section>
        );
      })}

      {(F.sign || mode === "panel") && (
        <section className="panel grid gap-3 bf-sec">
          <h3 className="font-bold text-base">{tx(F.sign ? "İmzalar" : "Uzman")}</h3>
          {mode === "panel" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="f">{tx("Uzman adı")}<span className="inp"><input list="bf-staff" value={staffName} disabled={editable === "none"} onChange={(e) => setStaffName(e.target.value)} /></span></label>
              <label className="f">{tx("Tarih")}<span className="inp"><input type="date" value={date} disabled={editable !== "all"} onChange={(e) => setDate(e.target.value)} /></span></label>
              <datalist id="bf-staff">{staffNames.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
          )}
          {F.sign && (
            <div className="grid sm:grid-cols-2 gap-3">
              <SigPad label={tx("Danışan imzası")} value={sig.client} ro={editable !== "all"} tx={tx} onChange={(v) => setSig((x) => ({ ...x, client: v }))} />
              {mode === "panel" && <SigPad label={tx("Uzman imzası")} value={sig.staff} ro={editable === "none" || (editable === "staff" && !!initialSig?.staff)} tx={tx} onChange={(v) => setSig((x) => ({ ...x, staff: v }))} />}
            </div>
          )}
        </section>
      )}

      {onSubmit && editable !== "none" && (
        <div className="sticky bottom-0 z-10 flex items-center gap-3 flex-wrap rounded-2xl bg-surface/95 backdrop-blur border border-line px-4 py-3 print:hidden">
          {err && <span className="text-sm text-bad font-semibold">{err}</span>}
          <span className="ml-auto flex gap-2">{footer}<button className="btn" disabled={busy}>{busy ? tx("Kaydediliyor…") : submitLabel ?? tx("Formu kaydet")}</button></span>
        </div>
      )}
      {!onSubmit && footer}
    </form>
  );
}

function FieldView({ f, v, ro, tx, onChange }: { f: Field; v: unknown; ro: boolean; tx: Tx; onChange: (v: unknown) => void }) {
  const full = f.half ? "" : "sm:col-span-2";
  const lab = f.label ? <span className="text-sm font-semibold">{tx(f.label)}{f.req && <span className="text-bad"> *</span>}</span> : null;
  switch (f.type) {
    case "info":
      return (
        <div className={`sm:col-span-2 text-sm leading-relaxed ${f.muted ? "text-muted" : "rounded-xl bg-sunk px-3 py-2"}`}>
          {f.label && <b className="block mb-1">{tx(f.label)}</b>}
          {f.text && tx(f.text)}
          {f.bullets && <ul className="list-disc pl-5 grid gap-0.5">{f.bullets.map((b) => <li key={b}>{tx(b)}</li>)}</ul>}
        </div>
      );
    case "text": case "tel": case "date":
      return <label className={`f ${full}`}>{lab}<span className="inp"><input type={f.type === "tel" ? "tel" : f.type === "date" ? "date" : "text"} value={String(v ?? "")} disabled={ro} onChange={(e) => onChange(e.target.value)} /></span></label>;
    case "textarea":
      return <label className={`f ${full}`}>{lab}<span className="inp"><textarea rows={3} value={String(v ?? "")} disabled={ro} onChange={(e) => onChange(e.target.value)} /></span></label>;
    case "radio": case "multi": {
      const multi = f.type === "multi";
      const sel = multi ? ((v ?? []) as number[]) : (v as number | undefined);
      return (
        <div className={`grid gap-1.5 ${full}`} role="group">{lab}
          <div className={`flex gap-1.5 ${f.vertical ? "flex-col" : "flex-wrap"}`}>
            {(f.options ?? []).map((o, i) => {
              const on = multi ? (sel as number[]).includes(i) : sel === i;
              return (
                <button type="button" key={i} disabled={ro} aria-pressed={on}
                  className={`rounded-xl border px-3 py-2 text-sm text-left min-h-[40px] transition ${on ? "bg-green text-white border-green font-semibold" : "border-line bg-surface hover:border-green"} ${ro && !on ? "opacity-50" : ""}`}
                  onClick={() => multi ? onChange(on ? (sel as number[]).filter((x) => x !== i) : [...(sel as number[]), i].sort((a, b) => a - b)) : onChange(on ? undefined : i)}>
                  {multi ? (on ? "✓ " : "") : ""}{tx(o)}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "yesno": {
      const yn = (v ?? {}) as YesNo;
      const put = (i: number, p: { a?: "y" | "n"; n?: string }) => onChange({ ...yn, [i]: { ...(yn[i] ?? {}), ...p } });
      return (
        <div className="sm:col-span-2 grid gap-1">{lab}
          {(f.items ?? []).map((t, i) => {
            const a = yn[i]?.a;
            return (
              <div key={i} className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center rounded-xl px-3 py-2 border ${a === "y" && f.warnOnYes ? "bg-warn-bg border-warn" : "border-line"}`}>
                <span className="text-sm">{tx(t)}</span>
                <span className="flex gap-1">
                  {(["y", "n"] as const).map((k) => (
                    <button type="button" key={k} disabled={ro} aria-pressed={a === k}
                      className={`rounded-lg border px-3 py-1.5 text-sm min-w-[64px] ${a === k ? (k === "y" ? "bg-warn text-white border-warn font-bold" : "bg-green text-white border-green font-bold") : "border-line bg-surface"}`}
                      onClick={() => put(i, { a: k })}>{tx(k === "y" ? "Evet" : "Hayır")}</button>
                  ))}
                </span>
                {a === "y" && <span className="inp col-span-2"><input placeholder={tx("Açıklama")} value={yn[i]?.n ?? ""} disabled={ro} onChange={(e) => put(i, { n: e.target.value })} /></span>}
              </div>
            );
          })}
        </div>
      );
    }
    case "rating": {
      const rv = (v ?? {}) as Record<string, number>;
      return (
        <div className="sm:col-span-2 grid gap-1">{lab}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left py-1">{tx("Bulgu")}</th>{(f.options ?? []).map((o) => <th key={o} className="px-1 text-xs text-muted">{tx(o)}</th>)}</tr></thead>
            <tbody>{(f.items ?? []).map((t, i) => (
              <tr key={i} className="border-t border-line"><td className="py-1.5">{tx(t)}</td>{(f.options ?? []).map((o, j) => (
                <td key={j} className="text-center"><input type="radio" className="w-5 h-5 accent-[var(--color-green)]" checked={rv[i] === j} disabled={ro} aria-label={`${t}: ${o}`} onChange={() => onChange({ ...rv, [i]: j })} /></td>
              ))}</tr>
            ))}</tbody></table></div>
        </div>
      );
    }
    case "grid": {
      const gv = (v ?? {}) as Record<string, Record<string, string>>;
      return (
        <div className="sm:col-span-2 grid gap-1">{lab}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th />{(f.cols ?? []).map((c) => <th key={c} className="px-1 text-xs text-muted text-left">{tx(c)}</th>)}</tr></thead>
            <tbody>{(f.rows ?? []).map((rw, i) => (
              <tr key={i}><td className="py-1 pr-2 whitespace-nowrap">{tx(rw)}</td>{(f.cols ?? []).map((c, j) => (
                <td key={j} className="p-0.5"><span className="inp"><input className="min-w-[70px]" inputMode={f.num ? "decimal" : undefined} value={gv[i]?.[j] ?? ""} disabled={ro} aria-label={`${rw} ${c}`} onChange={(e) => onChange({ ...gv, [i]: { ...(gv[i] ?? {}), [j]: e.target.value } })} /></span></td>
              ))}</tr>
            ))}</tbody></table></div>
        </div>
      );
    }
    case "scale":
      return (
        <div className="sm:col-span-2 grid gap-1">{lab}
          <div className="grid grid-cols-11 gap-1">
            {RAMP.map((c, i) => (
              <button type="button" key={i} disabled={ro} aria-pressed={v === i} style={{ background: c }}
                className={`rounded-lg py-2 text-sm font-bold text-[#14261A] border-2 ${v === i ? "border-[#14261A]" : "border-transparent"}`} onClick={() => onChange(i)}>{i}</button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted"><span>{tx("0 ağrı yok")}</span><span>{tx("5 orta")}</span><span>{tx("10 dayanılmaz")}</span></div>
        </div>
      );
    case "consent": {
      const cv = (v ?? []) as number[];
      return (
        <div className="sm:col-span-2 grid gap-1.5">{lab}
          {(f.items ?? []).map((t, i) => (
            <label key={i} className={`flex gap-3 items-start rounded-xl border px-3 py-2 text-sm cursor-pointer ${cv.includes(i) ? "border-green bg-green-soft" : "border-line"}`}>
              <input type="checkbox" className="w-5 h-5 mt-0.5 shrink-0 accent-[var(--color-green)]" checked={cv.includes(i)} disabled={ro}
                onChange={(e) => onChange(e.target.checked ? [...cv, i].sort((a, b) => a - b) : cv.filter((x) => x !== i))} />
              <span>{tx(t)}</span>
            </label>
          ))}
        </div>
      );
    }
    case "bodymap":
      return <BodyMap value={(v ?? []) as Mark[]} ro={ro} tx={tx} onChange={onChange} />;
  }
  return null;
}

function BodyMap({ value, ro, tx, onChange }: { value: Mark[]; ro: boolean; tx: Tx; onChange: (v: Mark[]) => void }) {
  const [tool, setTool] = useState(0);
  const click = (view: string, e: React.MouseEvent<SVGSVGElement>) => {
    if (ro) return;
    const svg = e.currentTarget, pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    onChange([...value, { v: view, x: +(p.x / 200).toFixed(3), y: +(p.y / 500).toFixed(3), t: MARKS[tool][0] }]);
  };
  return (
    <div className="sm:col-span-2 grid gap-2">
      {!ro && (
        <div className="flex flex-wrap gap-1.5 print:hidden" role="group" aria-label={tx("İşaret seçin")}>
          {MARKS.map((m, i) => (
            <button type="button" key={i} aria-pressed={tool === i} onClick={() => setTool(i)}
              className={`rounded-xl border px-3 py-1.5 text-sm ${tool === i ? "border-green bg-green-soft font-semibold" : "border-line"}`}>
              <b style={{ color: m[2] }} className="mr-1">{m[0]}</b>{tx(m[1])}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {VIEWS.map(([vk, vl]) => (
          <figure key={vk} className="grid gap-1 text-center">
            <svg viewBox="0 0 200 500" className={`w-full rounded-xl border border-line bg-white ${ro ? "" : "cursor-crosshair"}`} role="img" aria-label={`${tx(vl)}`} onClick={(e) => click(vk, e)}>
              <image href={`/forms/body-${vk}.png`} width="200" height="500" />
              {value.map((m, i) => m.v !== vk ? null : (
                <text key={i} x={m.x * 200} y={m.y * 500} fill={(MARKS.find((x) => x[0] === m.t) ?? MARKS[0])[2]} fontSize="22" fontWeight="700" textAnchor="middle" dominantBaseline="central"
                  className={ro ? "" : "cursor-pointer"} onClick={(e) => { if (ro) return; e.stopPropagation(); onChange(value.filter((_, j) => j !== i)); }}>{m.t}</text>
              ))}
            </svg>
            <figcaption className="text-[11px] font-semibold text-muted">{tx(vl)}</figcaption>
          </figure>
        ))}
      </div>
      {ro && value.length > 0 && <p className="text-xs text-muted">{MARKS.map((m) => `${m[0]} ${tx(m[1])}`).join(" · ")}</p>}
    </div>
  );
}

function SigPad({ label, value, ro, tx, onChange }: { label: string; value?: string; ro: boolean; tx: Tx; onChange: (v: string | undefined) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false), last = useRef<[number, number] | null>(null), dirty = useRef(false);
  const [editing, setEditing] = useState(!value);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!; ctx.lineWidth = 3.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#14261A"; ctx.fillStyle = "#14261A";
  }, [editing]);
  if (ro || (value && !editing)) {
    return (
      <div className="grid gap-1">
        <div className="flex items-center gap-2"><b className="text-sm">{label}</b>{!ro && <button type="button" className="btn ghost sm ml-auto print:hidden" onClick={() => { onChange(undefined); setEditing(true); }}>{tx("Yeniden imzala")}</button>}</div>
        {value ? <img alt={label} src={value} className="rounded-xl border border-line bg-white w-full max-w-[360px]" /> : <p className="text-sm text-muted">{tx("İmza yok")}</p>}
      </div>
    );
  }
  const pos = (e: React.PointerEvent): [number, number] => { const cv = ref.current!, b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };
  const finish = () => {
    if (!drawing.current) return; drawing.current = false;
    if (!dirty.current) return;
    const cv = ref.current!, o = document.createElement("canvas"); o.width = 360; o.height = 108;
    const x = o.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, 360, 108); x.drawImage(cv, 0, 0, 360, 108);
    onChange(o.toDataURL("image/png"));
  };
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2"><b className="text-sm">{label}</b>
        <button type="button" className="btn ghost sm ml-auto" onClick={() => { const cv = ref.current!; cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height); dirty.current = false; onChange(undefined); }}>{tx("Temizle")}</button></div>
      <canvas ref={ref} width={700} height={210} aria-label={label} className="w-full rounded-xl border-2 border-dashed border-line bg-white touch-none"
        onPointerDown={(e) => { const cv = ref.current!; drawing.current = true; dirty.current = true; last.current = pos(e); cv.setPointerCapture(e.pointerId); const c = cv.getContext("2d")!; c.beginPath(); c.arc(last.current[0], last.current[1], 1.4, 0, 7); c.fill(); }}
        onPointerMove={(e) => { if (!drawing.current) return; const p = pos(e), c = ref.current!.getContext("2d")!; c.beginPath(); c.moveTo(last.current![0], last.current![1]); c.lineTo(p[0], p[1]); c.stroke(); last.current = p; }}
        onPointerUp={finish} onPointerCancel={finish} onPointerLeave={finish} />
      <span className="text-xs text-muted">{tx("Parmak veya fareyle imzalayın")}</span>
    </div>
  );
}
