-- Phase 11: protect reviewed listings from owner-side direct edits.
-- Landlord-created listings remain editable only while pending review.

drop policy if exists properties_insert_owner_or_admin
on public.properties;

create policy properties_insert_owner_or_admin
on public.properties
for insert
with check (
  public.is_admin()
  or (
    public.current_user_role() = 'landlord'
    and landlord_id = auth.uid()
    and status = 'pending'
  )
);

drop policy if exists properties_update_owner_or_admin
on public.properties;

create policy properties_update_owner_or_admin
on public.properties
for update
using (
  public.is_admin()
  or (
    public.current_user_role() = 'landlord'
    and landlord_id = auth.uid()
    and status = 'pending'
  )
)
with check (
  public.is_admin()
  or (
    public.current_user_role() = 'landlord'
    and landlord_id = auth.uid()
    and status = 'pending'
  )
);

drop policy if exists property_amenities_insert_owner_or_admin
on public.property_amenities;

create policy property_amenities_insert_owner_or_admin
on public.property_amenities
for insert
with check (
  public.is_admin()
  or (
    public.current_user_role() = 'landlord'
    and exists (
      select 1
      from public.properties p
      where p.id = property_amenities.property_id
        and p.landlord_id = auth.uid()
        and p.status = 'pending'
    )
  )
);

drop policy if exists property_amenities_update_owner_or_admin
on public.property_amenities;

create policy property_amenities_update_owner_or_admin
on public.property_amenities
for update
using (
  public.is_admin()
  or (
    public.current_user_role() = 'landlord'
    and exists (
      select 1
      from public.properties p
      where p.id = property_amenities.property_id
        and p.landlord_id = auth.uid()
        and p.status = 'pending'
    )
  )
)
with check (
  public.is_admin()
  or (
    public.current_user_role() = 'landlord'
    and exists (
      select 1
      from public.properties p
      where p.id = property_amenities.property_id
        and p.landlord_id = auth.uid()
        and p.status = 'pending'
    )
  )
);

drop policy if exists property_amenities_delete_owner_or_admin
on public.property_amenities;

create policy property_amenities_delete_owner_or_admin
on public.property_amenities
for delete
using (
  public.is_admin()
  or (
    public.current_user_role() = 'landlord'
    and exists (
      select 1
      from public.properties p
      where p.id = property_amenities.property_id
        and p.landlord_id = auth.uid()
        and p.status = 'pending'
    )
  )
);
