-- Müşteri deneyimi: ziyaret sonrası puanlama, tarihli notlar, öncesi/sonrası fotoğraflar
alter table public.visits add column if not exists review_token text;
update public.visits set review_token = replace(gen_random_uuid()::text, '-', '') where review_token is null;
alter table public.visits alter column review_token set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists visits_review_token on public.visits (review_token);

alter table public.reviews add column if not exists visit_id uuid references public.visits(id) on delete set null;
alter table public.reviews add column if not exists handled boolean not null default false;  -- düşük puan ele alındı mı
create unique index if not exists reviews_visit on public.reviews (visit_id) where visit_id is not null and source = 'salon';

create table if not exists public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  body        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists customer_notes_customer on public.customer_notes (customer_id, created_at desc);
alter table public.customer_notes enable row level security;
drop policy if exists cnotes_read on public.customer_notes;
create policy cnotes_read on public.customer_notes for select using (public.is_internal());
drop policy if exists cnotes_write on public.customer_notes;
create policy cnotes_write on public.customer_notes for all using (public.can_write_ops()) with check (public.can_write_ops());

alter table public.customer_photos add column if not exists kind text not null default 'other' check (kind in ('before','after','other'));
alter table public.customer_photos add column if not exists visit_id uuid references public.visits(id) on delete set null;
alter table public.customer_photos add column if not exists created_by uuid references public.profiles(id) on delete set null;
select 'ok' as sonuc;
