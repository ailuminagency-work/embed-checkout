-- Admin-managed dates on which service is unavailable
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date        NOT NULL UNIQUE,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_dates_read_all" ON public.blocked_dates
  FOR SELECT USING (true);

CREATE POLICY "blocked_dates_admin_write" ON public.blocked_dates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
