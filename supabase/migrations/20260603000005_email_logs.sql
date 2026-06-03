-- Change 7: Email delivery logging for confirmation emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref text,
  recipient   text        NOT NULL,
  subject     text,
  status      text        NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_logs_booking_ref_idx ON public.email_logs (booking_ref);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx  ON public.email_logs (created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_admin_read" ON public.email_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
