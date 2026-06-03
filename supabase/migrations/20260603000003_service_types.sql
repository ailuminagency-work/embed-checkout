-- Change 2: Service types — move from hardcoded frontend to DB
-- Admin can add custom types (Estate Cleanout, Appliance Removal, etc.) without code changes.

CREATE TABLE IF NOT EXISTS public.service_types (
  id          text        PRIMARY KEY,
  slug        text        NOT NULL UNIQUE,
  title       text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  icon        text        NOT NULL DEFAULT 'Truck',   -- Lucide icon name
  image_key   text,                                   -- key in app_images table for card background
  active      boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_types_read_all" ON public.service_types
  FOR SELECT USING (true);

CREATE POLICY "service_types_admin_write" ON public.service_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

INSERT INTO public.service_types (id, slug, title, description, icon, image_key, sort_order) VALUES
  ('junk-removal',    'junk-removal',    'Junk Removal',    'We haul away your unwanted items quickly and responsibly.', 'Truck', 'junk_removal_card',    1),
  ('donation-pickup', 'donation-pickup', 'Donation Pickup', 'We pick up items and deliver them to local charities.',      'Heart', 'donation_pickup_card', 2)
ON CONFLICT (id) DO NOTHING;
