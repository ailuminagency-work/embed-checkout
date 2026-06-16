-- Setup Wizard: brand/area/notification settings + setup-progress flags + logo storage bucket.
-- Additive only. primary_color is intentionally NOT reseeded here (ThemeProvider already
-- owns it, stored WITH a leading '#').

INSERT INTO public.app_settings (key, value) VALUES
  -- Brand
  ('business_name',            ''),       -- falls back to company_name when empty
  ('widget_title',             ''),       -- falls back to business_name when empty
  ('show_logo',                'true'),   -- 'true' | 'false'

  -- Service area
  ('enable_zip_restrictions',  'true'),   -- 'true' | 'false'
  ('out_of_area_behavior',     'block'),  -- 'block' | 'allow'

  -- Admin notifications
  ('admin_notification_email', ''),       -- business owner's inbox for new-booking alerts
  ('email_provider',           ''),       -- 'gmail' | 'outlook'
  ('email_user_hint',          ''),       -- non-sensitive display hint
  ('email_from_name',          ''),
  ('stripe_secret_key_hint',   ''),       -- last 4 only, never the full key

  -- Setup wizard progress
  ('setup_step_brand',         'false'),
  ('setup_step_stripe',        'false'),
  ('setup_step_email',         'false'),
  ('setup_step_area',          'false')
ON CONFLICT (key) DO NOTHING;

-- ── Logo storage bucket (public read, authenticated write) ───────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "branding_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'branding');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "branding_auth_write" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'branding' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "branding_auth_update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'branding' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
