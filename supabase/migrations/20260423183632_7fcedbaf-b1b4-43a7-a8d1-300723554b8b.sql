DROP POLICY IF EXISTS "Anyone can insert webhook_logs" ON public.webhook_logs;

CREATE POLICY "Anyone can insert webhook_logs"
ON public.webhook_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  webhook_url ~ '^https?://.+'
  AND mode IN ('test', 'live')
  AND success IN (true, false)
  AND (label IS NULL OR char_length(label) <= 255)
  AND (status_code IS NULL OR (status_code >= 100 AND status_code <= 599))
  AND (error_message IS NULL OR char_length(error_message) <= 2000)
);