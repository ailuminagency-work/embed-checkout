-- Remove the anon read policy on webhook_settings.
-- Webhook URLs are secrets and should only be read server-side (Edge Function).
-- Admins can still read/write via the existing authenticated policies.
DROP POLICY IF EXISTS "Anyone can read webhook_settings" ON public.webhook_settings;

-- Tighten webhook_logs insert: cap field lengths to prevent log flooding.
DROP POLICY IF EXISTS "Anyone can insert webhook_logs" ON public.webhook_logs;

CREATE POLICY "Anyone can insert webhook_logs"
  ON public.webhook_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(webhook_url) <= 2048
    AND char_length(mode) <= 10
    AND char_length(label) <= 100
    AND (error_message IS NULL OR char_length(error_message) <= 1000)
  );
