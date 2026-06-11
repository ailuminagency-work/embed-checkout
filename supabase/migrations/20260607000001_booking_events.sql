-- Internal event system: booking_events table + optional outbound webhook +
-- 5-minute reconciliation cron. The system confirms bookings and sends emails
-- itself — Make.com/Zapier is now an optional outbound add-on only.

-- ── booking_events: every state change in the system is recorded here ─────────
CREATE TABLE IF NOT EXISTS public.booking_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid        REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,
  -- 'booking.confirmed', 'booking.cancelled', 'booking.abandoned',
  -- 'email.sent', 'email.failed', 'outbound_webhook.sent', 'outbound_webhook.failed',
  -- 'reconciliation.auto_confirmed', 'stripe_webhook.rejected', ...
  payload     jsonb       NOT NULL DEFAULT '{}',
  source      text        NOT NULL DEFAULT 'system',
  -- 'stripe_webhook', 'reconciliation', 'admin', 'system', 'browser'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON public.booking_events (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_type ON public.booking_events (event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON public.booking_events (created_at DESC);

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

-- Edge functions write via service role (bypasses RLS); admins read from the panel.
CREATE POLICY "admin_read_booking_events" ON public.booking_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Realtime for the admin live event feed (idempotent)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_events;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ── Optional outbound webhook settings (Make.com / Zapier as add-on) ─────────
INSERT INTO public.app_settings (key, value) VALUES
  ('outbound_webhook_url',    ''),
  ('outbound_webhook_secret', '')
ON CONFLICT (key) DO NOTHING;

-- ── Reconciliation safety net: every 5 minutes ────────────────────────────────
-- Confirms any paid-but-unconfirmed bookings missed by the Stripe webhook
-- (webhook not registered yet, transient DB failure, etc.)
SELECT cron.schedule(
  'booking-reconciliation',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/reconcile-bookings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body    := '{}'
  )
  WHERE EXISTS (
    SELECT 1 FROM public.pending_bookings
    WHERE status = 'pending'
      AND payment_intent_id IS NOT NULL
      AND created_at < NOW() - INTERVAL '10 minutes'
      AND expires_at > NOW()
  );
  $$
);
