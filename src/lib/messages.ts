/* Mesaj şablonları: değişken doldurma, dil seçimi, WhatsApp tıkla-gönder bağlantısı. */
import { fmtDate, fmtTime } from "@/lib/format";

export type MsgKind = "reminder" | "thanks" | "birthday" | "winback";
export type MsgLocale = "tr" | "en" | "ru";
export const KINDS: { key: MsgKind; label: string; hint: string }[] = [
  { key: "reminder", label: "Hatırlatma", hint: "Seçilen günün randevuları (varsayılan: yarın)" },
  { key: "thanks", label: "Teşekkür / yorum", hint: "Seçilen gün tamamlanan ziyaretler" },
  { key: "birthday", label: "Doğum günü", hint: "Önümüzdeki 7 gün içinde doğum günü olanlar" },
  { key: "winback", label: "Geri kazanım", hint: "Son ziyareti 60 günden eski, pazarlama izni olan müşteriler" },
];
export const VARS = ["{ad}", "{tarih}", "{saat}", "{hizmetler}", "{personel}", "{toplam}", "{salon}", "{yorum_link}", "{son_ziyaret}"];

export function pickLocale(c: { locale?: string | null; phone?: string | null; nationality?: string | null; first_name?: string | null; last_name?: string | null }): MsgLocale {
  const l = (c.locale ?? "").toLowerCase();
  if (/[\u0400-\u04FF]/.test(`${c.first_name ?? ""}${c.last_name ?? ""}`)) return "ru"; // Kiril isim → Rusça
  if (l.startsWith("tr")) return "tr";
  if (l.startsWith("ru") || l.startsWith("uk")) return "ru";
  if (l.startsWith("en")) return "en";
  const p = (c.phone ?? "").replace(/\D/g, "");
  if (p.startsWith("90")) return "tr";
  if (p.startsWith("7") || p.startsWith("375") || p.startsWith("380") || p.startsWith("77")) return "ru";
  return "en";
}

export type Fill = { ad: string; tarih?: string; saat?: string; hizmetler?: string; personel?: string; toplam?: string; salon: string; yorum_link?: string; son_ziyaret?: string };

export function fill(template: string, f: Fill) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (f as Record<string, string | undefined>)[k] ?? m).replace(/\s{2,}/g, " ").trim();
}

export function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function fmtForLocale(iso: string, locale: MsgLocale) {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00+03:00" : iso);
  const lang = locale === "tr" ? "tr-TR" : locale === "ru" ? "ru-RU" : "en-GB";
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", weekday: "long", timeZone: "Europe/Istanbul" }).format(d);
}

export { fmtDate, fmtTime };
