# Admin Setup (MVP)

Admins are not created through public registration.
Public registration only supports renter and landlord roles.

## Manual admin setup

1. Create an Auth user in Supabase (Email/Password).
2. Insert or update the matching profile row with the admin role.

Example SQL:

```sql
-- Insert a new admin profile (after the auth user exists)
insert into public.profiles (id, role, verification_status)
values ('<auth_user_id>', 'admin', 'verified');

-- Or update an existing profile to admin
update public.profiles
set role = 'admin'
where id = '<auth_user_id>';
```

## Notes

- No public admin promotion endpoint exists for MVP.
- Do not expose admin role changes in client code.
