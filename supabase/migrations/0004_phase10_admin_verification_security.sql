-- Phase 10: admin review and landlord verification security

create or replace function public.prevent_property_status_non_admin_update()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Only admins can change property status';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_prevent_status_non_admin_update on public.properties;

create trigger properties_prevent_status_non_admin_update
before update on public.properties
for each row execute function public.prevent_property_status_non_admin_update();

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
    if new.id = auth.uid()
      and new.verification_status = 'pending'
      and current_setting('app.allow_verification_pending_update', true) = 'true'
    then
      return new;
    end if;

    raise exception 'Only admins can change verification status';
  end if;

  return new;
end;
$$;

drop policy if exists verification_requests_select_owner_or_admin
on public.verification_requests;
drop policy if exists verification_requests_insert_owner
on public.verification_requests;
drop policy if exists verification_requests_update_admin
on public.verification_requests;
drop policy if exists verification_requests_delete_admin
on public.verification_requests;

create policy verification_requests_select_landlord_owner_or_admin
on public.verification_requests
for select
using (
  public.is_admin()
  or (
    landlord_id = auth.uid()
    and public.current_user_role() = 'landlord'
  )
);

create policy verification_requests_insert_landlord_owner
on public.verification_requests
for insert
with check (
  landlord_id = auth.uid()
  and public.current_user_role() = 'landlord'
);

create policy verification_requests_update_admin
on public.verification_requests
for update
using (public.is_admin())
with check (public.is_admin());

create policy verification_requests_delete_admin
on public.verification_requests
for delete
using (public.is_admin());

create or replace function public.submit_landlord_verification_request()
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_id uuid;
  current_status public.verification_status_enum;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.current_user_role() <> 'landlord' then
    raise exception 'Only landlords can request verification';
  end if;

  select verification_status
  into current_status
  from public.profiles
  where id = auth.uid();

  if current_status = 'verified' then
    raise exception 'Landlord profile is already verified';
  end if;

  if exists (
    select 1
    from public.verification_requests
    where landlord_id = auth.uid()
      and status = 'pending'
  ) then
    raise exception 'A pending verification request already exists';
  end if;

  insert into public.verification_requests (landlord_id)
  values (auth.uid())
  returning id into request_id;

  perform set_config('app.allow_verification_pending_update', 'true', true);

  update public.profiles
  set verification_status = 'pending'
  where id = auth.uid();

  return request_id;
end;
$$;

create or replace function public.review_landlord_verification_request(
  request_id uuid,
  decision public.verification_status_enum,
  admin_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_landlord_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review landlord verification requests';
  end if;

  if decision not in ('verified', 'rejected') then
    raise exception 'Decision must be verified or rejected';
  end if;

  update public.verification_requests
  set
    status = decision,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    notes = admin_notes
  where id = request_id
    and status = 'pending'
  returning landlord_id into target_landlord_id;

  if target_landlord_id is null then
    raise exception 'Pending verification request not found';
  end if;

  update public.profiles
  set verification_status = decision
  where id = target_landlord_id;
end;
$$;

create or replace function public.review_property_listing(
  property_id uuid,
  decision public.property_status_enum
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can review property listings';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  update public.properties
  set status = decision
  where id = property_id
    and status = 'pending';

  if not found then
    raise exception 'Pending property not found';
  end if;
end;
$$;
