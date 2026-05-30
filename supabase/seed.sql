-- Seed data: safe defaults only
-- NOTE: Do not insert sample profiles or properties until auth.users records exist.
-- Profiles.id must reference auth.users.id.

insert into public.amenities (name)
values
  ('wifi'),
  ('parking'),
  ('air_conditioning'),
  ('heating'),
  ('laundry'),
  ('balcony'),
  ('gym'),
  ('pool'),
  ('elevator'),
  ('pet_friendly')
on conflict (name) do nothing;

-- Sample users, properties, images, reviews, and verification requests
-- can only be inserted after Supabase Auth users are created.
