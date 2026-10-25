-- DIKIDI'deki personel ve kaynaklar (başlangıç; panelden düzenlenir)
begin;

insert into public.staff (full_name, title, color, pay_model, online_bookable, sort_order) values
  ('Bilmez Maryna',    'Kozmetolog',        '#1E6E8A', 'percent', true, 10),
  ('Gençtürk Nuray',   'Kozmetolog',        '#3B6FB6', 'percent', true, 20),
  ('Bilmez Adem',      'Masör',             '#0A7A1E', 'percent', true, 30),
  ('Ozdemir Canser',   'Estetisyen',        '#A8854A', 'percent', true, 40),
  ('Çankaya Gülten',   'Uzman',             '#5E9E6C', 'percent', true, 50),
  ('Yenişafak Saniye', 'Uzman',             '#8DBA93', 'percent', true, 60),
  ('Dilay',            'Uzman',             '#9A5B8A', 'percent', true, 70),
  ('Seler Tati',       'Yönetici',          '#5B6B5F', 'fixed',   false, 80);

insert into public.resources (name, kind, sort_order) values
  ('Kozmetoloji kabini', 'room', 10),
  ('Masaj odası',        'room', 20);

commit;
