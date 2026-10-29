-- Müşteri listesi: ziyaret/harcama özetleri, filtre ve sıralama için tek görünüm
create or replace view public.customer_list with (security_invoker = on) as
select c.id, c.first_name, c.last_name, c.phone, c.tags, c.locale, c.no_show_count, c.is_blocked,
  c.balance, c.loyalty_points, c.birth_date, c.created_at, c.consent_marketing, c.source,
  (select max(v.visit_date) from public.visits v where v.customer_id = c.id and v.status in ('completed','arrived')) as last_visit,
  (select min(v.visit_date) from public.visits v where v.customer_id = c.id and v.visit_date >= current_date and v.status in ('pending','confirmed')) as next_visit,
  (select count(*) from public.visits v where v.customer_id = c.id and v.status in ('completed','arrived'))::int as visits,
  (select coalesce(sum(i.price - i.discount), 0) from public.visits v join public.visit_items i on i.visit_id = v.id
     where v.customer_id = c.id and v.status in ('completed','arrived') and i.status <> 'cancelled')::numeric(12,2) as spent,
  (select count(*) from public.customer_packages p where p.customer_id = c.id and p.is_active and p.used_sessions < p.total_sessions)::int as packages,
  case when c.birth_date is null then null
       when (c.birth_date + make_interval(years => date_part('year', age(current_date, c.birth_date))::int))::date = current_date then 0
       else ((c.birth_date + make_interval(years => date_part('year', age(current_date, c.birth_date))::int + 1))::date - current_date) end as bday_in
from public.customers c;

grant select on public.customer_list to authenticated;
create index if not exists visit_items_visit_status on public.visit_items (visit_id, status);
