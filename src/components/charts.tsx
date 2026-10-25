"use client";
import { useState } from "react";
import { money } from "@/lib/format";

import { SERIES, type Slice } from "@/lib/charts";

export function Donut({ title, slices, total, format = money, empty = "Veri yok" }: { title: string; slices: Slice[]; total?: number; format?: (n: number) => string; empty?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const sum = slices.reduce((a, s) => a + s.value, 0);
  const R = 56, r = 38, C = 70;
  const starts = slices.reduce<number[]>((arr, s) => { arr.push((arr[arr.length - 1] ?? 0) + s.value); return arr; }, []);
  const arcs = slices.map((s, i) => {
    const before = starts[i] - s.value;
    const a0 = (before / sum) * Math.PI * 2 - Math.PI / 2;
    const a1 = (starts[i] / sum) * Math.PI * 2 - Math.PI / 2;
    const gap = slices.length > 1 ? 0.025 : 0; // 2px yüzey boşluğu
    const s0 = a0 + gap / 2, s1 = a1 - gap / 2;
    const large = s1 - s0 > Math.PI ? 1 : 0;
    const p = (ang: number, rad: number) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)];
    const [x0, y0] = p(s0, R), [x1, y1] = p(s1, R), [x2, y2] = p(s1, r), [x3, y3] = p(s0, r);
    const d = s1 <= s0 ? "" : `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
    return { d, i, s };
  });
  const active = hover !== null ? slices[hover] : null;
  return (
    <figure className="panel grid gap-3 m-0">
      <figcaption className="font-bold">{title}</figcaption>
      {!sum ? <p className="text-sm text-muted">{empty}</p> : (
        <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
          <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={title}>
            {arcs.map(({ d, i, s }) => d && (
              <path key={i} d={d} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.35}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                <title>{`${s.label}: ${format(s.value)} (${Math.round((s.value / sum) * 100)}%)`}</title>
              </path>
            ))}
            <text x={C} y={C - 4} textAnchor="middle" className="fill-[var(--ink)]" style={{ font: "700 13px var(--font-display)" }}>{active ? `${Math.round((active.value / sum) * 100)}%` : format(total ?? sum)}</text>
            <text x={C} y={C + 12} textAnchor="middle" style={{ font: "600 9px var(--font-sans)", fill: "var(--muted)" }}>{active ? active.label.slice(0, 16) : "toplam"}</text>
          </svg>
          <ul className="grid gap-1 text-sm m-0 p-0 list-none">
            {slices.map((s, i) => (
              <li key={i} className={`grid grid-cols-[10px_1fr_auto_38px] gap-2 items-center rounded px-1 ${hover === i ? "bg-sunk" : ""}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="truncate">{s.label}</span>
                <span className="num font-semibold">{format(s.value)}</span>
                <span className="num text-muted text-right text-xs">{Math.round((s.value / sum) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}

export function Bars({ title, points, format = money, color = SERIES[5] }: { title: string; points: { label: string; value: number; href?: string }[]; format?: (n: number) => string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const W = 640, H = 180, L = 8, B = 22, T = 10;
  const n = Math.max(1, points.length), cw = (W - L) / n, bw = Math.max(2, Math.min(28, cw - 2));
  const total = points.reduce((a, p) => a + p.value, 0);
  return (
    <figure className="panel grid gap-2 m-0">
      <div className="flex items-baseline justify-between"><figcaption className="font-bold">{title}</figcaption><span className="text-xs text-muted">{hover !== null ? `${points[hover].label}: ${format(points[hover].value)}` : `toplam ${format(total)}`}</span></div>
      {!total ? <p className="text-sm text-muted">Veri yok</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
          {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={L} x2={W} y1={T + (H - B - T) * (1 - f)} y2={T + (H - B - T) * (1 - f)} stroke="var(--line)" strokeWidth="1" />)}
          <line x1={L} x2={W} y1={H - B} y2={H - B} stroke="var(--muted)" strokeWidth="1" />
          {points.map((p, i) => {
            const h = ((H - B - T) * p.value) / max; const x = L + i * cw + (cw - bw) / 2; const y = H - B - h;
            const showLabel = n <= 12 || i % Math.ceil(n / 12) === 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={L + i * cw} y={T} width={cw} height={H - B - T} fill="transparent" />
                {p.value > 0 && <rect x={x} y={y} width={bw} height={h} rx={3} fill={color} opacity={hover === null || hover === i ? 1 : 0.4}><title>{`${p.label}: ${format(p.value)}`}</title></rect>}
                {showLabel && <text x={L + i * cw + cw / 2} y={H - 6} textAnchor="middle" style={{ font: "600 10px var(--font-sans)", fill: "var(--muted)" }}>{p.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}
