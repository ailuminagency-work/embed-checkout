-- QuickBooks Online integration (optional add-on).
--
-- SECURITY: app_settings is publicly readable (the widget loads config from it),
-- so OAuth tokens and the client secret must NOT live there. They go in
-- integration_secrets — admin-only RLS, edge functions read via service role.
-- Only non-sensitive flags (connected, environment, realm/company id) are in
-- app_settings so the add-on registry can show status.

-- ── integration_secrets: credentials for third-party integrations ────────────
CREATE TABLE IF NOT EXISTS public.integration_secrets (
  key        text        PRIMARY KEY,
  value      text        NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

-- Admins manage from the panel; NO public read. Service role bypasses RLS.
CREATE POLICY "admin_manage_integration_secrets" ON public.integration_secrets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

INSERT INTO public.integration_secrets (key, value) VALUES
  ('quickbooks_client_id', ''),
  ('quickbooks_client_secret', ''),
  ('quickbooks_access_token', ''),
  ('quickbooks_refresh_token', ''),
  ('quickbooks_token_expires_at', ''),
  ('quickbooks_refresh_token_updated_at', ''),
  ('quickbooks_oauth_state', '')
ON CONFLICT (key) DO NOTHING;

-- ── Non-sensitive QuickBooks flags (safe for public read) ────────────────────
INSERT INTO public.app_settings (key, value) VALUES
  ('quickbooks_connected',         ''),          -- '' or 'true' — drives add-on status
  ('quickbooks_environment',       'sandbox'),   -- 'sandbox' or 'production'
  ('quickbooks_realm_id',          ''),          -- QBO Company ID (not secret)
  ('quickbooks_income_account_id', ''),          -- optional income account ref
  ('quickbooks_service_item_id',   '')           -- optional service item ref
ON CONFLICT (key) DO NOTHING;

-- ── quickbooks_log: every sync attempt ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quickbooks_log (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  reference             text,
  qbo_sales_receipt_id  text,
  qbo_customer_id       text,
  status                text        NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qbo_log_booking ON public.quickbooks_log (booking_id);
CREATE INDEX IF NOT EXISTS idx_qbo_log_status  ON public.quickbooks_log (status, created_at DESC);

ALTER TABLE public.quickbooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_quickbooks_log" ON public.quickbooks_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- ── Daily token refresh: keeps the 100-day refresh token rolling forever ─────
SELECT cron.schedule(
  'quickbooks-token-check',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/quickbooks-token-refresh',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body    := '{}'
  )
  WHERE EXISTS (
    SELECT 1 FROM public.app_settings
    WHERE key = 'quickbooks_connected' AND value = 'true'
  );
  $$
);
