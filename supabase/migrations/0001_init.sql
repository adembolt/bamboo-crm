-- Bamboo Beauty Lifes — CRM & Randevu
-- 0001_init: çekirdek veri modeli
-- Güzellik salonu (beauty & wellness). Masaj ve bazı SPA hizmetleri kategoriler olarak bu çatı altındadır.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------
-- Kullanıcı profilleri ve roller (Supabase auth.users ile 1-1)
-- ---------------------------------------------------------------
create type public.app_role as enum ('owner', 'manager', 'reception', 'staff');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        public.app_role not null default 'staff',
  staff_id    uuid,                       -- personel kaydına bağ (aşağıda FK eklenir)
  locale      text not null default 'tr', -- tr | en | ru
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Giriş yapan kullanıcının rolü
create or replace function public.current_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','manager') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_internal() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.profiles where id = auth.uid())
$$;

-- Yeni auth kullanıcısı -> profil
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    -- ilk kullanıcı sahiptir
    case when (select count(*) from public.profiles) = 0 then 'owner'::public.app_role else 'staff'::public.app_role end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- İşletme ayarları (tek satır)
-- ---------------------------------------------------------------
create table public.settings (
  id               int primary key default 1 check (id = 1),
  business_name    text not null default 'Bamboo Beauty Lifes',
  tagline          text not null default 'Beauty & Wellness · Marmaris',
  currency         text not null default 'TRY',
  timezone         text not null default 'Europe/Istanbul',
  slot_minutes     int  not null default 15,
  open_time        time not null default '10:00',
  close_time       time not null default '21:00',
  open_days        int[] not null default '{1,2,3,4,5,6,7}', -- 1=Pzt … 7=Paz
  online_booking_enabled boolean not null default true,
  online_requires_approval boolean not null default true,
  online_min_notice_minutes int not null default 120,
  online_max_days_ahead int not null default 60,
  online_cancel_limit_minutes int not null default 240,
  kdv_rate         numeric(5,4) not null default 0.20,
  whatsapp_number  text not null default '',
  instagram_url    text not null default '',
  google_review_url text not null default '',
  updated_at       timestamptz not null default now()
);
insert into public.settings (id) values (1);
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Hizmet kategorileri ve hizmetler
-- ---------------------------------------------------------------
create table public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,                 -- DIKIDI kod öneki (00, 10, 20, 50 …) veya kısa anahtar
  name_tr     text not null,
  name_en     text not null default '',
  name_ru     text not null default '',
  sort_order  int  not null default 100,
  color       text not null default '#0A7A1E',
  online_visible boolean not null default false, -- kategori online randevuda görünür mü
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_service_categories_updated before update on public.service_categories
  for each row execute function public.set_updated_at();

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references public.service_categories(id) on delete set null,
  code          text,                           -- DIKIDI kodu (ör. 5138)
  name_tr       text not null,
  name_en       text not null default '',
  name_ru       text not null default '',
  description_tr text not null default '',
  description_en text not null default '',
  description_ru text not null default '',
  duration_min  int  not null default 60 check (duration_min > 0),
  buffer_min    int  not null default 0  check (buffer_min >= 0),  -- hazırlık/temizlik
  price         numeric(12,2) not null default 0,
  price_min     numeric(12,2),                  -- "…'den başlayan" için
  session_count int  not null default 1 check (session_count >= 1), -- kür/paket: kaç seans
  kind          text not null default 'service' check (kind in ('service','package','consultation','product_like')),
  online_visible boolean not null default false, -- *** online randevu sayfasında görünür mü (manuel seçim)
  is_active     boolean not null default true,
  requires_consultation boolean not null default false,
  sort_order    int not null default 100,
  dikidi_id     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.services (category_id);
create index on public.services (online_visible) where online_visible;
create index on public.services (is_active);
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Personel ve kaynaklar (kabin / oda / cihaz)
-- ---------------------------------------------------------------
create table public.staff (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  title         text not null default '',         -- Kozmetolog, Masöz, Lazer uzmanı …
  phone         text not null default '',
  color         text not null default '#5E9E6C',
  photo_url     text,
  languages     text[] not null default '{tr}',
  online_bookable boolean not null default true,  -- online randevuda seçilebilir mi
  pay_model     text not null default 'percent' check (pay_model in ('daily_prim','percent','fixed')),
  pay_percent   numeric(5,2) not null default 0,  -- hizmet cirosundan yüzde
  product_percent numeric(5,2) not null default 0,
  is_active     boolean not null default true,
  sort_order    int not null default 100,
  dikidi_id     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_staff_updated before update on public.staff
  for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_staff_fk foreign key (staff_id) references public.staff(id) on delete set null;

-- Hangi personel hangi hizmeti verebilir
create table public.staff_services (
  staff_id    uuid references public.staff(id) on delete cascade,
  service_id  uuid references public.services(id) on delete cascade,
  price_override numeric(12,2),
  duration_override int,
  primary key (staff_id, service_id)
);

-- Haftalık çalışma şablonu
create table public.staff_schedules (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,
  weekday     int  not null check (weekday between 1 and 7),
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index on public.staff_schedules (staff_id, weekday);

-- Tek günlük istisnalar: izin, özel saat
create table public.staff_time_off (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text not null default '',
  check (ends_at > starts_at)
);
create index on public.staff_time_off (staff_id, starts_at);

create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- Kozmetoloji kabini 1, Lazer cihazı, Masaj odası
  kind        text not null default 'room' check (kind in ('room','device','other')),
  capacity    int  not null default 1,
  is_active   boolean not null default true,
  sort_order  int not null default 100
);

create table public.service_resources (
  service_id  uuid references public.services(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  primary key (service_id, resource_id)
);

-- ---------------------------------------------------------------
-- Müşteriler
-- ---------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null,
  last_name     text not null default '',
  phone         text not null default '',   -- E.164: +905xxxxxxxxx
  email         text not null default '',
  gender        text not null default '' check (gender in ('', 'f', 'm', 'x')),
  birth_date    date,
  locale        text not null default 'tr',  -- iletişim dili tr/en/ru/de
  nationality   text not null default '',
  source        text not null default '',    -- instagram, google, otel, tavsiye, walk-in, dikidi
  tags          text[] not null default '{}',
  notes         text not null default '',    -- dahili not
  health_notes  text not null default '',    -- alerji / hassasiyet / kontrendikasyon (hassas)
  consent_marketing boolean not null default false,
  consent_at    timestamptz,
  is_blocked    boolean not null default false,
  no_show_count int not null default 0,
  discount_percent numeric(5,2) not null default 0,
  balance       numeric(12,2) not null default 0, -- + alacak (ön ödeme), - borç
  dikidi_id     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.customers (phone);
create index on public.customers (lower(last_name), lower(first_name));
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

create table public.customer_photos (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  storage_path text not null,
  caption      text not null default '',
  taken_at     date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Ziyaret (visit) = bir müşterinin bir gündeki tüm hizmetleri.
-- Kalemler (visit_items) farklı personellere ve saatlere dağılır;
-- takvimde her kalem kendi personel sütununda görünür, herhangi bir
-- kaleme tıklanınca ziyaretin tamamı (tüm kalemler + toplam) açılır.
-- ---------------------------------------------------------------
create type public.visit_status as enum ('pending','confirmed','arrived','completed','no_show','cancelled');
create type public.visit_source as enum ('salon','phone','whatsapp','online','instagram','dikidi','walk_in');

create table public.visits (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.customers(id) on delete set null,
  visit_date    date not null,
  status        public.visit_status not null default 'confirmed',
  source        public.visit_source not null default 'salon',
  notes         text not null default '',
  internal_notes text not null default '',
  discount_percent numeric(5,2) not null default 0,
  prepaid_amount numeric(12,2) not null default 0,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.visits (visit_date);
create index on public.visits (customer_id, visit_date desc);
create trigger trg_visits_updated before update on public.visits
  for each row execute function public.set_updated_at();

create table public.visit_items (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references public.visits(id) on delete cascade,
  service_id    uuid references public.services(id) on delete set null,
  service_name  text not null,                 -- o anki ad (geçmiş bozulmasın)
  staff_id      uuid references public.staff(id) on delete set null,
  resource_id   uuid references public.resources(id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  price         numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  status        public.visit_status not null default 'confirmed',
  package_id    uuid,                          -- seans paketi düşümü (aşağıda FK)
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at),
  -- aynı personel aynı anda iki aktif kalemde olamaz
  constraint visit_items_no_staff_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (staff_id is not null and status not in ('cancelled','no_show'))
);
create index on public.visit_items (starts_at);
create index on public.visit_items (staff_id, starts_at);
create index on public.visit_items (visit_id);
create trigger trg_visit_items_updated before update on public.visit_items
  for each row execute function public.set_updated_at();

-- Ziyaret toplamı (görünüm)
create or replace view public.visit_totals as
select
  v.id as visit_id,
  v.customer_id,
  v.visit_date,
  count(i.id) filter (where i.status not in ('cancelled')) as item_count,
  coalesce(sum(i.price - i.discount) filter (where i.status not in ('cancelled')), 0) as subtotal,
  round(coalesce(sum(i.price - i.discount) filter (where i.status not in ('cancelled')), 0) * (1 - v.discount_percent/100), 2) as total
from public.visits v
left join public.visit_items i on i.visit_id = v.id
group by v.id;

-- Aynı müşteri + aynı gün için tek ziyaret (uygulama katmanı da buna uyar)
create unique index visits_one_per_customer_day on public.visits (customer_id, visit_date)
  where customer_id is not null and status not in ('cancelled');

-- ---------------------------------------------------------------
-- Seans paketleri / kürler (lazer 6 seans, Kuma Shape 16 seans …)
-- ---------------------------------------------------------------
create table public.customer_packages (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id) on delete cascade,
  service_id     uuid references public.services(id) on delete set null,
  name           text not null,
  total_sessions int  not null check (total_sessions > 0),
  used_sessions  int  not null default 0 check (used_sessions >= 0),
  price_paid     numeric(12,2) not null default 0,
  purchased_at   date not null default current_date,
  expires_at     date,
  notes          text not null default '',
  created_at     timestamptz not null default now()
);
create index on public.customer_packages (customer_id);
alter table public.visit_items
  add constraint visit_items_package_fk foreign key (package_id) references public.customer_packages(id) on delete set null;

-- Cihaz seans kaydı (parametreler, bölge, geri bildirim)
create table public.treatment_logs (
  id            uuid primary key default gen_random_uuid(),
  visit_item_id uuid references public.visit_items(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  device        text not null default '',     -- Kuma Shape II, HIFU, Lazer …
  area          text not null default '',
  params        jsonb not null default '{}',
  session_no    int,
  feedback      text not null default '',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Satış / ödeme (ziyaret kapanışı) — Salon Kasası ile birleşecek
-- ---------------------------------------------------------------
create type public.pay_method as enum ('cash','card','transfer','online','package','gift_card','other');

create table public.sales (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid references public.visits(id) on delete set null,
  customer_id  uuid references public.customers(id) on delete set null,
  sale_date    date not null default current_date,
  subtotal     numeric(12,2) not null default 0,
  discount     numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  notes        text not null default '',
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create table public.sale_payments (
  id        uuid primary key default gen_random_uuid(),
  sale_id   uuid not null references public.sales(id) on delete cascade,
  method    public.pay_method not null,
  amount    numeric(12,2) not null check (amount > 0)
);

-- Online randevu talepleri (giriş yapmamış müşteriler) — onay bekleyen kuyruk
create table public.booking_requests (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null,
  last_name     text not null default '',
  phone         text not null,
  email         text not null default '',
  locale        text not null default 'tr',
  service_id    uuid not null references public.services(id),
  staff_id      uuid references public.staff(id),
  starts_at     timestamptz not null,
  notes         text not null default '',
  status        text not null default 'new' check (status in ('new','approved','rejected','expired')),
  visit_id      uuid references public.visits(id) on delete set null,
  ip_hash       text not null default '',
  created_at    timestamptz not null default now()
);
create index on public.booking_requests (status, created_at desc);

-- Denetim kaydı
create table public.audit_log (
  id         bigserial primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  diff       jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.settings           enable row level security;
alter table public.service_categories enable row level security;
alter table public.services           enable row level security;
alter table public.staff              enable row level security;
alter table public.staff_services     enable row level security;
alter table public.staff_schedules    enable row level security;
alter table public.staff_time_off     enable row level security;
alter table public.resources          enable row level security;
alter table public.service_resources  enable row level security;
alter table public.customers          enable row level security;
alter table public.customer_photos    enable row level security;
alter table public.visits             enable row level security;
alter table public.visit_items        enable row level security;
alter table public.customer_packages  enable row level security;
alter table public.treatment_logs     enable row level security;
alter table public.sales              enable row level security;
alter table public.sale_payments      enable row level security;
alter table public.booking_requests   enable row level security;
alter table public.audit_log          enable row level security;

-- Profiller: herkes kendi profilini görür; yöneticiler tümünü
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_manager());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_manager_all on public.profiles for all using (public.is_manager()) with check (public.is_manager());

-- Herkese açık okuma (online randevu sayfası): ayarlar, aktif+online hizmetler/kategoriler, online personel
create policy settings_public_read on public.settings for select using (true);
create policy settings_manager_write on public.settings for update using (public.is_manager()) with check (public.is_manager());

create policy categories_public_read on public.service_categories for select
  using (public.is_internal() or (is_active and online_visible));
create policy categories_manager_write on public.service_categories for all using (public.is_manager()) with check (public.is_manager());

create policy services_public_read on public.services for select
  using (public.is_internal() or (is_active and online_visible));
create policy services_manager_write on public.services for all using (public.is_manager()) with check (public.is_manager());

create policy staff_public_read on public.staff for select
  using (public.is_internal() or (is_active and online_bookable));
create policy staff_manager_write on public.staff for all using (public.is_manager()) with check (public.is_manager());

create policy staff_services_read on public.staff_services for select using (true);
create policy staff_services_write on public.staff_services for all using (public.is_manager()) with check (public.is_manager());
create policy staff_schedules_read on public.staff_schedules for select using (true);
create policy staff_schedules_write on public.staff_schedules for all using (public.is_manager()) with check (public.is_manager());
create policy staff_time_off_read on public.staff_time_off for select using (public.is_internal());
create policy staff_time_off_write on public.staff_time_off for all using (public.is_manager()) with check (public.is_manager());
create policy resources_read on public.resources for select using (public.is_internal());
create policy resources_write on public.resources for all using (public.is_manager()) with check (public.is_manager());
create policy service_resources_read on public.service_resources for select using (public.is_internal());
create policy service_resources_write on public.service_resources for all using (public.is_manager()) with check (public.is_manager());

-- İç veriler: tüm iç kullanıcılar okur; yazma yönetici + resepsiyon
create or replace function public.can_write_ops() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','manager','reception') from public.profiles where id = auth.uid()), false)
$$;

create policy customers_read on public.customers for select using (public.is_internal());
create policy customers_write on public.customers for all using (public.can_write_ops()) with check (public.can_write_ops());
create policy customer_photos_read on public.customer_photos for select using (public.is_internal());
create policy customer_photos_write on public.customer_photos for all using (public.can_write_ops()) with check (public.can_write_ops());

create policy visits_read on public.visits for select using (public.is_internal());
create policy visits_write on public.visits for all using (public.can_write_ops()) with check (public.can_write_ops());
create policy visit_items_read on public.visit_items for select using (public.is_internal());
create policy visit_items_write on public.visit_items for all using (public.can_write_ops()) with check (public.can_write_ops());

create policy packages_read on public.customer_packages for select using (public.is_internal());
create policy packages_write on public.customer_packages for all using (public.can_write_ops()) with check (public.can_write_ops());
create policy treatment_logs_read on public.treatment_logs for select using (public.is_internal());
create policy treatment_logs_write on public.treatment_logs for all using (public.is_internal()) with check (public.is_internal());

create policy sales_read on public.sales for select using (public.is_internal());
create policy sales_write on public.sales for all using (public.can_write_ops()) with check (public.can_write_ops());
create policy sale_payments_read on public.sale_payments for select using (public.is_internal());
create policy sale_payments_write on public.sale_payments for all using (public.can_write_ops()) with check (public.can_write_ops());

-- Online talepler: anonim ekleyebilir (service role / route handler üzerinden de olur), iç kullanıcılar yönetir
create policy booking_requests_insert_public on public.booking_requests for insert with check (true);
create policy booking_requests_internal on public.booking_requests for all using (public.is_internal()) with check (public.can_write_ops());

create policy audit_read on public.audit_log for select using (public.is_manager());
create policy audit_insert on public.audit_log for insert with check (public.is_internal());

-- Görünüm için güvenlik: view RLS'i alttaki tablolardan alır (security_invoker)
alter view public.visit_totals set (security_invoker = on);

-- ---------------------------------------------------------------
-- Depolama: müşteri fotoğrafları (özel)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('customer-photos', 'customer-photos', false)
on conflict (id) do nothing;
create policy "photos internal read" on storage.objects for select using (bucket_id = 'customer-photos' and public.is_internal());
create policy "photos ops write" on storage.objects for insert with check (bucket_id = 'customer-photos' and public.can_write_ops());
create policy "photos ops delete" on storage.objects for delete using (bucket_id = 'customer-photos' and public.can_write_ops());
