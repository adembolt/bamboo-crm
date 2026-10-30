import { GUIDES } from "./schemas";
import { formTx } from "./i18n";
import { BRAND_SIGN, CLOSING } from "@/lib/brand-voice";

const H = {
  tr: { hi: "Merhaba 🌸", intro: "*{name}* sonrası bakım önerilerimizi sizin için paylaşıyoruz ✨", first: "İlk 24–48 saat", later: "Sonraki günler", avoid: "Kaçının", call: "Bize ulaşın", care: "Aklınıza takılan her şey için buradayız 💚" },
  en: { hi: "Hello 🌸", intro: "Here are our aftercare tips following your *{name}* treatment ✨", first: "First 24–48 hours", later: "The following days", avoid: "Please avoid", call: "Contact us", care: "We're always here if you have any questions 💚" },
  ru: { hi: "Здравствуйте 🌸", intro: "Делимся рекомендациями по уходу после процедуры *{name}* ✨", first: "Первые 24–48 часов", later: "В следующие дни", avoid: "Избегайте", call: "Свяжитесь с нами", care: "Мы всегда на связи, если появятся вопросы 💚" },
} as const;

/** WhatsApp'a yapıştırılacak bakım rehberi — Bamboo üslubu: kısa paragraflar, marka emojileri, imza */
export function guideText(key: string, lang = "tr") {
  const g = GUIDES[key]; if (!g) return "";
  const l = (lang in H ? lang : "tr") as keyof typeof H;
  const tx = formTx(l), h = H[l];
  return [
    h.hi,
    h.intro.replace("{name}", tx(g.name)),
    [`*${h.first}*`, ...g.first.map((x) => `• ${tx(x)}`)].join("\n"),
    [`*${h.later}*`, ...g.later.map((x) => `• ${tx(x)}`)].join("\n"),
    `*${h.avoid}:* ${tx(g.avoid)}`,
    `*${h.call}:* ${tx(g.call)}`,
    h.care,
    `${CLOSING[l]}\n${BRAND_SIGN}`,
  ].join("\n\n");
}
