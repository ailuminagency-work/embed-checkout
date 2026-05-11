CREATE TABLE public.time_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_windows ENABLE ROW LEVEL SECURITY;

-- Checkout widget (anon) reads active windows; authenticated users do too
CREATE POLICY "Anyone can read active time windows"
  ON public.time_windows FOR SELECT
  USING (active = true);

-- Admins can do full CRUD (reads all rows, including inactive)
CREATE POLICY "Admins can manage time windows"
  ON public.time_windows FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed with the three existing hardcoded windows
INSERT INTO public.time_windows (label, sort_order) VALUES
  ('8:00 AM – 12:00 PM', 0),
  ('12:00 PM – 4:00 PM', 1),
  ('4:00 PM – 8:00 PM', 2);
