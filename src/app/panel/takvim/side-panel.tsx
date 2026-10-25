import Link from "next/link";
import { money, todayIso } from "@/lib/format";
import { Donut } from "@/components/charts";
import { SERIES } from "@/lib/charts";

const WD = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

export function MiniCalendar({ date, busyDays }: { date: string; busyDays: Set<string> }) {
  const [y, m] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const today = todayIso();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  return (
    <section className="panel grid gap-2">
      <div className="flex items-center justify-between">
        <Link className="btn ghost sm" href={`/panel/takvim?d=${prev}`} aria-label="Önceki ay">‹</Link>
        <b className="capitalize">{new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(date + "T12:00:00"))}</b>
        <Link className="btn ghost sm" href={`/panel/takvim?d=${next}`} aria-label="Sonraki ay">›</Link>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted font-semibold">{WD.map((w, i) => <span key={w} className={i >= 5 ? "text-bad" : ""}>{w}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((c, i) => c ? (
          <Link key={c} href={`/panel/takvim?d=${c}`} className={`relative mx-auto w-8 h-8 grid place-items-center rounded-full ${c === date ? "bg-green text-white font-bold" : c === today ? "ring-1 ring-green font-bold" : "hover:bg-sunk"} ${i % 7 >= 5 && c !== date ? "text-bad" : ""}`}>
            {Number(c.slice(8))}
            {busyDays.has(c) && c !== date && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-gold" />}
          </Link>
        ) : <span key={`e${i}`} />)}
      </div>
    </section>
  );
}

export function KasaSnapshot({ date, gross, byMethod, expected, openCount, closedCount }: { date: string; gross: number; byMethod: Record<string, number>; expected: number; openCount: number; closedCount: number }) {
  const cash = byMethod.cash ?? 0, card = byMethod.card ?? 0, transfer = byMethod.transfer ?? 0, other = Math.max(0, gross - cash - card - transfer);
  const slices = [{ label: "Nakit", value: cash, color: SERIES[2] }, { label: "Kart", value: card, color: SERIES[0] }, { label: "Havale", value: transfer, color: SERIES[3] }, { label: "Diğer", value: other, color: SERIES[6] }].filter((s) => s.value > 0);
  return (
    <section className="panel grid gap-2">
      <div className="flex items-center justify-between"><h2 className="font-bold">Kasa · {date === todayIso() ? "bugün" : date.split("-").reverse().join(".")}</h2><Link className="text-xs text-green font-semibold hover:underline" href={`/panel/kasa?d=${date}`}>Kasaya git →</Link></div>
      {gross > 0 ? <Donut title="" slices={slices} total={gross} bare /> : <div className="text-sm text-muted">Henüz tahsilat yok.</div>}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-sunk px-2 py-1"><span className="block text-[11px] text-muted">Tahsil edilen</span><b className="num">{money(gross)}</b><span className="block text-[11px] text-muted">{closedCount} kapatılan</span></div>
        <div className={`rounded-lg px-2 py-1 ${expected > 0 ? "bg-warn-bg" : "bg-sunk"}`}><span className="block text-[11px] text-muted">Bekleyen</span><b className="num">{money(expected)}</b><span className="block text-[11px] text-muted">{openCount} açık ziyaret</span></div>
      </div>
    </section>
  );
}
