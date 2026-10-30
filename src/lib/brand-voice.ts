/* Bamboo Beauty Lifes — WhatsApp yazışma üslubu (Adem ile kurulan marka kuralları).
   Şablon varsayılanları, Claude istemleri ve şablon editöründeki üslup kontrolü buradan beslenir. */
import type { MsgKind, MsgLocale } from "@/lib/messages";

export const BRAND_NAME = "Bamboo Beauty Lifes";
export const BRAND_SIGN = `${BRAND_NAME} 🌿`;
export const BRAND_EMOJIS = ["🌸", "✨", "💚", "🌿"] as const;
export const CLOSING: Record<MsgLocale, string> = { tr: "Sevgilerimizle,", en: "Warm regards,", ru: "С теплом," };

/** Claude'a verilen üslup kuralları (kişiselleştirme, kampanya çevirisi) */
export const BRAND_VOICE_RULES = `Bamboo Beauty Lifes WhatsApp style (strict):
- Premium beauty & wellness salon in Marmaris ("Beauty & Wellness"); never call it a spa or a hairdresser. Collective, warm, professional "we" voice; never salesy or pushy.
- Short separate paragraphs (1–3 sentences each), one idea per paragraph, separated by a blank line — never one dense block.
- Order: greeting line with 🌸 → thanks / acknowledgement → the information (use "•" bullets for lists, "✨" before recommended options) → a gentle collaborative question on its own line → sign-off.
- Sign-off on its own lines after a blank line: a closing word (TR "Sevgilerimizle," / EN "Warm regards," / RU "С теплом,") then exactly "Bamboo Beauty Lifes 🌿" as the very last line. Every message ends with "Bamboo Beauty Lifes 🌿".
- At least 3 emojis, only from 🌸 ✨ 💚 🌿 (🌸 greeting, ✨ options/good news, 💚 warmth/care, 🌿 signature). No other emojis.
- Turkish: never use the curt word "Anladık"; use warmer phrases ("Not aldık, teşekkür ederiz").
- Never mention or suggest HIFU, Botox, fillers or any medical procedure unless it is already in the draft. Never invent prices, discounts, dates or medical claims.`;

/** Üslup kontrolü: editörde ve kampanya formunda uyarı olarak gösterilir */
export function styleIssues(text: string, locale: MsgLocale = "tr"): string[] {
  const out: string[] = [];
  const t = text.trim();
  if (!t) return out;
  const lines = t.split("\n").map((l) => l.trim());
  if (lines[lines.length - 1] !== BRAND_SIGN) out.push("Son satır “Bamboo Beauty Lifes 🌿” olmalı");
  const emojis = t.match(/\p{Extended_Pictographic}/gu) ?? [];
  const brand = emojis.filter((e) => (BRAND_EMOJIS as readonly string[]).includes(e));
  if (brand.length < 3) out.push("En az 3 marka emojisi (🌸 ✨ 💚 🌿)");
  const off = [...new Set(emojis.filter((e) => !(BRAND_EMOJIS as readonly string[]).includes(e)))];
  if (off.length) out.push(`Marka dışı emoji: ${off.join(" ")}`);
  if (!/\n\s*\n/.test(t)) out.push("Kısa paragraflara bölün (aralarda boş satır)");
  if (lines.some((l) => l.length > 320)) out.push("Çok uzun paragraf var");
  if (locale === "tr" && /(^|[\s.,!])anladık([\s.,!]|$)/i.test(t)) out.push("“Anladık” yerine daha sıcak bir ifade kullanın");
  if (/\b(hifu|botoks|botox|dolgu|filler)\b/i.test(t)) out.push("HIFU / botoks / dolgu şablonda geçmemeli (Adem onayı gerekir)");
  return out;
}

/** Varsayılan şablonlar — Ayarlar'da "Bamboo üslubunu yükle" ile geri getirilir */
export const DEFAULT_TEMPLATES: Record<MsgKind, Record<MsgLocale, string>> = {
  reminder: {
    tr: `Merhaba {ad} 🌸

{tarih}, saat {saat} için randevunuzu hatırlatmak isteriz ✨

• {hizmetler}
• Uzmanınız: {personel}

Bir değişiklik gerekirse bu mesaja yazmanız yeterli; size en uygun saati birlikte ayarlarız 💚

Görüşmek üzere,
Bamboo Beauty Lifes 🌿`,
    en: `Hello {ad} 🌸

We'd like to remind you of your appointment on {tarih} at {saat} ✨

• {hizmetler}
• Your specialist: {personel}

If anything changes, simply reply to this message and we'll find the best time for you together 💚

See you soon,
Bamboo Beauty Lifes 🌿`,
    ru: `Здравствуйте, {ad} 🌸

Напоминаем о вашей записи: {tarih}, в {saat} ✨

• {hizmetler}
• Ваш специалист: {personel}

Если планы изменятся, просто ответьте на это сообщение — мы вместе подберём удобное время 💚

До встречи,
Bamboo Beauty Lifes 🌿`,
  },
  thanks: {
    tr: `Merhaba {ad} 🌸

Bugün bizi tercih ettiğiniz için çok teşekkür ederiz; sizi ağırlamak bizim için büyük bir mutluluktu 💚

Deneyiminizi birkaç saniyede puanlamak isterseniz bağlantınız burada ✨
{yorum_link}

Görüşleriniz, size her ziyarette daha iyi hizmet vermemize yardımcı oluyor.

Sevgilerimizle,
Bamboo Beauty Lifes 🌿`,
    en: `Hello {ad} 🌸

Thank you so much for choosing us today — it was a real pleasure to welcome you 💚

If you'd like to rate your experience, it only takes a few seconds ✨
{yorum_link}

Your feedback helps us make every visit even better for you.

Warm regards,
Bamboo Beauty Lifes 🌿`,
    ru: `Здравствуйте, {ad} 🌸

Большое спасибо, что выбрали нас сегодня — нам было очень приятно вас принимать 💚

Если хотите оценить визит, это займёт всего несколько секунд ✨
{yorum_link}

Ваше мнение помогает нам делать каждый визит ещё лучше.

С теплом,
Bamboo Beauty Lifes 🌿`,
  },
  birthday: {
    tr: `Mutlu yıllar {ad} 🌸

Yeni yaşınızın sağlık, huzur ve güzelliklerle dolu olmasını dileriz 💚

Doğum gününüze özel, bu ay içinde tüm bakımlarımızda %10 indirimle sizi ağırlamaktan mutluluk duyarız ✨

Size uygun bir gün ve saat ayarlamamızı ister misiniz?

Sevgilerimizle,
Bamboo Beauty Lifes 🌿`,
    en: `Happy birthday, {ad} 🌸

We wish you a new year full of health, calm and beautiful moments 💚

To celebrate, we'd be delighted to welcome you with 10% off all our treatments this month ✨

Would you like us to find a day and time that suits you?

Warm regards,
Bamboo Beauty Lifes 🌿`,
    ru: `С днём рождения, {ad} 🌸

Желаем вам года, наполненного здоровьем, гармонией и красотой 💚

В честь праздника будем рады видеть вас со скидкой 10% на все процедуры в этом месяце ✨

Подобрать для вас удобный день и время?

С теплом,
Bamboo Beauty Lifes 🌿`,
  },
  winback: {
    tr: `Merhaba {ad} 🌸

Sizi en son {son_ziyaret} tarihinde ağırlamıştık; sizi yeniden aramızda görmeyi çok isteriz 💚

Bakım rutininize kaldığınız yerden devam etmek isterseniz, size uygun bir zamanı birlikte planlayabiliriz ✨

Hangi gün ve saat sizin için daha uygun olur?

Sevgilerimizle,
Bamboo Beauty Lifes 🌿`,
    en: `Hello {ad} 🌸

Your last visit with us was on {son_ziyaret} — we'd love to welcome you back 💚

If you'd like to continue your care routine, we'd be happy to plan a time that suits you ✨

Which day and time would work best for you?

Warm regards,
Bamboo Beauty Lifes 🌿`,
    ru: `Здравствуйте, {ad} 🌸

Ваш последний визит к нам был {son_ziyaret} — мы будем рады видеть вас снова 💚

Если захотите продолжить уход, мы с удовольствием подберём удобное для вас время ✨

Какой день и время вам подойдут?

С теплом,
Bamboo Beauty Lifes 🌿`,
  },
};

/** Form / bakım rehberi gibi panelden açılan WhatsApp metinleri için ortak kalıp */
export function brandMessage(locale: MsgLocale, parts: { greet: string; body: string[]; ask?: string }) {
  return [parts.greet, ...parts.body, ...(parts.ask ? [parts.ask] : []), `${CLOSING[locale]}\n${BRAND_SIGN}`].join("\n\n");
}
