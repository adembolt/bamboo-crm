-- Personel fotoğrafları (takvim başlığı, online randevu)
insert into storage.buckets (id, name, public) values ('staff-photos', 'staff-photos', true) on conflict (id) do update set public = true;
drop policy if exists "staff photos read" on storage.objects;
drop policy if exists "staff photos write" on storage.objects;
drop policy if exists "staff photos update" on storage.objects;
drop policy if exists "staff photos delete" on storage.objects;
create policy "staff photos read" on storage.objects for select using (bucket_id = 'staff-photos');
create policy "staff photos write" on storage.objects for insert with check (bucket_id = 'staff-photos' and public.is_manager());
create policy "staff photos update" on storage.objects for update using (bucket_id = 'staff-photos' and public.is_manager());
create policy "staff photos delete" on storage.objects for delete using (bucket_id = 'staff-photos' and public.is_manager());
