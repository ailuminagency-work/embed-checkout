-- Analytics & conversion tracking config
INSERT INTO public.app_settings (key, value) VALUES
  ('tracking_enabled',           'false'),
  ('ga4_measurement_id',         ''),
  ('google_ads_conversion_id',   ''),
  ('google_ads_conversion_label','')
ON CONFLICT (key) DO NOTHING;
