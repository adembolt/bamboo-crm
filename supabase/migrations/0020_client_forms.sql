-- Danışan formları (kabul, onam, lazer, HIFU, peeling, masaj, değerlendirme), seans kayıtları, bakım rehberleri
create table if not exists public.client_forms (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  visit_id     uuid references public.visits(id) on delete set null,
  form_key     text not null,                     -- intake | laser | hifu | peel | massage | assess
  form_date    date not null default current_date,
  status       text not null default 'signed' check (status in ('pending','signed','completed')),
                                                   -- pending: danışana bağlantı gönderildi, henüz doldurmadı
  data         jsonb not null default '{}'::jsonb,
  signatures   jsonb not null default '{}'::jsonb, -- {client: dataURL, staff: dataURL}
  flags        text[] not null default '{}',       -- "evet" denen sağlık / kontrendikasyon maddeleri (kısa)
  staff_name   text not null default '',
  staff_id     uuid references public.staff(id) on delete set null,
  token        text unique default replace(gen_random_uuid()::text, '-', ''),  -- uzaktan imza bağlantısı
  lang         text not null default 'tr',
  signed_at    timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists client_forms_customer on public.client_forms (customer_id, form_date desc);
create index if not exists client_forms_visit on public.client_forms (visit_id);
create index if not exists client_forms_pending on public.client_forms (status) where status = 'pending';
alter table public.client_forms enable row level security;
drop policy if exists cf_read on public.client_forms;
create policy cf_read on public.client_forms for select using (public.is_internal());
drop policy if exists cf_insert on public.client_forms;
create policy cf_insert on public.client_forms for insert with check (public.is_internal());
drop policy if exists cf_update on public.client_forms;
create policy cf_update on public.client_forms for update using (public.is_internal()) with check (public.is_internal());
drop policy if exists cf_delete on public.client_forms;
create policy cf_delete on public.client_forms for delete using (public.is_manager() or (status = 'pending' and public.is_internal()));

create table if not exists public.client_sessions (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  visit_id     uuid references public.visits(id) on delete set null,
  kind         text not null,                      -- laser | hifu | skin | massage | body | other
  session_date date not null default current_date,
  fields       jsonb not null default '{}'::jsonb,
  staff_name   text not null default '',
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists client_sessions_customer on public.client_sessions (customer_id, kind, session_date);
alter table public.client_sessions enable row level security;
drop policy if exists cs_read on public.client_sessions;
create policy cs_read on public.client_sessions for select using (public.is_internal());
drop policy if exists cs_write on public.client_sessions;
create policy cs_write on public.client_sessions for insert with check (public.is_internal());
drop policy if exists cs_delete on public.client_sessions;
create policy cs_delete on public.client_sessions for delete using (public.can_write_ops());

create table if not exists public.care_guides_given (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  visit_id     uuid references public.visits(id) on delete set null,
  guide_key    text not null,
  given_at     date not null default current_date,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists care_guides_customer on public.care_guides_given (customer_id, given_at desc);
alter table public.care_guides_given enable row level security;
drop policy if exists cg_read on public.care_guides_given;
create policy cg_read on public.care_guides_given for select using (public.is_internal());
drop policy if exists cg_write on public.care_guides_given;
create policy cg_write on public.care_guides_given for all using (public.is_internal()) with check (public.is_internal());

-- son kabul formundaki sağlık uyarıları müşteri kartında ve randevuda gösterilir
alter table public.customers add column if not exists health_flags text[] not null default '{}';
select 'ok' as sonuc;
