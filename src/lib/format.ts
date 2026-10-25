export const TZ = "Europe/Istanbul";

export function money(n: number | string | null | undefined, currency = "TRY") {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

/** GG.AA.YYYY */
export function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso) : iso;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(d);
}

export function fmtTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
}

export function fmtDateLong(isoDate: string) {
  return new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(isoDate + "T12:00:00"));
}

/** YYYY-MM-DD (İstanbul'a göre bugün) */
export function todayIso() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

export function addDays(isoDate: string, n: number) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' + 'HH:MM' (İstanbul) -> ISO (UTC) */
export function localToIso(isoDate: string, hhmm: string) {
  // İstanbul sabit UTC+3 (yaz saati uygulanmıyor)
  return new Date(`${isoDate}T${hhmm}:00+03:00`).toISOString();
}

/** ISO -> dakika (gün başından, İstanbul) */
export function minutesOfDay(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function duration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h} sa ${m} dk` : h ? `${h} sa` : `${m} dk`;
}

export function initials(first: string, last: string) {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

export function fullName(c: { first_name: string; last_name: string }) {
  return `${c.first_name} ${c.last_name}`.trim();
}

/** Telefonu +90… biçimine normalize et */
export function normalizePhone(raw: string) {
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (/^0\d{10}$/.test(s)) s = "+9" + s;       // 05xx… -> +905xx…
  if (/^5\d{9}$/.test(s)) s = "+90" + s;
  if (/^\d+$/.test(s)) s = "+" + s;
  return s;
}
