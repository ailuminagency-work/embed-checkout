CREATE TABLE public.pricing_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_name TEXT NOT NULL UNIQUE,
  minimum_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active pricing zones"
ON public.pricing_zones
FOR SELECT
TO anon, authenticated
USING (active = true);

CREATE POLICY "Admins can read all pricing zones"
ON public.pricing_zones
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create pricing zones"
ON public.pricing_zones
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pricing zones"
ON public.pricing_zones
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pricing zones"
ON public.pricing_zones
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pricing_zones_updated_at
BEFORE UPDATE ON public.pricing_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.zip_to_zone (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip_code TEXT NOT NULL UNIQUE,
  zone_id UUID NOT NULL REFERENCES public.pricing_zones(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_zip_to_zone_zip_code ON public.zip_to_zone(zip_code);
CREATE INDEX idx_zip_to_zone_zone_id ON public.zip_to_zone(zone_id);

ALTER TABLE public.zip_to_zone ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active zip mappings"
ON public.zip_to_zone
FOR SELECT
TO anon, authenticated
USING (active = true);

CREATE POLICY "Admins can read all zip mappings"
ON public.zip_to_zone
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create zip mappings"
ON public.zip_to_zone
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update zip mappings"
ON public.zip_to_zone
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete zip mappings"
ON public.zip_to_zone
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_zip_to_zone_updated_at
BEFORE UPDATE ON public.zip_to_zone
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.booking_pricing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_reference TEXT,
  zip_code TEXT NOT NULL,
  zone_name TEXT,
  minimum_price NUMERIC(10,2),
  item_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_pricing_logs_created_at ON public.booking_pricing_logs(created_at DESC);
CREATE INDEX idx_booking_pricing_logs_zip_code ON public.booking_pricing_logs(zip_code);

ALTER TABLE public.booking_pricing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create booking pricing logs"
ON public.booking_pricing_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read booking pricing logs"
ON public.booking_pricing_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));