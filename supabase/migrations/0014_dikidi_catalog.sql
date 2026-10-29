-- DIKIDI'den aktarılan gün gün çalışma saatleri ve personel bazlı hizmet ayarları
alter table public.staff add column if not exists schedule_mode text not null default 'weekly' check (schedule_mode in ('weekly','daily'));
alter table public.staff add column if not exists dikidi_master_id text;

-- 'daily' modda: o gün satır yoksa personel çalışmıyor (DIKIDI ile aynı mantık)
create table if not exists public.staff_day_hours (
  staff_id   uuid not null references public.staff(id) on delete cascade,
  day        date not null,
  start_time time not null,
  end_time   time not null,
  source     text not null default 'dikidi',
  primary key (staff_id, day, start_time),
  check (end_time > start_time)
);
create index if not exists staff_day_hours_day on public.staff_day_hours (day);
alter table public.staff_day_hours enable row level security;
drop policy if exists staff_day_hours_read on public.staff_day_hours;
create policy staff_day_hours_read on public.staff_day_hours for select using (true);
drop policy if exists staff_day_hours_write on public.staff_day_hours;
create policy staff_day_hours_write on public.staff_day_hours for all using (public.is_manager()) with check (public.is_manager());

-- personel ↔ hizmet: online açık mı
alter table public.staff_services add column if not exists online boolean not null default true;
alter table public.services add column if not exists dikidi_id text;
create index if not exists services_dikidi_id on public.services (dikidi_id);
