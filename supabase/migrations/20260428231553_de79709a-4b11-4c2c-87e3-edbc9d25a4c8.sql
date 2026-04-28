-- Drop old zone-based pricing tables
DROP TABLE IF EXISTS public.zip_to_zone CASCADE;
DROP TABLE IF EXISTS public.pricing_zones CASCADE;

-- Create simplified zip_pricing table
CREATE TABLE public.zip_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip_code TEXT NOT NULL UNIQUE,
  minimum_price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_zip_pricing_zip ON public.zip_pricing(zip_code);

ALTER TABLE public.zip_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active zip pricing"
ON public.zip_pricing FOR SELECT
TO anon, authenticated
USING (active = true);

CREATE POLICY "Admins can read all zip pricing"
ON public.zip_pricing FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert zip pricing"
ON public.zip_pricing FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update zip pricing"
ON public.zip_pricing FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete zip pricing"
ON public.zip_pricing FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_zip_pricing_updated_at
BEFORE UPDATE ON public.zip_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Drop old policy first so we can drop the column
DROP POLICY IF EXISTS "Anyone can create booking pricing logs" ON public.booking_pricing_logs;

-- Now drop the zone_name column (no longer applicable)
ALTER TABLE public.booking_pricing_logs DROP COLUMN IF EXISTS zone_name;

-- Recreate insert policy without zone_name reference
CREATE POLICY "Anyone can create booking pricing logs"
ON public.booking_pricing_logs FOR INSERT
TO anon, authenticated
WITH CHECK (
  (zip_code ~ '^\d{5}(-\d{4})?$'::text)
  AND (item_total >= 0::numeric)
  AND (final_price >= 0::numeric)
  AND ((minimum_price IS NULL) OR (minimum_price >= 0::numeric))
  AND ((booking_reference IS NULL) OR (char_length(booking_reference) <= 255))
);