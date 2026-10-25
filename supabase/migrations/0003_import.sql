-- DIKIDI geçmiş aktarımı için tek kullanımlık anahtar
alter table public.settings add column if not exists import_token text not null default '';
-- Aktarılan kayıtların izlenebilmesi için
alter table public.visits add column if not exists import_ref text;
create index if not exists visits_import_ref on public.visits (import_ref) where import_ref is not null;
