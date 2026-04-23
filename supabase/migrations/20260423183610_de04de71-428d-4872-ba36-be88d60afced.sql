DROP POLICY IF EXISTS "Anyone can create booking pricing logs" ON public.booking_pricing_logs;

CREATE POLICY "Anyone can create booking pricing logs"
ON public.booking_pricing_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  zip_code ~ '^\d{5}(-\d{4})?$'
  AND item_total >= 0
  AND final_price >= 0
  AND (minimum_price IS NULL OR minimum_price >= 0)
  AND (booking_reference IS NULL OR char_length(booking_reference) <= 255)
  AND (zone_name IS NULL OR char_length(zone_name) <= 255)
);