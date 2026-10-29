-- Personel unvanı 3 dilde + çalışma saatleri için yardımcı indeks
alter table public.staff add column if not exists title_en text not null default '';
alter table public.staff add column if not exists title_ru text not null default '';

update public.staff set
  title_en = case title
    when 'Uzman' then 'Specialist' when 'Yönetici' then 'Manager' when 'Dermatolog, Podolog' then 'Dermatologist, Podologist'
    when 'Kozmetolog' then 'Cosmetologist' when 'Estetisyen' then 'Beautician' when 'Masör' then 'Massage therapist'
    when 'Masöz' then 'Massage therapist' else title_en end,
  title_ru = case title
    when 'Uzman' then 'Мастер' when 'Yönetici' then 'Администратор' when 'Dermatolog, Podolog' then 'Дерматолог, подолог'
    when 'Kozmetolog' then 'Косметолог' when 'Estetisyen' then 'Эстетист' when 'Masör' then 'Массажист'
    when 'Masöz' then 'Массажистка' else title_ru end
where title_en = '' or title_ru = '';

create unique index if not exists staff_schedules_uniq on public.staff_schedules (staff_id, weekday, start_time);
