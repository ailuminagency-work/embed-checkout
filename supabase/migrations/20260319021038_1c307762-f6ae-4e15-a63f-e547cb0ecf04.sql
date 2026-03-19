
-- Webhook settings (single row)
CREATE TABLE public.webhook_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_mode text NOT NULL DEFAULT 'test' CHECK (active_mode IN ('test', 'live')),
  test_url text NOT NULL DEFAULT '',
  live_url text NOT NULL DEFAULT '',
  twin_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.webhook_settings (active_mode) VALUES ('test');

ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/update
CREATE POLICY "Admins can select webhook_settings"
  ON public.webhook_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update webhook_settings"
  ON public.webhook_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public read for the booking widget to fetch active URL
CREATE POLICY "Anyone can read webhook_settings"
  ON public.webhook_settings FOR SELECT TO anon
  USING (true);

-- Webhook logs
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url text NOT NULL,
  mode text NOT NULL,
  label text NOT NULL DEFAULT '',
  status_code integer,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select webhook_logs"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert webhook_logs"
  ON public.webhook_logs FOR INSERT TO anon, authenticated
  WITH CHECK (true);
