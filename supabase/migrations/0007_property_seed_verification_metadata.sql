-- Phase 12: verified seed metadata for public accommodation candidates.
-- Rental facts that are unknown should stay null instead of becoming fake zeroes.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'property_verification_status_enum'
  ) then
    create type public.property_verification_status_enum as enum (
      'verified',
      'needs_verification',
      'incomplete'
    );
  end if;
end $$;

alter table public.properties
  add column if not exists verification_status public.property_verification_status_enum
    not null default 'needs_verification',
  add column if not exists source_url text,
  add column if not exists source_note text;

alter table public.properties
  alter column price drop not null,
  alter column deposit drop not null,
  alter column advance drop not null,
  alter column bedrooms drop not null,
  alter column bathrooms drop not null,
  alter column area_sqm drop not null;

create index if not exists properties_verification_status_idx
  on public.properties(verification_status);
