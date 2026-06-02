-- Direct SQL update to fix descriptions and add images for the 8 Cabadbaran seed properties.
-- Run this in: Supabase Dashboard → SQL Editor → Paste → Run

-- Step 1: Update descriptions
UPDATE public.properties
SET
  description = CASE id
    WHEN '20000000-0000-4000-8000-000000000001'::uuid
      THEN 'A local pension house listing in Cabadbaran City intended for renters looking for short-term or budget-friendly accommodation options. Details such as rates, room availability, and included amenities should be confirmed directly with the property.'
    WHEN '20000000-0000-4000-8000-000000000002'::uuid
      THEN 'A pension house option located in Cabadbaran City, suitable for users comparing available lodging choices within the area. Pricing, room features, and availability are not included in the seed and should be verified before booking.'
    WHEN '20000000-0000-4000-8000-000000000003'::uuid
      THEN 'A Cabadbaran accommodation listing added for rental discovery and comparison. Users should confirm current room rates, availability, and facilities directly with the property before making inquiries.'
    WHEN '20000000-0000-4000-8000-000000000004'::uuid
      THEN 'A local accommodation and leisure-related listing in Cabadbaran City. This entry is included for discovery purposes, while room details, pricing, and current availability should be verified from official or direct sources.'
    WHEN '20000000-0000-4000-8000-000000000005'::uuid
      THEN 'A resort listing in Cabadbaran City for renters or visitors exploring accommodation options. Current rates, facilities, and booking availability are not assumed and should be checked directly with the resort.'
    WHEN '20000000-0000-4000-8000-000000000006'::uuid
      THEN 'A hotel and events-related accommodation option in Cabadbaran City. This listing is included as a verified accommodation candidate, with pricing, room details, and availability requiring direct confirmation.'
    WHEN '20000000-0000-4000-8000-000000000007'::uuid
      THEN 'A travellers inn listing in Cabadbaran City intended for users looking for local lodging options. Users should verify current rates, room availability, and services before proceeding with inquiries.'
    WHEN '20000000-0000-4000-8000-000000000008'::uuid
      THEN 'An inland resort listing in Cabadbaran City included for accommodation discovery. Details such as current rates, available rooms, and included facilities should be confirmed directly with the property.'
  END,
  updated_at = now()
WHERE id IN (
  '20000000-0000-4000-8000-000000000001'::uuid,
  '20000000-0000-4000-8000-000000000002'::uuid,
  '20000000-0000-4000-8000-000000000003'::uuid,
  '20000000-0000-4000-8000-000000000004'::uuid,
  '20000000-0000-4000-8000-000000000005'::uuid,
  '20000000-0000-4000-8000-000000000006'::uuid,
  '20000000-0000-4000-8000-000000000007'::uuid,
  '20000000-0000-4000-8000-000000000008'::uuid
);

-- Step 2: Insert / update property_images
INSERT INTO public.property_images (property_id, storage_path, is_cover, sort_order)
VALUES
  ('20000000-0000-4000-8000-000000000001'::uuid, '/property-images/casa-alburo-pension-house.jpg', true, 0),
  ('20000000-0000-4000-8000-000000000002'::uuid, '/property-images/mlm-pension-house.jpg', true, 0),
  ('20000000-0000-4000-8000-000000000003'::uuid, '/property-images/mande-pension-house.jpg', true, 0),
  ('20000000-0000-4000-8000-000000000004'::uuid, '/property-images/gazebo-pools-and-restaurant.jpg', true, 0),
  ('20000000-0000-4000-8000-000000000005'::uuid, '/property-images/the-loreta-resort.jpg', true, 0),
  ('20000000-0000-4000-8000-000000000006'::uuid, '/property-images/e-and-g-hotel.jpg', true, 0),
  ('20000000-0000-4000-8000-000000000007'::uuid, '/property-images/rg-travellers-inn.jpg', true, 0),
  ('20000000-0000-4000-8000-000000000008'::uuid, '/property-images/la-dolce-vita-inland-resort.jpg', true, 0)
ON CONFLICT (property_id, storage_path)
DO UPDATE SET
  is_cover = EXCLUDED.is_cover,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
