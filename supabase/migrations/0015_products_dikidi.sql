-- DIKIDI ürün/depo/tedarikçi aktarımı için alanlar
alter table public.products add column if not exists dikidi_id text;
alter table public.products add column if not exists use_price numeric(12,2) not null default 0;       -- sarf (malzeme) birim fiyatı
alter table public.products add column if not exists material_qty numeric(12,2) not null default 0;    -- malzeme stoğu (g/ml…)
alter table public.products add column if not exists material_unit text not null default '';
alter table public.products add column if not exists last_purchase_at date;
create unique index if not exists products_dikidi_id on public.products (dikidi_id) where dikidi_id is not null;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  notes text not null default '',
  dikidi_name text,
  created_at timestamptz not null default now()
);
create unique index if not exists suppliers_dikidi on public.suppliers (dikidi_name) where dikidi_name is not null;
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  responsible_staff_id uuid references public.staff(id) on delete set null,
  is_active boolean not null default true,
  dikidi_name text,
  created_at timestamptz not null default now()
);
create unique index if not exists warehouses_dikidi on public.warehouses (dikidi_name) where dikidi_name is not null;
alter table public.suppliers enable row level security;
alter table public.warehouses enable row level security;
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select using (public.is_internal());
drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists warehouses_read on public.warehouses;
create policy warehouses_read on public.warehouses for select using (public.is_internal());
drop policy if exists warehouses_write on public.warehouses;
create policy warehouses_write on public.warehouses for all using (public.is_manager()) with check (public.is_manager());
