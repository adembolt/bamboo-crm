import Link from "next/link";
import { money, todayIso, addDays, fmtMonthYear, fmtWeekdayShort } from "@/lib/format";
import { getT, getLang } from "@/lib/i18n/server";
import { Donut } from "@/components/charts";
import { SERIES } from "@/lib/charts";

/* Pazartesi 2024-01-01’den başlayan 7 gün → dile göre kısa gün adları */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays("2024-01-01", i));

export async function MiniCalendar({ date, busyDays }: { date: string; busyDays: Set<string> }) {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const WD = WEEK.map((w) => fmtWeekdayShort(w, lang));
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
        <Link className="btn ghost sm" href={`/panel/takvim?d=${prev}`} aria-label={t("Önceki ay")}>‹</Link>
        <b>{fmtMonthYear(date, lang)}</b>
        <Link className="btn ghost sm" href={`/panel/takvim?d=${next}`} aria-label={t("Sonraki ay")}>›</Link>
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

export async function KasaSnapshot({ date, gross, byMethod, expected, openCount, closedCount }: { date: string; gross: number; byMethod: Record<string, number>; expected: number; openCount: number; closedCount: number }) {
  const t = await getT();
  const cash = byMethod.cash ?? 0, card = byMethod.card ?? 0, transfer = byMethod.transfer ?? 0, other = Math.max(0, gross - cash - card - transfer);
  const slices = [{ label: t("Nakit"), value: cash, color: SERIES[2] }, { label: t("Kart"), value: card, color: SERIES[0] }, { label: t("Havale"), value: transfer, color: SERIES[3] }, { label: t("Diğer"), value: other, color: SERIES[6] }].filter((s) => s.value > 0);
  return (
    <section className="panel grid gap-2">
      <div className="flex items-center justify-between"><h2 className="font-bold">{t("Kasa · {day}", { day: date === todayIso() ? t("bugün") : date.split("-").reverse().join(".") })}</h2><Link className="text-xs text-green font-semibold hover:underline" href={`/panel/kasa?d=${date}`}>{t("Kasaya git →")}</Link></div>
      {gross > 0 ? <Donut title="" slices={slices} total={gross} bare /> : <div className="text-sm text-muted">{t("Henüz tahsilat yok.")}</div>}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-sunk px-2 py-1"><span className="block text-[11px] text-muted">{t("Tahsil edilen")}</span><b className="num">{money(gross)}</b><span className="block text-[11px] text-muted">{t("{n} kapatılan", { n: closedCount })}</span></div>
        <div className={`rounded-lg px-2 py-1 ${expected > 0 ? "bg-warn-bg" : "bg-sunk"}`}><span className="block text-[11px] text-muted">{t("Bekleyen")}</span><b className="num">{money(expected)}</b><span className="block text-[11px] text-muted">{t("{n} açık ziyaret", { n: openCount })}</span></div>
      </div>
    </section>
  );
}
