-- Stores all completed booking submissions
CREATE TABLE IF NOT EXISTS public.bookings (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             text        NOT NULL UNIQUE,
  service_type          text        NOT NULL,
  status                text        NOT NULL DEFAULT 'confirmed',
  customer_name         text,
  customer_email        text,
  customer_phone        text,
  customer_address      text,
  customer_address2     text,
  customer_zip          text,
  customer_property_type text,
  customer_gate_code    text,
  schedule_date         date,
  schedule_time_window  text,
  items                 jsonb       NOT NULL DEFAULT '[]',
  custom_items          jsonb       NOT NULL DEFAULT '[]',
  item_total            numeric     NOT NULL DEFAULT 0,
  photo_promo_discount  numeric     NOT NULL DEFAULT 0,
  adjusted_item_total   numeric     NOT NULL DEFAULT 0,
  minimum_price         numeric,
  final_total           numeric     NOT NULL DEFAULT 0,
  amount_charged        numeric     NOT NULL DEFAULT 0,
  deposit_mode          boolean     NOT NULL DEFAULT false,
  payment_id            text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_insert_anon" ON public.bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "bookings_admin_select" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "bookings_admin_update" ON public.bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
