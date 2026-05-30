-- Phase 2: Initial schema for rental platform
-- Safe defaults and strict RLS policies

create extension if not exists "pgcrypto";

-- Enums
create type public.role_enum as enum ('renter', 'landlord', 'admin');
create type public.property_status_enum as enum ('pending', 'approved', 'rejected', 'rented', 'unavailable');
create type public.verification_status_enum as enum ('unverified', 'pending', 'verified', 'rejected');

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.role_enum not null default 'renter',
  full_name text,
  avatar_url text,
  phone text,
  bio text,
  verification_status public.verification_status_enum not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  property_type text,
  price numeric(12,2) not null check (price >= 0),
  deposit numeric(12,2) not null default 0 check (deposit >= 0),
  advance numeric(12,2) not null default 0 check (advance >= 0),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  area_sqm numeric(10,2) not null default 0 check (area_sqm >= 0),
  address_line text,
  city text,
  state text,
  country text,
  lat double precision,
  lng double precision,
  status public.property_status_enum not null default 'pending',
  available_from date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_images_property_storage_unique unique (property_id, storage_path)
);

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_amenities (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_amenities_unique unique (property_id, amenity_id)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  renter_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorites_unique unique (renter_id, property_id)
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  status public.verification_status_enum not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  renter_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  score numeric(8,3) not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper functions for RLS
create or replace function public.current_user_role()
returns public.role_enum
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Protect role and verification_status fields on profiles
create or replace function public.prevent_profile_admin_field_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role <> old.role then
    raise exception 'Only admins can change role';
  end if;

  if new.verification_status <> old.verification_status then
    raise exception 'Only admins can change verification status';
  end if;

  return new;
end;
$$;

-- Ensure landlord_id always matches the property owner to prevent spoofing
create or replace function public.set_inquiry_landlord_id()
returns trigger
language plpgsql
as $$
begin
  select p.landlord_id into new.landlord_id
  from public.properties p
  where p.id = new.property_id;

  if new.landlord_id is null then
    raise exception 'Invalid property_id for inquiry';
  end if;

  return new;
end;
$$;

-- Ensure landlord_id always matches the property owner to prevent spoofing
create or replace function public.set_review_landlord_id()
returns trigger
language plpgsql
as $$
begin
  select p.landlord_id into new.landlord_id
  from public.properties p
  where p.id = new.property_id;

  if new.landlord_id is null then
    raise exception 'Invalid property_id for review';
  end if;

  return new;
end;
$$;

-- Indexes
create index properties_landlord_id_idx on public.properties(landlord_id);
create index properties_status_idx on public.properties(status);
create index properties_city_idx on public.properties(city);
create index properties_price_idx on public.properties(price);
create index properties_lat_lng_idx on public.properties(lat, lng);

create index property_images_property_id_idx on public.property_images(property_id);

create index property_amenities_property_id_idx on public.property_amenities(property_id);
create index property_amenities_amenity_id_idx on public.property_amenities(amenity_id);

create index favorites_renter_property_idx on public.favorites(renter_id, property_id);

create index inquiries_renter_id_idx on public.inquiries(renter_id);
create index inquiries_landlord_id_idx on public.inquiries(landlord_id);
create index inquiries_property_id_idx on public.inquiries(property_id);

create index reviews_property_id_idx on public.reviews(property_id);
create index reviews_landlord_id_idx on public.reviews(landlord_id);

create index recommendation_logs_renter_id_idx on public.recommendation_logs(renter_id);

-- updated_at triggers
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create trigger property_images_set_updated_at
before update on public.property_images
for each row execute function public.set_updated_at();

create trigger amenities_set_updated_at
before update on public.amenities
for each row execute function public.set_updated_at();

create trigger property_amenities_set_updated_at
before update on public.property_amenities
for each row execute function public.set_updated_at();

create trigger favorites_set_updated_at
before update on public.favorites
for each row execute function public.set_updated_at();

create trigger inquiries_set_updated_at
before update on public.inquiries
for each row execute function public.set_updated_at();

create trigger inquiries_set_landlord_id
before insert or update on public.inquiries
for each row execute function public.set_inquiry_landlord_id();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create trigger reviews_set_landlord_id
before insert or update on public.reviews
for each row execute function public.set_review_landlord_id();

create trigger verification_requests_set_updated_at
before update on public.verification_requests
for each row execute function public.set_updated_at();

create trigger recommendation_logs_set_updated_at
before update on public.recommendation_logs
for each row execute function public.set_updated_at();

create trigger profiles_prevent_admin_field_update
before update on public.profiles
for each row execute function public.prevent_profile_admin_field_update();

-- RLS
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.amenities enable row level security;
alter table public.property_amenities enable row level security;
alter table public.favorites enable row level security;
alter table public.inquiries enable row level security;
alter table public.reviews enable row level security;
alter table public.verification_requests enable row level security;
alter table public.recommendation_logs enable row level security;

-- Profiles policies
create policy profiles_select_self_or_admin
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

create policy profiles_insert_self_or_admin
on public.profiles
for insert
with check (id = auth.uid() or public.is_admin());

create policy profiles_update_self_or_admin
on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin
on public.profiles
for delete
using (public.is_admin());

-- Properties policies
create policy properties_select_approved_or_owner_or_admin
on public.properties
for select
using (status = 'approved' or landlord_id = auth.uid() or public.is_admin());

create policy properties_insert_owner_or_admin
on public.properties
for insert
with check (landlord_id = auth.uid() or public.is_admin());

create policy properties_update_owner_or_admin
on public.properties
for update
using (landlord_id = auth.uid() or public.is_admin())
with check (landlord_id = auth.uid() or public.is_admin());

create policy properties_delete_owner_or_admin
on public.properties
for delete
using (landlord_id = auth.uid() or public.is_admin());

-- Property images policies
create policy property_images_select_for_approved_or_owner_or_admin
on public.property_images
for select
using (
  exists (
    select 1 from public.properties p
    where p.id = property_images.property_id
      and (p.status = 'approved' or p.landlord_id = auth.uid() or public.is_admin())
  )
);

create policy property_images_insert_owner_or_admin
on public.property_images
for insert
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_images.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
);

create policy property_images_update_owner_or_admin
on public.property_images
for update
using (
  exists (
    select 1 from public.properties p
    where p.id = property_images.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_images.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
);

create policy property_images_delete_owner_or_admin
on public.property_images
for delete
using (
  exists (
    select 1 from public.properties p
    where p.id = property_images.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
);

-- Amenities policies
create policy amenities_select_all
on public.amenities
for select
using (true);

create policy amenities_admin_write
on public.amenities
for insert
with check (public.is_admin());

create policy amenities_admin_update
on public.amenities
for update
using (public.is_admin())
with check (public.is_admin());

create policy amenities_admin_delete
on public.amenities
for delete
using (public.is_admin());

-- Property amenities policies
create policy property_amenities_select_for_approved_or_owner_or_admin
on public.property_amenities
for select
using (
  exists (
    select 1 from public.properties p
    where p.id = property_amenities.property_id
      and (p.status = 'approved' or p.landlord_id = auth.uid() or public.is_admin())
  )
);

create policy property_amenities_insert_owner_or_admin
on public.property_amenities
for insert
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_amenities.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
);

create policy property_amenities_update_owner_or_admin
on public.property_amenities
for update
using (
  exists (
    select 1 from public.properties p
    where p.id = property_amenities.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_amenities.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
);

create policy property_amenities_delete_owner_or_admin
on public.property_amenities
for delete
using (
  exists (
    select 1 from public.properties p
    where p.id = property_amenities.property_id
      and (p.landlord_id = auth.uid() or public.is_admin())
  )
);

-- Favorites policies
create policy favorites_select_owner_or_admin
on public.favorites
for select
using (renter_id = auth.uid() or public.is_admin());

create policy favorites_insert_owner
on public.favorites
for insert
with check (renter_id = auth.uid());

create policy favorites_delete_owner_or_admin
on public.favorites
for delete
using (renter_id = auth.uid() or public.is_admin());

-- Inquiries policies
create policy inquiries_select_participant_or_admin
on public.inquiries
for select
using (renter_id = auth.uid() or landlord_id = auth.uid() or public.is_admin());

create policy inquiries_insert_renter
on public.inquiries
for insert
with check (
  renter_id = auth.uid() and exists (
    select 1 from public.properties p
    where p.id = inquiries.property_id
      and p.landlord_id = inquiries.landlord_id
  )
);

create policy inquiries_update_renter_or_admin
on public.inquiries
for update
using (renter_id = auth.uid() or public.is_admin())
with check (
  (renter_id = auth.uid() and exists (
    select 1 from public.properties p
    where p.id = inquiries.property_id
      and p.landlord_id = inquiries.landlord_id
  ))
  or public.is_admin()
);

create policy inquiries_delete_renter_or_admin
on public.inquiries
for delete
using (renter_id = auth.uid() or public.is_admin());

-- Reviews policies
create policy reviews_select_for_approved_or_admin
on public.reviews
for select
using (
  public.is_admin() or exists (
    select 1 from public.properties p
    where p.id = reviews.property_id
      and p.status = 'approved'
  )
);

create policy reviews_insert_renter_with_inquiry
on public.reviews
for insert
with check (
  renter_id = auth.uid() and exists (
    select 1 from public.inquiries i
    where i.property_id = reviews.property_id
      and i.renter_id = auth.uid()
  )
  and exists (
    select 1 from public.properties p
    where p.id = reviews.property_id
      and p.landlord_id = reviews.landlord_id
  )
);

create policy reviews_update_owner_or_admin
on public.reviews
for update
using (renter_id = auth.uid() or public.is_admin())
with check (
  (renter_id = auth.uid() and exists (
    select 1 from public.properties p
    where p.id = reviews.property_id
      and p.landlord_id = reviews.landlord_id
  ))
  or public.is_admin()
);

create policy reviews_delete_owner_or_admin
on public.reviews
for delete
using (renter_id = auth.uid() or public.is_admin());

-- Verification requests policies
create policy verification_requests_select_owner_or_admin
on public.verification_requests
for select
using (landlord_id = auth.uid() or public.is_admin());

create policy verification_requests_insert_owner
on public.verification_requests
for insert
with check (landlord_id = auth.uid());

create policy verification_requests_update_admin
on public.verification_requests
for update
using (public.is_admin())
with check (public.is_admin());

create policy verification_requests_delete_admin
on public.verification_requests
for delete
using (public.is_admin());

-- Recommendation logs policies
create policy recommendation_logs_select_owner_or_admin
on public.recommendation_logs
for select
using (renter_id = auth.uid() or public.is_admin());

create policy recommendation_logs_insert_owner
on public.recommendation_logs
for insert
with check (renter_id = auth.uid());

-- Storage bucket plan (comment only)
-- Create a Supabase Storage bucket named "property-images".
-- Intended policy: landlords can upload images for their own properties.
-- Public access should be limited to approved listings using signed URLs.
-- Do not expose unapproved or private images via public URLs.
