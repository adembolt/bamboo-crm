-- Seans paketleri satışı, hediye çeki, sadakat puanı
-- NOT: enum değeri ekleme ayrı bir komut olarak çalıştırılmalı (transaction dışı)
alter type public.pay_method add value if not exists 'points';

alter table public.sale_items drop constraint if exists sale_items_kind_check;
alter table public.sale_items add constraint sale_items_kind_check check (kind in ('service','product','package','gift_card'));

alter table public.sale_payments add column if not exists ref text not null default '';   -- hediye çeki kodu vb.

alter table public.customer_packages add column if not exists sale_id uuid references public.sales(id) on delete set null;
alter table public.customer_packages add column if not exists is_active boolean not null default true;

create table if not exists public.gift_cards (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  initial_amount numeric(12,2) not null check (initial_amount > 0),
  balance        numeric(12,2) not null check (balance >= 0),
  buyer_name     text not null default '',
  customer_id    uuid references public.customers(id) on delete set null,
  sale_id        uuid references public.sales(id) on delete set null,
  expires_at     date,
  notes          text not null default '',
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create table if not exists public.gift_card_uses (
  id           uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  sale_id      uuid references public.sales(id) on delete set null,
  amount       numeric(12,2) not null,
  created_at   timestamptz not null default now()
);

alter table public.customers add column if not exists loyalty_points int not null default 0;
create table if not exists public.loyalty_ledger (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  points      int not null,              -- + kazanım, − kullanım
  reason      text not null default '',
  sale_id     uuid references public.sales(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists loyalty_ledger_customer on public.loyalty_ledger (customer_id, created_at desc);

alter table public.settings add column if not exists loyalty_earn_percent numeric(5,2) not null default 0;  -- 0 = kapalı; ör. 5 → her 100 ₺'ye 5 puan
alter table public.settings add column if not exists loyalty_point_value numeric(8,2) not null default 1;   -- 1 puan = kaç ₺
alter table public.settings add column if not exists package_default_months int not null default 6;

alter table public.gift_cards enable row level security;
alter table public.gift_card_uses enable row level security;
alter table public.loyalty_ledger enable row level security;
create policy gift_cards_read on public.gift_cards for select using (public.is_internal());
create policy gift_cards_write on public.gift_cards for all using (public.can_write_ops()) with check (public.can_write_ops());
create policy gift_card_uses_read on public.gift_card_uses for select using (public.is_internal());
create policy gift_card_uses_write on public.gift_card_uses for all using (public.can_write_ops()) with check (public.can_write_ops());
create policy loyalty_ledger_read on public.loyalty_ledger for select using (public.is_internal());
create policy loyalty_ledger_write on public.loyalty_ledger for all using (public.can_write_ops()) with check (public.can_write_ops());
