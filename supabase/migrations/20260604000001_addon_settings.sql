-- Add-on configuration keys (all start empty/disabled)
INSERT INTO public.app_settings (key, value) VALUES
  ('twilio_account_sid',              ''),
  ('twilio_auth_token',               ''),
  ('twilio_phone_number',             ''),
  ('google_business_review_url',      ''),
  ('widget_language',                 'en'),
  ('site_url',                        ''),
  ('cancellation_window_hours',       '24'),
  ('addon_booking_reminders_enabled', 'false'),
  ('addon_cancellation_flow_enabled', 'false'),
  ('addon_promo_codes_enabled',       'false'),
  ('addon_customer_portal_enabled',   'false')
ON CONFLICT (key) DO NOTHING;

-- Promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text UNIQUE NOT NULL,
  discount_type  text NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses       integer,
  uses_count     integer NOT NULL DEFAULT 0,
  expires_at     timestamptz,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage promo codes
CREATE POLICY "Admin full access to promo_codes"
  ON public.promo_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Public can read active, non-expired codes for validation
CREATE POLICY "Public can read active promo_codes"
  ON public.promo_codes
  FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses)
  );

-- Add cancel_token and reminder flags to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancel_token  uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS reminder_48h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_code        text,
  ADD COLUMN IF NOT EXISTS promo_discount    numeric NOT NULL DEFAULT 0;
