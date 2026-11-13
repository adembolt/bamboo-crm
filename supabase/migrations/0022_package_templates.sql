-- Paket şablonları (DIKIDI "Packages → Templates" gibi): satışta tek tıkla doldurulur
create table if not exists public.package_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  service_id   uuid references public.services(id) on delete set null,
  sessions     int not null check (sessions > 0),
  price        numeric(12,2) not null default 0,
  valid_days   int,                                   -- boş = süresiz
  description  text not null default '',
  is_active    boolean not null default true,
  sort_order   int not null default 100,
  created_at   timestamptz not null default now()
);
alter table public.package_templates enable row level security;
drop policy if exists pt_read on public.package_templates;
create policy pt_read on public.package_templates for select using (public.is_internal());
drop policy if exists pt_write on public.package_templates;
create policy pt_write on public.package_templates for all using (public.is_manager()) with check (public.is_manager());

-- DIKIDI'deki iki şablon
insert into public.package_templates (name, service_id, sessions, price, valid_days, description, sort_order)
select '5 Seans Osteopatik Masaj Paketi / 5-Session Osteopathic Massage Package',
       (select id from public.services where name_tr ilike '%osteopat%' order by price desc limit 1), 5, 16200, 90, '5 × Full Body Osteopathic Correction', 1
where not exists (select 1 from public.package_templates where name ilike '5 Seans Osteopatik%');
insert into public.package_templates (name, service_id, sessions, price, valid_days, description, sort_order)
select 'Aylık Masaj Kartı 4+1 / Monthly Massage Card 4+1', null, 5, 10000, 30, '4 seans kart sahibine + 1 seans sevdiği birine', 2
where not exists (select 1 from public.package_templates where name ilike 'Aylık Masaj Kartı%');
select name, sessions, price, valid_days, service_id is not null as hizmet_bagli from public.package_templates order by sort_order;
