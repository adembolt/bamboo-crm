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

const LOC: Record<string, string> = { tr: "tr-TR", en: "en-GB", ru: "ru-RU" };

const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

export function fmtDateLong(isoDate: string, lang = "tr") {
  return cap(new Intl.DateTimeFormat(LOC[lang] ?? "tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(isoDate + "T12:00:00")));
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

/** "Ekim 2026" / "October 2026" / "октябрь 2026" */
export function fmtMonthYear(isoDate: string, lang = "tr") {
  return cap(new Intl.DateTimeFormat(LOC[lang] ?? "tr-TR", { month: "long", year: "numeric", timeZone: TZ }).format(new Date(isoDate.slice(0, 10) + "T12:00:00")));
}

/** Kısa gün adı: Pzt / Mon / пн */
export function fmtWeekdayShort(isoDate: string, lang = "tr") {
  return new Intl.DateTimeFormat(LOC[lang] ?? "tr-TR", { weekday: "short", timeZone: TZ }).format(new Date(isoDate.slice(0, 10) + "T12:00:00"));
}

const DUR: Record<string, [string, string]> = { tr: ["sa", "dk"], en: ["h", "min"], ru: ["ч", "мин"] };
export function duration(min: number, lang = "tr") {
  const h = Math.floor(min / 60), m = min % 60;
  const [H, M] = DUR[lang] ?? DUR.tr;
  return h && m ? `${h} ${H} ${m} ${M}` : h ? `${h} ${H}` : `${m} ${M}`;
}

/** "dk" kısaltması dile göre */
export function minLabel(lang = "tr") { return (DUR[lang] ?? DUR.tr)[1]; }

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
