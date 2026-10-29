-- Personel cari hesabı (prim / kesinti) ve kampanya mesajları
create table if not exists public.staff_adjustments (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id) on delete cascade,
  adj_date   date not null default current_date,
  amount     numeric(12,2) not null,          -- + prim / ek ödeme hakkı, − kesinti / ceza
  note       text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists staff_adjustments_staff on public.staff_adjustments (staff_id, adj_date);
alter table public.staff_adjustments enable row level security;
drop policy if exists sadj_read on public.staff_adjustments;
create policy sadj_read on public.staff_adjustments for select using (public.is_manager());
drop policy if exists sadj_write on public.staff_adjustments;
create policy sadj_write on public.staff_adjustments for all using (public.is_manager()) with check (public.is_manager());

-- Hesaplaşmanın başladığı gün (öncesi kapanmış kabul edilir)
alter table public.settings add column if not exists payroll_start date not null default '2026-10-01';

create table if not exists public.campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  segment    jsonb not null default '{}'::jsonb,
  body_tr    text not null default '',
  body_en    text not null default '',
  body_ru    text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select using (public.is_internal());
drop policy if exists campaigns_write on public.campaigns;
create policy campaigns_write on public.campaigns for all using (public.is_manager()) with check (public.is_manager());
select 'ok' as sonuc;
