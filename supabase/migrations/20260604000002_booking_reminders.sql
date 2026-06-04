-- Booking reminder pg_cron jobs
-- Runs every hour; fires send-reminder edge function for upcoming bookings
-- Only sends if addon_booking_reminders_enabled = 'true' in app_settings

-- 48-hour reminder job
SELECT cron.schedule(
  'booking-reminder-48h',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body    := json_build_object('type', '48h', 'booking_id', id)::text
  )
  FROM public.bookings
  WHERE status = 'confirmed'
    AND schedule_date = (CURRENT_DATE + INTERVAL '2 days')::date
    AND reminder_48h_sent = false;
  $$
);

-- 2-hour reminder job
SELECT cron.schedule(
  'booking-reminder-2h',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body    := json_build_object('type', '2h', 'booking_id', id)::text
  )
  FROM public.bookings
  WHERE status = 'confirmed'
    AND schedule_date = CURRENT_DATE
    AND reminder_2h_sent = false;
  $$
);

-- Review request job — runs daily at 10am, targets bookings from yesterday
SELECT cron.schedule(
  'review-request',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-review-request',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body    := json_build_object('booking_id', id)::text
  )
  FROM public.bookings
  WHERE status = 'confirmed'
    AND schedule_date = (CURRENT_DATE - INTERVAL '1 day')::date;
  $$
);
