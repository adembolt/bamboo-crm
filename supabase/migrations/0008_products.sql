-- Ürünler ve stok
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text not null default '',
  category    text not null default '',
  barcode     text not null default '',
  unit        text not null default 'adet',
  sale_price  numeric(12,2) not null default 0,
  cost_price  numeric(12,2) not null default 0,
  stock_qty   numeric(12,2) not null default 0,
  min_stock   numeric(12,2) not null default 0,
  is_retail   boolean not null default true,   -- müşteriye satılır (false = sadece salonda kullanım)
  is_active   boolean not null default true,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists products_name on public.products (lower(name));

create table if not exists public.stock_moves (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  kind        text not null check (kind in ('purchase','sale','use','adjust','return')),
  qty         numeric(12,2) not null,          -- + giriş / − çıkış
  unit_cost   numeric(12,2),
  note        text not null default '',
  sale_id     uuid references public.sales(id) on delete set null,
  staff_id    uuid references public.staff(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists stock_moves_product on public.stock_moves (product_id, created_at desc);
create index if not exists stock_moves_sale on public.stock_moves (sale_id);

alter table public.sale_items add column if not exists product_id uuid references public.products(id) on delete set null;

alter table public.products enable row level security;
alter table public.stock_moves enable row level security;
create policy products_read on public.products for select using (public.is_internal());
create policy products_write on public.products for all using (public.can_write_ops()) with check (public.can_write_ops());
create policy stock_moves_read on public.stock_moves for select using (public.is_internal());
create policy stock_moves_write on public.stock_moves for all using (public.can_write_ops()) with check (public.can_write_ops());
