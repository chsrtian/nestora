-- Validation checks for the Cabadbaran accommodation seed dataset
-- Run after seed.ph-demo.sql

select count(*) as cabadbaran_accommodation_candidates
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%';

select verification_status, count(*) as total
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
group by verification_status
order by verification_status;

select count(*) as non_cabadbaran_seed_properties
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and city is distinct from 'Cabadbaran City';

select count(*) as seed_properties_with_invented_prices
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and price is not null;

select count(*) as seed_properties_with_invented_room_facts
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and (
    bedrooms is not null
    or bathrooms is not null
    or area_sqm is not null
    or available_from is not null
  );

select count(*) as seed_properties_with_amenities
from public.property_amenities pa
join public.properties p on p.id = pa.property_id
where p.source_note ilike '%Cabadbaran accommodation seed%';

select count(*) as seed_properties_with_cover_images
from public.properties p
join public.property_images pi on pi.property_id = p.id
where p.source_note ilike '%Cabadbaran accommodation seed%'
  and pi.is_cover = true
  and pi.storage_path ilike '/property-images/%';

with expected_images(title, storage_path) as (
  values
    ('Casa Alburo Pension House', '/property-images/casa-alburo-pension-house.jpg'),
    ('MLM Pension House', '/property-images/mlm-pension-house.jpg'),
    ('Mande Pension House', '/property-images/mande-pension-house.jpg'),
    ('Gazebo Pools and Restaurant', '/property-images/gazebo-pools-and-restaurant.jpg'),
    ('The Loreta Resort', '/property-images/the-loreta-resort.jpg'),
    ('E & G Hotel and Convention Center / Resort', '/property-images/e-and-g-hotel.jpg'),
    ('RG Traveller''s Inn', '/property-images/rg-travellers-inn.jpg'),
    ('La Dolce Vita Inland Resort', '/property-images/la-dolce-vita-inland-resort.jpg')
)
select expected_images.title as missing_seed_image_title,
       expected_images.storage_path as missing_seed_image_path
from expected_images
left join public.properties p
  on p.title = expected_images.title
  and p.source_note ilike '%Cabadbaran accommodation seed%'
left join public.property_images pi
  on pi.property_id = p.id
  and pi.storage_path = expected_images.storage_path
  and pi.is_cover = true
where pi.id is null
order by expected_images.title;

select count(*) as seed_properties_with_generic_candidate_description
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and (
    description ilike '%Cabadbaran accommodation candidate%'
    or description ilike '%Pricing, room details, availability, contact information, and amenities are not included%'
  );

select count(*) as mapped_seed_properties
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and lat is not null
  and lng is not null;

select count(*) as coordinate_ready_map_records
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and status = 'approved'
  and verification_status = 'verified'
  and lat is not null
  and lng is not null
  and lat between -90 and 90
  and lng between -180 and 180
  and (source_url is not null or source_note is not null);

with expected_map_titles(title) as (
  values
    ('MLM Pension House'),
    ('Gazebo Pools and Restaurant'),
    ('E & G Hotel and Convention Center / Resort'),
    ('La Dolce Vita Inland Resort')
)
select expected_map_titles.title as missing_coordinate_ready_title
from expected_map_titles
left join public.properties p
  on p.title = expected_map_titles.title
  and p.source_note ilike '%Cabadbaran accommodation seed%'
  and p.status = 'approved'
  and p.verification_status = 'verified'
  and p.lat is not null
  and p.lng is not null
  and p.lat between -90 and 90
  and p.lng between -180 and 180
  and (p.source_url is not null or p.source_note is not null)
where p.id is null
order by expected_map_titles.title;

select title, status, verification_status, lat, lng, source_url
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and status = 'approved'
  and verification_status = 'verified'
  and lat is not null
  and lng is not null
  and lat between -90 and 90
  and lng between -180 and 180
  and (source_url is not null or source_note is not null)
order by title;

select count(*) as unmapped_seed_properties
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and (lat is null or lng is null);

select count(*) as seed_coords_out_of_range
from public.properties
where source_note ilike '%Cabadbaran accommodation seed%'
  and (
    lat is not null and (lat < -90 or lat > 90)
    or lng is not null and (lng < -180 or lng > 180)
  );

select count(*) as old_generated_fake_titles
from public.properties
where title ~ '^(Cozy|Modern|Bright|Secure|Quiet|Spacious|Airy|Practical|Family-ready|Budget) (Apartment|Boarding House|Dormitory|Condo|House for Rent|Lodge|Inn) in ';
