-- Mesaj şablonları ve gönderim kaydı (WhatsApp tıkla-gönder)
create table if not exists public.message_templates (
  kind    text not null,   -- reminder | thanks | birthday | winback | custom
  locale  text not null,   -- tr | en | ru
  body    text not null default '',
  updated_at timestamptz not null default now(),
  primary key (kind, locale)
);

create table if not exists public.message_log (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  visit_id    uuid references public.visits(id) on delete set null,
  kind        text not null,
  channel     text not null default 'whatsapp',
  body        text not null default '',
  sent_at     timestamptz not null default now(),
  sent_by     uuid references auth.users(id) on delete set null
);
create index if not exists message_log_customer on public.message_log (customer_id, kind, sent_at desc);
create index if not exists message_log_visit on public.message_log (visit_id, kind);

alter table public.message_templates enable row level security;
alter table public.message_log enable row level security;
create policy message_templates_read on public.message_templates for select using (public.is_internal());
create policy message_templates_write on public.message_templates for all using (public.is_manager()) with check (public.is_manager());
create policy message_log_read on public.message_log for select using (public.is_internal());
create policy message_log_write on public.message_log for insert with check (public.is_internal());

insert into public.message_templates (kind, locale, body) values
('reminder','tr','Merhaba {ad}, yarın {tarih} saat {saat} için {salon} randevunuzu hatırlatmak isteriz: {hizmetler}. Değişiklik gerekirse lütfen bize yazın. Görüşmek üzere! 🌿'),
('reminder','en','Hello {ad}, a friendly reminder of your appointment at {salon} tomorrow, {tarih} at {saat}: {hizmetler}. Please message us if anything changes. See you soon! 🌿'),
('reminder','ru','Здравствуйте, {ad}! Напоминаем о вашей записи в {salon} завтра, {tarih} в {saat}: {hizmetler}. Если планы изменятся, напишите нам. До встречи! 🌿'),
('thanks','tr','Merhaba {ad}, bugün {salon}''u tercih ettiğiniz için teşekkür ederiz. Memnun kaldıysanız kısa bir Google yorumu bizi çok mutlu eder: {yorum_link} 💚'),
('thanks','en','Hello {ad}, thank you for visiting {salon} today. If you enjoyed your treatment, a short Google review would mean a lot to us: {yorum_link} 💚'),
('thanks','ru','{ad}, спасибо, что выбрали {salon} сегодня! Если вам понравилось, короткий отзыв в Google очень нас порадует: {yorum_link} 💚'),
('birthday','tr','Mutlu yıllar {ad}! 🎂 {salon} ailesi olarak doğum gününüzü kutlar, bu ay içinde geçerli %10 doğum günü indirimimizle sizi bekleriz.'),
('birthday','en','Happy birthday {ad}! 🎂 Warm wishes from the {salon} team — enjoy a 10% birthday discount on any treatment this month.'),
('birthday','ru','С днём рождения, {ad}! 🎂 Команда {salon} поздравляет вас — дарим скидку 10% на любую процедуру в этом месяце.'),
('winback','tr','Merhaba {ad}, sizi {salon}''da görmeyeli epey oldu ({son_ziyaret}). Yeni dönem bakımlarımız için size uygun bir saat ayarlayalım mı? 🌿'),
('winback','en','Hello {ad}, it''s been a while since your last visit to {salon} ({son_ziyaret}). Shall we find you a time for your next treatment? 🌿'),
('winback','ru','Здравствуйте, {ad}! Давно не виделись в {salon} (последний визит {son_ziyaret}). Подобрать удобное время для следующей процедуры? 🌿')
on conflict (kind, locale) do nothing;
