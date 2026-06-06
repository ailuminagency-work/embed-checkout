-- Ensure stripe_publishable_key (singular) exists as a setting key.
-- resolveStripePublishableKey() in useAppConfig already falls back to this
-- so operators using the simple single-key setup work without extra config.

INSERT INTO public.app_settings (key, value) VALUES
  ('stripe_publishable_key', '')
ON CONFLICT (key) DO NOTHING;
