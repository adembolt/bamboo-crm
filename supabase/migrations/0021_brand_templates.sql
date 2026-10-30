-- Mesaj şablonları: Bamboo WhatsApp üslubu
insert into public.message_templates (kind, locale, body, updated_at) values
('reminder', 'tr', 'Merhaba {ad} 🌸

{tarih}, saat {saat} için randevunuzu hatırlatmak isteriz ✨

• {hizmetler}
• Uzmanınız: {personel}

Bir değişiklik gerekirse bu mesaja yazmanız yeterli; size en uygun saati birlikte ayarlarız 💚

Görüşmek üzere,
Bamboo Beauty Lifes 🌿', now()),
('reminder', 'en', 'Hello {ad} 🌸

We''d like to remind you of your appointment on {tarih} at {saat} ✨

• {hizmetler}
• Your specialist: {personel}

If anything changes, simply reply to this message and we''ll find the best time for you together 💚

See you soon,
Bamboo Beauty Lifes 🌿', now()),
('reminder', 'ru', 'Здравствуйте, {ad} 🌸

Напоминаем о вашей записи: {tarih}, в {saat} ✨

• {hizmetler}
• Ваш специалист: {personel}

Если планы изменятся, просто ответьте на это сообщение — мы вместе подберём удобное время 💚

До встречи,
Bamboo Beauty Lifes 🌿', now()),
('thanks', 'tr', 'Merhaba {ad} 🌸

Bugün bizi tercih ettiğiniz için çok teşekkür ederiz; sizi ağırlamak bizim için büyük bir mutluluktu 💚

Deneyiminizi birkaç saniyede puanlamak isterseniz bağlantınız burada ✨
{yorum_link}

Görüşleriniz, size her ziyarette daha iyi hizmet vermemize yardımcı oluyor.

Sevgilerimizle,
Bamboo Beauty Lifes 🌿', now()),
('thanks', 'en', 'Hello {ad} 🌸

Thank you so much for choosing us today — it was a real pleasure to welcome you 💚

If you''d like to rate your experience, it only takes a few seconds ✨
{yorum_link}

Your feedback helps us make every visit even better for you.

Warm regards,
Bamboo Beauty Lifes 🌿', now()),
('thanks', 'ru', 'Здравствуйте, {ad} 🌸

Большое спасибо, что выбрали нас сегодня — нам было очень приятно вас принимать 💚

Если хотите оценить визит, это займёт всего несколько секунд ✨
{yorum_link}

Ваше мнение помогает нам делать каждый визит ещё лучше.

С теплом,
Bamboo Beauty Lifes 🌿', now()),
('birthday', 'tr', 'Mutlu yıllar {ad} 🌸

Yeni yaşınızın sağlık, huzur ve güzelliklerle dolu olmasını dileriz 💚

Doğum gününüze özel, bu ay içinde tüm bakımlarımızda %10 indirimle sizi ağırlamaktan mutluluk duyarız ✨

Size uygun bir gün ve saat ayarlamamızı ister misiniz?

Sevgilerimizle,
Bamboo Beauty Lifes 🌿', now()),
('birthday', 'en', 'Happy birthday, {ad} 🌸

We wish you a new year full of health, calm and beautiful moments 💚

To celebrate, we''d be delighted to welcome you with 10% off all our treatments this month ✨

Would you like us to find a day and time that suits you?

Warm regards,
Bamboo Beauty Lifes 🌿', now()),
('birthday', 'ru', 'С днём рождения, {ad} 🌸

Желаем вам года, наполненного здоровьем, гармонией и красотой 💚

В честь праздника будем рады видеть вас со скидкой 10% на все процедуры в этом месяце ✨

Подобрать для вас удобный день и время?

С теплом,
Bamboo Beauty Lifes 🌿', now()),
('winback', 'tr', 'Merhaba {ad} 🌸

Sizi en son {son_ziyaret} tarihinde ağırlamıştık; sizi yeniden aramızda görmeyi çok isteriz 💚

Bakım rutininize kaldığınız yerden devam etmek isterseniz, size uygun bir zamanı birlikte planlayabiliriz ✨

Hangi gün ve saat sizin için daha uygun olur?

Sevgilerimizle,
Bamboo Beauty Lifes 🌿', now()),
('winback', 'en', 'Hello {ad} 🌸

Your last visit with us was on {son_ziyaret} — we''d love to welcome you back 💚

If you''d like to continue your care routine, we''d be happy to plan a time that suits you ✨

Which day and time would work best for you?

Warm regards,
Bamboo Beauty Lifes 🌿', now()),
('winback', 'ru', 'Здравствуйте, {ad} 🌸

Ваш последний визит к нам был {son_ziyaret} — мы будем рады видеть вас снова 💚

Если захотите продолжить уход, мы с удовольствием подберём удобное для вас время ✨

Какой день и время вам подойдут?

С теплом,
Bamboo Beauty Lifes 🌿', now())
on conflict (kind, locale) do update set body = excluded.body, updated_at = now();
select count(*) as sablon from public.message_templates;
