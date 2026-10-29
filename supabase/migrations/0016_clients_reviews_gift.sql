-- DIKIDI müşteri ayrıntıları, yorumlar, hediye kartı şablonları, sadakat/referans ayarları
alter table public.customers add column if not exists card_no text not null default '';
alter table public.customers add column if not exists dikidi_source text not null default '';

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  author_name text not null default '',
  staff_id    uuid references public.staff(id) on delete set null,
  rating      int not null default 5 check (rating between 1 and 5),
  body        text not null default '',
  reply       text not null default '',
  is_public   boolean not null default true,
  source      text not null default 'salon',   -- dikidi / google / salon / online
  dikidi_id   text unique,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_created on public.reviews (created_at desc);
alter table public.reviews enable row level security;
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (public.is_internal());
drop policy if exists reviews_write on public.reviews;
create policy reviews_write on public.reviews for all using (public.is_manager()) with check (public.is_manager());

create table if not exists public.gift_card_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  usage         text not null default 'both' check (usage in ('service','product','both')),
  amount        numeric(12,2) not null,
  open_amount   boolean not null default false,   -- "500 - sınırsız": en az amount
  valid_days    int not null default 90,
  bonus_percent numeric(5,2) not null default 0,  -- ör. 10000'e %15 ek
  sale_from     date,
  sale_to       date,
  sale_limit    int not null default 0,           -- 0 = sınırsız
  online        boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.gift_card_templates enable row level security;
drop policy if exists gct_read on public.gift_card_templates;
create policy gct_read on public.gift_card_templates for select using (public.is_internal());
drop policy if exists gct_write on public.gift_card_templates;
create policy gct_write on public.gift_card_templates for all using (public.is_manager()) with check (public.is_manager());
alter table public.gift_cards add column if not exists template_id uuid references public.gift_card_templates(id) on delete set null;

insert into public.gift_card_templates (name, usage, amount, open_amount, valid_days, bonus_percent, sale_from, sale_to, sale_limit, online, is_active) values
  ('VALENTINE''S LOVE CARD', 'service', 3000, false, 14, 20, '2026-02-01', '2026-02-13', 0, false, false),
  ('COSMO BEAUTY CARD',      'product', 10000, false, 90, 10, '2026-01-25', null, 20, true, true),
  ('GIFT CARD SMART BODY',   'service', 5000, false, 90, 10, '2026-01-25', null, 0, true, true),
  ('GIFT CARD BAMBOOSTER',   'service', 10000, false, 90, 15, '2026-01-25', null, 0, true, true),
  ('GIFT CARD BEAUTY TIME',  'both',    5000, false, 60, 5,  '2026-01-25', null, 0, true, true),
  ('GIFT CARD ANTISTRESS',   'service', 1500, false, 90, 0,  '2026-01-25', null, 0, true, true),
  ('GIFT CARD PODO&BEAUTY',  'service', 3000, true,  90, 0,  '2026-01-25', null, 0, true, true),
  ('GIFT CARD UNIVERSAL',    'both',    500,  true,  30, 0,  '2026-01-25', null, 0, true, true)
on conflict (name) do nothing;

-- Sadakat: puanla ödenebilecek en yüksek oran; referans programı
alter table public.settings add column if not exists loyalty_max_pay_percent numeric(5,2) not null default 100;
alter table public.settings add column if not exists referral_inviter_points int not null default 0;
alter table public.settings add column if not exists referral_invitee_discount numeric(5,2) not null default 0;
alter table public.customers add column if not exists referred_by uuid references public.customers(id) on delete set null;

-- DIKIDI'deki mevcut program: BEAUTY CASHBACK %2, en fazla %50 puanla; referans: davet edene 50 puan, davetliye %10
update public.settings set loyalty_earn_percent = 2, loyalty_point_value = 1, loyalty_max_pay_percent = 50,
  referral_inviter_points = 50, referral_invitee_discount = 10 where id = 1;
