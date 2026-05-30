-- Enable pg_net for async HTTP from triggers (already enabled in Supabase by default)
create extension if not exists pg_net schema extensions;

-- Webhook delivery queue for reliable tracking + retry
create table if not exists public.webhook_queue (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid references public.bookings(id) on delete cascade,
  event_type   text not null,
  status       text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempts     integer not null default 0,
  last_error   text,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists webhook_queue_status_idx on public.webhook_queue (status, created_at desc);
create index if not exists webhook_queue_booking_idx on public.webhook_queue (booking_id);

alter table public.webhook_queue enable row level security;

create policy "admin_manage_webhook_queue" on public.webhook_queue
  for all
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Trigger: booking created → deliver-webhook edge function
create trigger "webhook-on-booking-created"
  after insert on public.bookings
  for each row
  execute function supabase_functions.http_request(
    'https://jigtcyjgolqxlmavifxv.supabase.co/functions/v1/deliver-webhook',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3RjeWpnb2xxeGxtYXZpZnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDQ3ODUsImV4cCI6MjA5NTU4MDc4NX0.lwwXXtI3bkH4jUCaujSaYtAzlRSBf1Yzx6B7lB2rfTc"}',
    '{}',
    '5000'
  );

-- Trigger: booking cancelled → deliver-webhook edge function (only when status changes TO cancelled)
create trigger "webhook-on-booking-cancelled"
  after update on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function supabase_functions.http_request(
    'https://jigtcyjgolqxlmavifxv.supabase.co/functions/v1/deliver-webhook',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3RjeWpnb2xxeGxtYXZpZnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDQ3ODUsImV4cCI6MjA5NTU4MDc4NX0.lwwXXtI3bkH4jUCaujSaYtAzlRSBf1Yzx6B7lB2rfTc"}',
    '{}',
    '5000'
  );
