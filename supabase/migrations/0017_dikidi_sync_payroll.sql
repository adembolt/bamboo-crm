-- Günlük DIKIDI eşitlemesi, maaş şemaları, kasa hesapları

-- DIKIDI kimlikleri (eşitleme tekrar çalıştığında aynı kaydı günceller)
alter table public.visit_items add column if not exists dikidi_id text;
create unique index if not exists visit_items_dikidi on public.visit_items (dikidi_id);
alter table public.visit_items add column if not exists booked_by_staff_id uuid references public.staff(id) on delete set null;
alter table public.sales add column if not exists dikidi_id text;
create unique index if not exists sales_dikidi on public.sales (dikidi_id);
alter table public.sale_items add column if not exists material_cost numeric(12,2) not null default 0;
alter table public.sale_items add column if not exists dikidi_pay numeric(12,2);
alter table public.sale_items add column if not exists staff_name text not null default '';
alter table public.expenses add column if not exists dikidi_id text;
create unique index if not exists expenses_dikidi on public.expenses (dikidi_id);
alter table public.staff_payouts add column if not exists dikidi_id text;
create unique index if not exists staff_payouts_dikidi on public.staff_payouts (dikidi_id);

-- Son eşitleme raporu
create table if not exists public.sync_runs (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'dikidi',
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  range_from  date,
  range_to    date,
  report      jsonb not null default '{}'::jsonb,
  ok          boolean not null default false
);
alter table public.sync_runs enable row level security;
drop policy if exists sync_runs_read on public.sync_runs;
create policy sync_runs_read on public.sync_runs for select using (public.is_internal());

-- Maaş şemaları (DIKIDI'deki gibi: tarihten itibaren geçerli, kişi başına birden çok)
create table if not exists public.staff_pay_schemes (
  id                       uuid primary key default gen_random_uuid(),
  staff_id                 uuid not null references public.staff(id) on delete cascade,
  valid_from               date not null,
  -- kendi satışları
  service_percent          numeric(5,2) not null default 0,
  product_percent          numeric(5,2) not null default 0,
  service_deduct_discount  boolean not null default false,  -- yüzde indirim düşülmüş tutardan
  product_deduct_discount  boolean not null default false,
  service_deduct_materials boolean not null default false,  -- malzeme maliyeti düşülür
  -- şirket satışları
  company_service_percent  numeric(5,2) not null default 0,
  company_product_percent  numeric(5,2) not null default 0,
  company_deduct_discount  boolean not null default true,
  company_exclude_own      boolean not null default false,  -- kendi satışları hariç
  company_only_on_shift    boolean not null default false,  -- sadece çalıştığı günler
  -- randevu primi (bu kişinin oluşturduğu randevulardan)
  booking_service_percent  numeric(5,2) not null default 0,
  booking_product_percent  numeric(5,2) not null default 0,
  booking_exclude_own      boolean not null default false,
  -- sabit
  daily_wage               numeric(10,2) not null default 0,  -- çalıştığı gün başına
  daily_guarantee          numeric(10,2) not null default 0,  -- günlük asgari hak ediş
  notes                    text not null default '',
  dikidi_id                text,
  created_at               timestamptz not null default now()
);
create unique index if not exists staff_pay_schemes_dikidi on public.staff_pay_schemes (dikidi_id);
create index if not exists staff_pay_schemes_staff on public.staff_pay_schemes (staff_id, valid_from desc);
alter table public.staff_pay_schemes enable row level security;
drop policy if exists sps_read on public.staff_pay_schemes;
create policy sps_read on public.staff_pay_schemes for select using (public.is_internal());
drop policy if exists sps_write on public.staff_pay_schemes;
create policy sps_write on public.staff_pay_schemes for all using (public.is_manager()) with check (public.is_manager());

-- Kasa hesapları: açılış bakiyesi + sayım düzeltmeleri; hareketler ödeme yönteminden hesaplanır
create table if not exists public.cash_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null check (kind in ('cash','bank')),
  opening_balance numeric(14,2) not null default 0,
  opening_date    date not null default current_date,
  sort_order      int not null default 100,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create unique index if not exists cash_accounts_kind on public.cash_accounts (kind) where is_active;
create table if not exists public.cash_adjustments (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.cash_accounts(id) on delete cascade,
  adj_date    date not null default current_date,
  amount      numeric(14,2) not null,           -- + kasaya giriş, − çıkış (patron çekişi, bankaya yatırma…)
  note        text not null default '',
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
alter table public.cash_accounts enable row level security;
alter table public.cash_adjustments enable row level security;
drop policy if exists ca_read on public.cash_accounts;
create policy ca_read on public.cash_accounts for select using (public.is_internal());
drop policy if exists ca_write on public.cash_accounts;
create policy ca_write on public.cash_accounts for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists cadj_read on public.cash_adjustments;
create policy cadj_read on public.cash_adjustments for select using (public.is_internal());
drop policy if exists cadj_write on public.cash_adjustments;
create policy cadj_write on public.cash_adjustments for all using (public.is_manager()) with check (public.is_manager());

insert into public.cash_accounts (name, kind, opening_balance, opening_date, sort_order)
select 'Kasa (nakit)', 'cash', 0, '2026-01-01', 1 where not exists (select 1 from public.cash_accounts where kind = 'cash');
insert into public.cash_accounts (name, kind, opening_balance, opening_date, sort_order)
select 'Banka / POS', 'bank', 0, '2026-01-01', 2 where not exists (select 1 from public.cash_accounts where kind = 'bank');
