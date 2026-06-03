-- Change 1: Externalize all client-specific config to app_settings table
-- Every key here can be changed from the admin panel — no code changes needed.

INSERT INTO public.app_settings (key, value) VALUES
  ('contact_email',         ''),
  ('currency',              'USD'),
  ('currency_symbol',       '$'),
  ('webhook_mode',          'test'),
  ('make_webhook_url_test', ''),
  ('make_webhook_url_live', ''),
  ('twin_webhook_url',      ''),
  ('zip_code_pattern',      '^\d{5}(?:-\d{4})?$')
ON CONFLICT (key) DO NOTHING;
