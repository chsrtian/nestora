-- Phase 9: enforce approved status for inquiries and reviews

-- Inquiries policies
DROP POLICY IF EXISTS inquiries_insert_renter ON public.inquiries;
DROP POLICY IF EXISTS inquiries_update_renter_or_admin ON public.inquiries;

CREATE POLICY inquiries_insert_renter
ON public.inquiries
FOR INSERT
WITH CHECK (
  renter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = inquiries.property_id
      AND p.landlord_id = inquiries.landlord_id
      AND p.status = 'approved'
  )
);

CREATE POLICY inquiries_update_renter_or_admin
ON public.inquiries
FOR UPDATE
USING (renter_id = auth.uid() OR public.is_admin())
WITH CHECK (
  (renter_id = auth.uid() OR public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = inquiries.property_id
      AND p.landlord_id = inquiries.landlord_id
      AND p.status = 'approved'
  )
);

-- Reviews policies
DROP POLICY IF EXISTS reviews_insert_renter_with_inquiry ON public.reviews;
DROP POLICY IF EXISTS reviews_update_owner_or_admin ON public.reviews;

CREATE POLICY reviews_insert_renter_with_inquiry
ON public.reviews
FOR INSERT
WITH CHECK (
  renter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.property_id = reviews.property_id
      AND i.renter_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = reviews.property_id
      AND p.landlord_id = reviews.landlord_id
      AND p.status = 'approved'
  )
);

CREATE POLICY reviews_update_owner_or_admin
ON public.reviews
FOR UPDATE
USING (renter_id = auth.uid() OR public.is_admin())
WITH CHECK (
  (renter_id = auth.uid() OR public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = reviews.property_id
      AND p.landlord_id = reviews.landlord_id
      AND p.status = 'approved'
  )
);
