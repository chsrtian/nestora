-- Phase 11: close RLS deployment blockers found in final MVP review.

drop policy if exists profiles_insert_self_or_admin
on public.profiles;

-- Self-service profile creation must never create admins or verified users.
create policy profiles_insert_self_or_admin
on public.profiles
for insert
with check (
  public.is_admin()
  or (
    id = auth.uid()
    and role in ('renter', 'landlord')
    and verification_status = 'unverified'
  )
);

drop policy if exists properties_insert_owner_or_admin
on public.properties;

-- Landlord-created listings must enter admin review before becoming public.
create policy properties_insert_owner_or_admin
on public.properties
for insert
with check (
  public.is_admin()
  or (
    landlord_id = auth.uid()
    and status = 'pending'
  )
);
