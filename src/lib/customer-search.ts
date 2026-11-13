/** Müşteri araması: "Ayşe Yılmaz" gibi birden çok kelimede her kelime ad, soyad veya telefonda geçmeli.
    Türkçe i/ı/İ/I farkı yüzünden bu harfler tek karakter joker (_) ile aranır; telefon için yalnız rakamlar. */
export function applyCustomerSearch<T extends { or: (filters: string) => T }>(query: T, raw: string): T {
  const clean = raw.replace(/[%,()*\\"]/g, " ").trim();
  if (!clean) return query;
  const digits = clean.replace(/\D/g, "");
  const words = clean.split(/\s+/).filter((w) => w && !/^[+\d][\d\-]*$/.test(w));
  if (!words.length) return digits.length >= 3 ? query.or(`phone.ilike.%${digits}%`) : query;
  let q = query;
  for (const w of words) {
    const p = `%${w.replace(/[iıİI]/g, "_")}%`;
    q = q.or(`first_name.ilike.${p},last_name.ilike.${p},phone.ilike.%${w}%`);
  }
  if (digits.length >= 3) q = q.or(`phone.ilike.%${digits}%`);
  return q;
}
