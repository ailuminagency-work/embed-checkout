-- Stripe-specific app_settings keys

INSERT INTO public.app_settings (key, value) VALUES
  ('stripe_publishable_key_test',  ''),
  ('stripe_publishable_key_live',  ''),
  ('stripe_mode',                  'test'),
  ('stripe_webhook_secret_test',   ''),
  ('stripe_webhook_secret_live',   ''),
  ('terms_version',                '1.0'),
  ('receipt_email_enabled',        'true'),
  ('refund_window_hours',          '24'),
  ('daily_job_capacity',           '999')
ON CONFLICT (key) DO NOTHING;

-- Cleanup expired pending bookings every 30 minutes
SELECT cron.schedule(
  'cleanup-pending-bookings',
  '*/30 * * * *',
  $$
    UPDATE public.pending_bookings
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW();
  $$
);

-- Stripe payment reconciliation — runs daily at 7am
SELECT cron.schedule(
  'reconcile-stripe-payments',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/reconcile-payments',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body    := '{}'
  );
  $$
);
