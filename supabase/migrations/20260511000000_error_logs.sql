CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  component TEXT,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (error boundary fires client-side)
CREATE POLICY "Anyone can insert error logs"
  ON public.error_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(message) <= 2000
    AND (stack IS NULL OR char_length(stack) <= 10000)
    AND (component IS NULL OR char_length(component) <= 255)
    AND (context IS NULL OR char_length(context) <= 10000)
  );

-- Only admins can read
CREATE POLICY "Admins can read error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
