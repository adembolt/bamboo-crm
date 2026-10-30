import { GUIDES } from "./schemas";
import { formTx } from "./i18n";

const H = {
  tr: { title: "{name} Sonrası Bakım", first: "İlk 24–48 saat", later: "Sonraki günler", avoid: "Kaçının", call: "Bize ulaşın", bye: "Sağlıklı ve güzel günler dileriz 🌿" },
  en: { title: "Aftercare: {name}", first: "First 24–48 hours", later: "The following days", avoid: "Avoid", call: "Contact us", bye: "Wishing you healthy and beautiful days 🌿" },
  ru: { title: "Уход после процедуры: {name}", first: "Первые 24–48 часов", later: "В следующие дни", avoid: "Избегайте", call: "Свяжитесь с нами", bye: "Желаем вам здоровья и красоты 🌿" },
} as const;

/** WhatsApp'a yapıştırılacak bakım rehberi metni */
export function guideText(key: string, lang = "tr") {
  const g = GUIDES[key]; if (!g) return "";
  const tx = formTx(lang), h = H[(lang in H ? lang : "tr") as keyof typeof H];
  return [
    `*Bamboo Beauty Lifes — ${h.title.replace("{name}", tx(g.name))}*`, "",
    `*${h.first}*`, ...g.first.map((x) => `• ${tx(x)}`), "",
    `*${h.later}*`, ...g.later.map((x) => `• ${tx(x)}`), "",
    `*${h.avoid}:* ${tx(g.avoid)}`, `*${h.call}:* ${tx(g.call)}`, "", h.bye,
  ].join("\n");
}
