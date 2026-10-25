alter table public.sale_items drop constraint if exists sale_items_kind_check;
alter table public.sale_items add constraint sale_items_kind_check check (kind in ('service','product','package','gift_card','balance'));
create table if not exists public.balance_ledger (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount      numeric(12,2) not null,      -- + yükleme, − kullanım
  reason      text not null default '',
  sale_id     uuid references public.sales(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists balance_ledger_customer on public.balance_ledger (customer_id, created_at desc);
alter table public.balance_ledger enable row level security;
create policy balance_ledger_read on public.balance_ledger for select using (public.is_internal());
create policy balance_ledger_write on public.balance_ledger for all using (public.can_write_ops()) with check (public.can_write_ops());
