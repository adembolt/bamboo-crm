-- 0013 · WhatsApp köprüsü (salondaki Mac'te çalışan Baileys programı ↔ CRM)
--
-- Güvenlik tasarımı (en basit güvenli çözüm):
--   * Mac tarafı veritabanına HİÇ bağlanmaz. Sadece /api/wa/bridge route handler'ına HTTPS ile
--     "Authorization: Bearer <kurulum kodu>" gönderir. Route handler service-role (createAdminClient)
--     kullanır ve kodu SHA-256(kod) = wa_bridge.token_hash ile sabit-zamanlı karşılaştırır.
--   * Düz kod hiçbir yerde saklanmaz; sadece SHA-256 hex'i tutulur.
--   * Panel (yönetici) tabloyu kendi oturum istemcisiyle okur/yazar (RLS + is_manager()), AMA
--     tablo düzeyindeki yetkiler anon/authenticated'dan tamamen geri alınır ve authenticated'a sadece
--     gizli olmayan SÜTUNLAR için SELECT verilir. Böylece token_hash tarayıcıdan/PostgREST'ten
--     okunamaz (select=* veya select=token_hash → "permission denied"). Yazma da sadece
--     command / token_hash / token_created_at sütunlarına izinli (token_hash yazılabilir ama okunamaz).
--   * send_enabled (ileride mesaj gönderimi) için authenticated'a UPDATE yetkisi YOK: sadece
--     veritabanından elle (service role / SQL) açılabilir. Bu sürümde köprü zaten hiç mesaj göndermez.
--   * QR kodu da hassastır (taranırsa hesap bağlanır) → sadece yöneticiler okuyabilir (RLS).

create table if not exists public.wa_bridge (
  id               int primary key default 1 check (id = 1),
  token_hash       text,
  token_created_at timestamptz,
  state            text not null default 'offline',
  qr               text,
  phone            text,
  push_name        text,
  version          text,
  host             text,
  error            text,
  last_seen        timestamptz,
  command          text check (command is null or command in ('logout', 'restart')),
  send_enabled     boolean not null default false,
  updated_at       timestamptz default now()
);
insert into public.wa_bridge (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_wa_bridge_updated on public.wa_bridge;
create trigger trg_wa_bridge_updated before update on public.wa_bridge
  for each row execute function public.set_updated_at();

alter table public.wa_bridge enable row level security;

revoke all on table public.wa_bridge from anon, authenticated;
grant select (id, token_created_at, state, qr, phone, push_name, version, host, error, last_seen, command, send_enabled, updated_at)
  on public.wa_bridge to authenticated;
grant update (command, token_hash, token_created_at) on public.wa_bridge to authenticated;

drop policy if exists wa_bridge_manager_read on public.wa_bridge;
create policy wa_bridge_manager_read on public.wa_bridge for select using (public.is_manager());
drop policy if exists wa_bridge_manager_update on public.wa_bridge;
create policy wa_bridge_manager_update on public.wa_bridge for update using (public.is_manager()) with check (public.is_manager());

-- İleride: otomatik bildirim kuyruğu. Bu sürümde hiçbir şey yazmaz/okumaz/göndermez.
create table if not exists public.wa_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_phone    text not null,
  body        text not null,
  kind        text,
  visit_id    uuid references public.visits(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  status      text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  created_by  uuid references auth.users(id)
);
create index if not exists wa_outbox_status_created on public.wa_outbox (status, created_at);

alter table public.wa_outbox enable row level security;
revoke all on table public.wa_outbox from anon;
drop policy if exists wa_outbox_manager_read on public.wa_outbox;
create policy wa_outbox_manager_read on public.wa_outbox for select using (public.is_manager());
-- insert/update politikası yok: gönderim özelliği gelene kadar sadece service role yazabilir.
