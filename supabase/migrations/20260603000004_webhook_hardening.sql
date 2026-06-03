-- Change 4: Webhook system hardening
-- 1. Fix the hardcoded anon JWT in DB triggers (that key is now compromised in public repo)
-- 2. Add 'permanently_failed' status to webhook_queue
-- 3. Add pg_cron retry schedule
--
-- REQUIRED SETUP:
--   Before applying this migration, add your service_role key to Supabase Vault:
--   Dashboard → Database → Vault → Add Secret → Name: WEBHOOK_TRIGGER_KEY → Value: <service_role_key>
--
-- Enable pg_cron extension (may need to be enabled via Dashboard → Database → Extensions first)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Expand webhook_queue status check constraint ───────────────────────────────
ALTER TABLE public.webhook_queue
  DROP CONSTRAINT IF EXISTS webhook_queue_status_check;

ALTER TABLE public.webhook_queue
  ADD CONSTRAINT webhook_queue_status_check
  CHECK (status IN ('pending', 'delivered', 'failed', 'permanently_failed'));

-- ── Drop old triggers with hardcoded anon JWT ──────────────────────────────────
DROP TRIGGER IF EXISTS "webhook-on-booking-created"  ON public.bookings;
DROP TRIGGER IF EXISTS "webhook-on-booking-cancelled" ON public.bookings;

-- ── Trigger function: reads key from Vault at runtime ─────────────────────────
-- The Vault secret name is WEBHOOK_TRIGGER_KEY — see setup note above.
-- If the secret is missing, a warning is logged and the trigger is skipped gracefully.
CREATE OR REPLACE FUNCTION public.fn_queue_webhook_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key  text;
  v_url  text;
  v_body jsonb;
BEGIN
  -- Read key from Vault (never hardcode secrets in SQL)
  SELECT decrypted_secret
  INTO   v_key
  FROM   vault.decrypted_secrets
  WHERE  name = 'WEBHOOK_TRIGGER_KEY'
  LIMIT  1;

  IF v_key IS NULL THEN
    RAISE WARNING '[webhook] WEBHOOK_TRIGGER_KEY not found in Vault — webhook skipped for booking %', NEW.id;
    RETURN NEW;
  END IF;

  v_url  := current_setting('app.supabase_url', true)
         || '/functions/v1/deliver-webhook';

  v_body := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(NEW)::jsonb,
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END
  );

  PERFORM extensions.net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := v_body::text
  );

  RETURN NEW;
END;
$$;

-- ── Recreate triggers using the new Vault-backed function ──────────────────────
CREATE TRIGGER "webhook-on-booking-created"
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_queue_webhook_delivery();

CREATE TRIGGER "webhook-on-booking-cancelled"
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.fn_queue_webhook_delivery();

-- ── pg_cron: retry failed webhooks every 5 minutes ────────────────────────────
-- Requires pg_cron to be enabled (see setup note above).
-- This calls deliver-webhook for each failed queue entry, up to 3 attempts.
SELECT cron.schedule(
  'retry-failed-webhooks',
  '*/5 * * * *',
  $$
    SELECT extensions.net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/deliver-webhook',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'WEBHOOK_TRIGGER_KEY' LIMIT 1
        )
      ),
      body    := json_build_object('booking_id', id)::text
    )
    FROM public.webhook_queue
    WHERE status = 'failed'
      AND attempts < 3
      AND created_at > NOW() - INTERVAL '24 hours'
  $$
);
