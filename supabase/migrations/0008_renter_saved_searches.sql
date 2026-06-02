-- Renter saved map searches

create table if not exists public.renter_saved_searches (
  id uuid primary key default gen_random_uuid(),
  renter_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  query text,
  city text,
  property_type text,
  min_price numeric(12,2) check (min_price is null or min_price >= 0),
  max_price numeric(12,2) check (max_price is null or max_price >= 0),
  map_bounds jsonb,
  created_at timestamptz not null default now(),
  constraint renter_saved_searches_price_range_check
    check (min_price is null or max_price is null or min_price <= max_price)
);

create index if not exists renter_saved_searches_renter_id_idx
  on public.renter_saved_searches(renter_id);

create unique index if not exists renter_saved_searches_renter_name_idx
  on public.renter_saved_searches(renter_id, lower(name));

create unique index if not exists renter_saved_searches_one_empty_per_renter_idx
  on public.renter_saved_searches(renter_id)
  where query is null
    and city is null
    and property_type is null
    and min_price is null
    and max_price is null
    and map_bounds is null;

alter table public.renter_saved_searches enable row level security;

create policy renter_saved_searches_select_owner
on public.renter_saved_searches
for select
using (renter_id = auth.uid());

create policy renter_saved_searches_insert_owner
on public.renter_saved_searches
for insert
with check (
  renter_id = auth.uid()
  and public.current_user_role() = 'renter'
);

create policy renter_saved_searches_update_owner
on public.renter_saved_searches
for update
using (renter_id = auth.uid())
with check (
  renter_id = auth.uid()
  and public.current_user_role() = 'renter'
);

create policy renter_saved_searches_delete_owner
on public.renter_saved_searches
for delete
using (renter_id = auth.uid());
