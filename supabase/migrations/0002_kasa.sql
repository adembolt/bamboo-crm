-- 0002_kasa: giderler, satış kalemleri, ödeme/hak ediş alanları
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category     text not null default 'genel',   -- malzeme, kira, fatura, maaş, avans, pazarlama, diğer
  description  text not null default '',
  amount       numeric(12,2) not null check (amount > 0),
  method       public.pay_method not null default 'cash',
  staff_id     uuid references public.staff(id) on delete set null, -- avans/prim ödemesi ise
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index on public.expenses (expense_date);
alter table public.expenses enable row level security;
create policy expenses_read on public.expenses for select using (public.is_internal());
create policy expenses_write on public.expenses for all using (public.can_write_ops()) with check (public.can_write_ops());

-- Satış kalemleri (hizmet kalemi veya ürün); hak ediş için personel ve tutar burada sabitlenir
create table public.sale_items (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete cascade,
  visit_item_id uuid references public.visit_items(id) on delete set null,
  kind          text not null default 'service' check (kind in ('service','product')),
  name          text not null,
  staff_id      uuid references public.staff(id) on delete set null,
  qty           numeric(10,2) not null default 1,
  unit_price    numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0
);
create index on public.sale_items (sale_id);
create index on public.sale_items (staff_id);
alter table public.sale_items enable row level security;
create policy sale_items_read on public.sale_items for select using (public.is_internal());
create policy sale_items_write on public.sale_items for all using (public.can_write_ops()) with check (public.can_write_ops());

-- Bir ziyaret bir kez kapatılır
create unique index sales_one_per_visit on public.sales (visit_id) where visit_id is not null;

-- Personel hak ediş ödemeleri (günlük prim veya ay sonu)
create table public.staff_payouts (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  amount      numeric(12,2) not null,
  method      public.pay_method not null default 'cash',
  notes       text not null default '',
  paid_at     date not null default current_date,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index on public.staff_payouts (staff_id, period_start);
alter table public.staff_payouts enable row level security;
create policy staff_payouts_read on public.staff_payouts for select using (public.is_internal());
create policy staff_payouts_write on public.staff_payouts for all using (public.is_manager()) with check (public.is_manager());
