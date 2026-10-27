-- Randevu düzenleme ekranı (DIKIDI "Edit appointment" karşılığı)
alter table public.visits add column if not exists color text not null default '';
alter table public.visits add column if not exists is_anonymous boolean not null default false;
alter table public.visits add column if not exists remind_offsets int[] not null default '{1440}';   -- dakika: 1440 = 1 gün önce
alter table public.visits add column if not exists remind_confirm boolean not null default true;
alter table public.visits add column if not exists review_request text not null default 'auto';  -- auto | none | 2h | 24h
alter table public.visits add column if not exists promo_code text not null default '';
alter table public.visit_items add column if not exists break_min int not null default 0;

create table if not exists public.promo_codes (
  code        text primary key,
  percent     numeric(5,2) not null check (percent > 0 and percent <= 100),
  description text not null default '',
  valid_until date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
create policy promo_read on public.promo_codes for select using (public.is_internal());
create policy promo_write on public.promo_codes for all using (public.is_manager()) with check (public.is_manager());

create table if not exists public.visit_files (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references public.visits(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  storage_path text not null,
  file_name    text not null,
  mime         text not null default '',
  size_bytes   int not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists visit_files_visit on public.visit_files (visit_id);
alter table public.visit_files enable row level security;
create policy visit_files_read on public.visit_files for select using (public.is_internal());
create policy visit_files_write on public.visit_files for all using (public.can_write_ops()) with check (public.can_write_ops());

insert into storage.buckets (id, name, public) values ('visit-files', 'visit-files', false) on conflict (id) do nothing;
create policy "visit files read" on storage.objects for select using (bucket_id = 'visit-files' and public.is_internal());
create policy "visit files write" on storage.objects for insert with check (bucket_id = 'visit-files' and public.can_write_ops());
create policy "visit files delete" on storage.objects for delete using (bucket_id = 'visit-files' and public.can_write_ops());

create index if not exists audit_entity on public.audit_log (entity, entity_id, created_at desc);
