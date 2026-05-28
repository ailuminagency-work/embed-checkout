-- Stores theme and business configuration editable from the admin panel
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text        PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_read_all" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "app_settings_admin_write" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

INSERT INTO public.app_settings (key, value) VALUES
  ('company_name',          'CleanSlate Hauling'),
  ('company_logo_url',      NULL),
  ('primary_color',         '#0d9488'),
  ('border_radius',         '0.625'),
  ('deposit_mode',          'false'),
  ('deposit_percentage',    '25'),
  ('photo_promo_percent',   '5'),
  ('stripe_publishable_key', NULL)
ON CONFLICT (key) DO NOTHING;
