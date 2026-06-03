-- Change 2: Time windows — move from hardcoded frontend to DB so admin can configure them

CREATE TABLE IF NOT EXISTS public.time_windows (
  id          text        PRIMARY KEY,
  label       text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_windows_read_all" ON public.time_windows
  FOR SELECT USING (true);

CREATE POLICY "time_windows_admin_write" ON public.time_windows
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

INSERT INTO public.time_windows (id, label, sort_order) VALUES
  ('morning',   '8:00 AM – 12:00 PM', 1),
  ('afternoon', '12:00 PM – 4:00 PM', 2),
  ('evening',   '4:00 PM – 8:00 PM',  3)
ON CONFLICT (id) DO NOTHING;
