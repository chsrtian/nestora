-- Cabadbaran accommodation candidate seed dataset
-- Default password for the seed-only landlord account: DemoPass123!
--
-- This file intentionally does not seed prices, availability, owner names,
-- phone numbers, room counts, reviews, inquiries, prices, or amenities for
-- these accommodations. Unknown facts are stored as null.

begin;

create extension if not exists "pgcrypto";

-- Keep the shared amenity catalog available without assigning amenities to
-- accommodation candidates unless they are separately verified.
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

-- Remove the previous generated Philippine demo seed data.
delete from auth.users
where raw_user_meta_data->>'seed' = 'true'
  and (
    email ilike '%@demo.ph'
    or email = 'cabadbaran-accommodation-seed@example.invalid'
  );

delete from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  or title ~ '^(Cozy|Modern|Bright|Secure|Quiet|Spacious|Airy|Practical|Family-ready|Budget) (Apartment|Boarding House|Dormitory|Condo|House for Rent|Lodge|Inn) in ';

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  aud,
  role,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'cabadbaran-accommodation-seed@example.invalid',
  crypt('DemoPass123!', gen_salt('bf')),
  now(),
  jsonb_build_object(
    'role', 'landlord',
    'seed', true,
    'seed_note', 'Seed-only account for Cabadbaran accommodation candidates; not an owner contact.'
  ),
  jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email')
  ),
  'authenticated',
  'authenticated',
  now(),
  now()
)
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_user_meta_data = excluded.raw_user_meta_data,
  raw_app_meta_data = excluded.raw_app_meta_data,
  updated_at = now();

insert into public.profiles (
  id,
  role,
  full_name,
  phone,
  bio,
  verification_status
)
values (
  '10000000-0000-4000-8000-000000000001',
  'landlord',
  null,
  null,
  'Seed-only profile for Cabadbaran accommodation candidates. This is not an owner contact.',
  'unverified'
)
on conflict (id) do update
set
  role = excluded.role,
  full_name = excluded.full_name,
  phone = excluded.phone,
  bio = excluded.bio,
  verification_status = excluded.verification_status;

with accommodation_candidates as (
  select *
  from (values
    (
      '20000000-0000-4000-8000-000000000001'::uuid,
      'Casa Alburo Pension House',
      'Pension House',
      'Corner L. Dagani and A. Mortola Street, Barangay 6',
      null::double precision,
      null::double precision,
      'needs_verification'::public.property_verification_status_enum,
      'https://www.tripadvisor.com/Hotel_Review-g2440941-d10094446-Reviews-Casa_Alburo_Pension_House-Cabadbaran_Agusan_del_Norte_Province_Mindanao.html',
      'Cabadbaran accommodation seed. OSM/Nominatim/Overpass returned no matching coordinate on 2026-05-31; coordinates intentionally null. Existence/address source: Tripadvisor listing.'
    ),
    (
      '20000000-0000-4000-8000-000000000002'::uuid,
      'MLM Pension House',
      'Pension House',
      'Purok 4, Barangay Mabini, National Highway',
      9.1137378::double precision,
      125.5503867::double precision,
      'verified'::public.property_verification_status_enum,
      'https://www.openstreetmap.org/node/2555314832',
      'Cabadbaran accommodation seed. Coordinate source: OpenStreetMap node 2555314832 via Overpass on 2026-05-31. OSM name: MLM Pension.'
    ),
    (
      '20000000-0000-4000-8000-000000000003'::uuid,
      'Mande Pension House',
      'Pension House',
      '2nd Floor, Ocular Bldg. II, Ojeda Avenue, Poblacion 7',
      null::double precision,
      null::double precision,
      'needs_verification'::public.property_verification_status_enum,
      'https://www.lookph.com/mande-pension-house',
      'Cabadbaran accommodation seed. OSM/Nominatim/Overpass returned no matching coordinate on 2026-05-31; coordinates intentionally null. Existence/address source: LookPH listing.'
    ),
    (
      '20000000-0000-4000-8000-000000000004'::uuid,
      'Gazebo Pools and Restaurant',
      'Resort',
      'Quarry, Barangay 9',
      9.1242368::double precision,
      125.5454988::double precision,
      'verified'::public.property_verification_status_enum,
      'https://www.openstreetmap.org/way/360981531',
      'Cabadbaran accommodation seed. Coordinate source: OpenStreetMap way 360981531 center via Overpass on 2026-05-31. OSM name: Gazebo Pool.'
    ),
    (
      '20000000-0000-4000-8000-000000000005'::uuid,
      'The Loreta Resort',
      'Resort',
      'Km. 1 Hinagdanan, Comagascas',
      null::double precision,
      null::double precision,
      'needs_verification'::public.property_verification_status_enum,
      'https://ph.locale.online/the-loreta-resort-1598329224.html',
      'Cabadbaran accommodation seed. OSM/Nominatim/Overpass returned no matching coordinate on 2026-05-31; coordinates intentionally null. Existence/address source: Locale Online listing.'
    ),
    (
      '20000000-0000-4000-8000-000000000006'::uuid,
      'E & G Hotel and Convention Center / Resort',
      'Hotel and Resort',
      'Ibay Street',
      9.1261690::double precision,
      125.5359767::double precision,
      'verified'::public.property_verification_status_enum,
      'https://www.openstreetmap.org/node/6652820786',
      'Cabadbaran accommodation seed. Coordinate source: OpenStreetMap node 6652820786 via Overpass on 2026-05-31. OSM name: E&G Hotel and Resort.'
    ),
    (
      '20000000-0000-4000-8000-000000000007'::uuid,
      'RG Traveller''s Inn',
      'Inn',
      null,
      null::double precision,
      null::double precision,
      'incomplete'::public.property_verification_status_enum,
      null,
      'Cabadbaran accommodation seed. Requested candidate; OSM/Nominatim/Overpass and web search did not return a reliable Cabadbaran coordinate/source in this pass. Keep incomplete until manually verified.'
    ),
    (
      '20000000-0000-4000-8000-000000000008'::uuid,
      'La Dolce Vita Inland Resort',
      'Inland Resort',
      'Ibay Street',
      9.1258414::double precision,
      125.5365149::double precision,
      'verified'::public.property_verification_status_enum,
      'https://www.openstreetmap.org/node/4703205189',
      'Cabadbaran accommodation seed. Coordinate source: OpenStreetMap node 4703205189 via Overpass on 2026-05-31. OSM name: La Dolce Vita Inland Resort.'
    )
  ) as rows (
    id,
    title,
    property_type,
    address_line,
    lat,
    lng,
    verification_status,
    source_url,
    source_note
  )
)
insert into public.properties (
  id,
  landlord_id,
  title,
  description,
  property_type,
  price,
  deposit,
  advance,
  bedrooms,
  bathrooms,
  area_sqm,
  address_line,
  city,
  state,
  country,
  lat,
  lng,
  status,
  verification_status,
  source_url,
  source_note,
  available_from
)
select
  id,
  '10000000-0000-4000-8000-000000000001',
  title,
  case id
    when '20000000-0000-4000-8000-000000000001'::uuid then 'A local pension house listing in Cabadbaran City intended for renters looking for short-term or budget-friendly accommodation options. Details such as rates, room availability, and included amenities should be confirmed directly with the property.'
    when '20000000-0000-4000-8000-000000000002'::uuid then 'A pension house option located in Cabadbaran City, suitable for users comparing available lodging choices within the area. Pricing, room features, and availability are not included in the seed and should be verified before booking.'
    when '20000000-0000-4000-8000-000000000003'::uuid then 'A Cabadbaran accommodation listing added for rental discovery and comparison. Users should confirm current room rates, availability, and facilities directly with the property before making inquiries.'
    when '20000000-0000-4000-8000-000000000004'::uuid then 'A local accommodation and leisure-related listing in Cabadbaran City. This entry is included for discovery purposes, while room details, pricing, and current availability should be verified from official or direct sources.'
    when '20000000-0000-4000-8000-000000000005'::uuid then 'A resort listing in Cabadbaran City for renters or visitors exploring accommodation options. Current rates, facilities, and booking availability are not assumed and should be checked directly with the resort.'
    when '20000000-0000-4000-8000-000000000006'::uuid then 'A hotel and events-related accommodation option in Cabadbaran City. This listing is included as a verified accommodation candidate, with pricing, room details, and availability requiring direct confirmation.'
    when '20000000-0000-4000-8000-000000000007'::uuid then 'A travellers inn listing in Cabadbaran City intended for users looking for local lodging options. Users should verify current rates, room availability, and services before proceeding with inquiries.'
    when '20000000-0000-4000-8000-000000000008'::uuid then 'An inland resort listing in Cabadbaran City included for accommodation discovery. Details such as current rates, available rooms, and included facilities should be confirmed directly with the property.'
  end,
  property_type,
  null,
  null,
  null,
  null,
  null,
  null,
  address_line,
  'Cabadbaran City',
  'Agusan del Norte',
  'Philippines',
  lat,
  lng,
  'approved',
  verification_status,
  source_url,
  source_note,
  null
from accommodation_candidates
on conflict (id) do update
set
  description = excluded.description,
  updated_at = now();

with property_image_seeds as (
  select *
  from (values
    ('20000000-0000-4000-8000-000000000001'::uuid, '/property-images/casa-alburo-pension-house.jpg', true),
    ('20000000-0000-4000-8000-000000000002'::uuid, '/property-images/mlm-pension-house.jpg', true),
    ('20000000-0000-4000-8000-000000000003'::uuid, '/property-images/mande-pension-house.jpg', true),
    ('20000000-0000-4000-8000-000000000004'::uuid, '/property-images/gazebo-pools-and-restaurant.jpg', true),
    ('20000000-0000-4000-8000-000000000005'::uuid, '/property-images/the-loreta-resort.jpg', true),
    ('20000000-0000-4000-8000-000000000006'::uuid, '/property-images/e-and-g-hotel.jpg', true),
    ('20000000-0000-4000-8000-000000000007'::uuid, '/property-images/rg-travellers-inn.jpg', true),
    ('20000000-0000-4000-8000-000000000008'::uuid, '/property-images/la-dolce-vita-inland-resort.jpg', true)
  ) as rows (property_id, storage_path, is_cover)
)
insert into public.property_images (property_id, storage_path, is_cover, sort_order)
select property_id, storage_path, is_cover, 0
from property_image_seeds
on conflict (property_id, storage_path) do update set is_cover = excluded.is_cover, updated_at = now();

commit;
