"use client";
import { useState, useTransition } from "react";
import { submitReview } from "./actions";

const T = {
  tr: { note: "Eklemek istedikleriniz (isteğe bağlı)", send: "Gönder", thanks: "Teşekkür ederiz! 💚", google: "Deneyiminizi Google'da da paylaşır mısınız? Bize çok yardımcı olur.", gbtn: "Google'da yorum yaz", low: "Geri bildiriminiz doğrudan salon yöneticimize iletildi. Bir sonraki ziyaretinizde daha iyisini yapacağız.", err: "Gönderilemedi, lütfen tekrar deneyin.", pick: "Lütfen bir puan seçin." },
  en: { note: "Anything you'd like to add (optional)", send: "Send", thanks: "Thank you! 💚", google: "Would you share your experience on Google too? It helps us a lot.", gbtn: "Write a Google review", low: "Your feedback went straight to our salon manager. We'll do better on your next visit.", err: "Could not send, please try again.", pick: "Please choose a rating." },
  ru: { note: "Что бы вы хотели добавить (необязательно)", send: "Отправить", thanks: "Спасибо! 💚", google: "Поделитесь впечатлениями и в Google? Нам это очень поможет.", gbtn: "Оставить отзыв в Google", low: "Ваш отзыв передан руководителю салона. В следующий раз мы сделаем лучше.", err: "Не удалось отправить, попробуйте ещё раз.", pick: "Пожалуйста, выберите оценку." },
};

export function ReviewForm({ token, lang, initial }: { token: string; lang: "tr" | "en" | "ru"; initial: { rating: number; body: string } | null }) {
  const tx = T[lang];
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [body, setBody] = useState(initial?.body ?? "");
  const [done, setDone] = useState<{ google: string | null } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="grid gap-3">
        <p className="text-lg font-bold">{tx.thanks}</p>
        {done.google ? <><p className="text-sm">{tx.google}</p><a className="btn justify-self-start" href={done.google} target="_blank" rel="noreferrer">⭐ {tx.gbtn}</a></> : rating <= 3 ? <p className="text-sm text-muted">{tx.low}</p> : null}
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex gap-1" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)} className={`text-4xl leading-none transition-transform hover:scale-110 ${n <= rating ? "text-warn" : "text-muted/40"}`}>★</button>
        ))}
      </div>
      <textarea className="inp min-h-[90px] p-2" value={body} onChange={(e) => setBody(e.target.value)} placeholder={tx.note} maxLength={2000} />
      {err && <p className="pill bad">{err}</p>}
      <button className="btn" disabled={pending} onClick={() => { if (!rating) return setErr(tx.pick); setErr(""); start(async () => { const r = await submitReview(token, rating, body); if (r.ok) setDone({ google: r.google }); else setErr(tx.err); }); }}>{tx.send}</button>
    </div>
  );
}
