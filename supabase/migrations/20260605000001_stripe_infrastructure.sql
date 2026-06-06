-- pending_bookings: stores full booking data before payment completes.
-- Webhook handler uses this to recover if browser crashes after payment.

CREATE TABLE IF NOT EXISTS public.pending_bookings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_data      jsonb       NOT NULL,
  payment_intent_id text,
  stripe_mode       text        NOT NULL DEFAULT 'test' CHECK (stripe_mode IN ('test', 'live')),
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT now() + INTERVAL '2 hours'
);

CREATE INDEX IF NOT EXISTS pending_bookings_payment_intent_idx ON public.pending_bookings (payment_intent_id);
CREATE INDEX IF NOT EXISTS pending_bookings_status_idx         ON public.pending_bookings (status, expires_at);

ALTER TABLE public.pending_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert_pending_bookings" ON public.pending_bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read_pending_bookings" ON public.pending_bookings
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_pending_bookings" ON public.pending_bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- payment_events: immutable audit log of every Stripe event.

CREATE TABLE IF NOT EXISTS public.payment_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id text        NOT NULL,
  event_type        text        NOT NULL,
  stripe_mode       text        NOT NULL DEFAULT 'test',
  amount_cents      integer,
  currency          text        DEFAULT 'usd',
  customer_email    text,
  customer_ip       text,
  error_code        text,
  error_message     text,
  stripe_event_id   text        UNIQUE,
  raw_event         jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_intent_idx ON public.payment_events (payment_intent_id);
CREATE INDEX IF NOT EXISTS payment_events_ip_idx     ON public.payment_events (customer_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_type_idx   ON public.payment_events (event_type, created_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_payment_events" ON public.payment_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Add Stripe columns to bookings table

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_mode        text    DEFAULT 'test' CHECK (stripe_mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS payment_intent_id  text,
  ADD COLUMN IF NOT EXISTS amount_cents       integer,
  ADD COLUMN IF NOT EXISTS currency           text    DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS refund_id          text,
  ADD COLUMN IF NOT EXISTS refunded_at        timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer,
  ADD COLUMN IF NOT EXISTS terms_accepted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version      text,
  ADD COLUMN IF NOT EXISTS customer_ip        text,
  ADD COLUMN IF NOT EXISTS source             text    DEFAULT 'browser' CHECK (source IN ('browser', 'stripe_webhook', 'manual'));

CREATE INDEX IF NOT EXISTS bookings_payment_intent_idx ON public.bookings (payment_intent_id);
