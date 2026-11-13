-- DIKIDI menü eşitliği: bahşiş, ceza, arama kaydı, referans programı, kampanyalar, uyarılar

-- Bahşişler (personele ait para; kart/havale ile geleni salon tutar, maaş hesaplaşmasında personele borç yazılır)
create table if not exists public.tips (
  id          uuid primary key default gen_random_uuid(),
  tip_date    date not null default current_date,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  method      public.pay_method not null default 'cash',
  to_payroll  boolean not null default true,   -- false: nakit doğrudan personele verildi (sadece istatistik)
  customer_id uuid references public.customers(id) on delete set null,
  note        text not null default '',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists tips_date on public.tips (tip_date desc);
alter table public.tips enable row level security;
drop policy if exists tips_read on public.tips;
create policy tips_read on public.tips for select using (public.is_internal());
drop policy if exists tips_write on public.tips;
create policy tips_write on public.tips for all using (public.can_write_ops()) with check (public.can_write_ops());

-- Cezalar (gelmeme, geç iptal): müşterinin bakiyesine borç olarak yazılır
create table if not exists public.fines (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  visit_id    uuid references public.visits(id) on delete set null,
  kind        text not null default 'other' check (kind in ('no_show','late_cancel','other')),
  amount      numeric(12,2) not null check (amount > 0),
  reason      text not null default '',
  fine_date   date not null default current_date,
  waived      boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists fines_visit_kind on public.fines (visit_id, kind) where visit_id is not null;
alter table public.fines enable row level security;
drop policy if exists fines_read on public.fines;
create policy fines_read on public.fines for select using (public.is_internal());
drop policy if exists fines_write on public.fines;
create policy fines_write on public.fines for all using (public.can_write_ops()) with check (public.can_write_ops());
alter table public.settings add column if not exists fine_no_show numeric(12,2) not null default 0;
alter table public.settings add column if not exists fine_late_cancel numeric(12,2) not null default 0;
alter table public.settings add column if not exists fine_late_cancel_hours int not null default 24;

-- Arama kaydı
create table if not exists public.call_logs (
  id          uuid primary key default gen_random_uuid(),
  call_at     timestamptz not null default now(),
  direction   text not null default 'in' check (direction in ('in','out')),
  outcome     text not null default 'answered' check (outcome in ('answered','missed','no_answer','booked','callback')),
  customer_id uuid references public.customers(id) on delete set null,
  phone       text not null default '',
  note        text not null default '',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists call_logs_at on public.call_logs (call_at desc);
alter table public.call_logs enable row level security;
drop policy if exists calls_read on public.call_logs;
create policy calls_read on public.call_logs for select using (public.is_internal());
drop policy if exists calls_write on public.call_logs;
create policy calls_write on public.call_logs for all using (public.is_internal()) with check (public.is_internal());

-- Referans programı
create table if not exists public.referral_offers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  referrer_points  int not null default 0,
  invitee_discount numeric(5,2) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create table if not exists public.referral_rewards (
  id          uuid primary key default gen_random_uuid(),
  invitee_id  uuid not null unique references public.customers(id) on delete cascade,
  referrer_id uuid not null references public.customers(id) on delete cascade,
  offer_id    uuid references public.referral_offers(id) on delete set null,
  points      int not null default 0,
  sale_id     uuid references public.sales(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.referral_offers enable row level security;
alter table public.referral_rewards enable row level security;
drop policy if exists ro_read on public.referral_offers;
create policy ro_read on public.referral_offers for select using (public.is_internal());
drop policy if exists ro_write on public.referral_offers;
create policy ro_write on public.referral_offers for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists rr_read on public.referral_rewards;
create policy rr_read on public.referral_rewards for select using (public.is_internal());
drop policy if exists rr_write on public.referral_rewards;
create policy rr_write on public.referral_rewards for all using (public.can_write_ops()) with check (public.can_write_ops());
insert into public.referral_offers (name, referrer_points, invitee_discount)
select 'İlk ziyaret', 50, 10 where not exists (select 1 from public.referral_offers);

-- Kampanyalar (DIKIDI "Deals"): online randevu sayfasında yayınlanır
create table if not exists public.deals (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  discount_percent numeric(5,2),
  price        numeric(12,2),
  old_price    numeric(12,2),
  starts_on    date not null default current_date,
  ends_on      date,
  service_ids  uuid[] not null default '{}',
  is_published boolean not null default false,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.deals enable row level security;
drop policy if exists deals_read on public.deals;
create policy deals_read on public.deals for select using (public.is_internal() or (is_published and not is_archived and starts_on <= current_date and (ends_on is null or ends_on >= current_date)));
drop policy if exists deals_write on public.deals;
create policy deals_write on public.deals for all using (public.is_manager()) with check (public.is_manager());
