# Embed-Checkout — Complete System Report

**Generated:** June 11, 2026 · **Commit:** `efe7418` · **Repo:** github.com/ailuminagency-work/embed-checkout
**Health:** TypeScript 0 errors · ESLint 0 errors · Tests 20/20 passing · Build clean (main chunk 130 kB gzip)

---

## 1. What This System Is

A **white-label, embeddable booking-and-checkout product** for local service businesses (junk removal, donation pickup — extensible to any service type). A business drops one `<script>` tag on their website and gets a complete 5-step booking funnel with real Stripe payments, automatic confirmation emails, an admin panel, and optional integrations (QuickBooks, Make.com, Twilio SMS, Google Analytics/Ads).

It is architected as a **self-contained event processor**: no third-party automation tool (Make.com/Zapier) sits in the critical path. The system confirms bookings, takes payment, sends email, and keeps books in sync entirely on its own.

**Distribution model:** one codebase, many client installs. Each client gets their own Supabase project; all client-specific configuration (branding, pricing, keys, features) lives in the database — zero code changes per client. `scripts/setup.mjs` is the one-command installer.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | Supabase: PostgreSQL, 18 Deno Edge Functions, Storage, Realtime, pg_cron, pg_net |
| Payments | Stripe PaymentIntents (server-side amounts, webhooks, 3-D Secure) |
| Email | Gmail/Outlook SMTP (denomailer) with Resend fallback |
| SMS | Twilio (optional add-on) |
| Accounting | QuickBooks Online API with OAuth2 (optional add-on) |
| Analytics | GA4 + Google Ads + GTM dataLayer (optional add-on) |
| Testing | Vitest (20 unit tests) + `scripts/live-test.sh` (10 live API tests) |

**Build targets:** standard SPA (`npx vite build`, code-split into 6 vendor chunks) and embeddable widget (`BUILD_TARGET=widget` → single IIFE `widget.js`).

---

## 3. Customer Booking Flow (the widget)

Five steps, mobile-first, persisted to localStorage so refreshes don't lose progress:

1. **Service Type** — junk removal / donation pickup (admin-configurable via `service_types` table) + ZIP code check. Out-of-area ZIPs get a "contact us" message; in-area ZIPs may carry a minimum service charge (`zip_pricing`).
2. **Item Catalog** — admin-managed items with photos and prices, quantity selection, custom item descriptions, optional photo upload (earns a configurable % discount).
3. **Schedule** — date picker honoring `blocked_dates`, daily job capacity, and admin-defined `time_windows`.
4. **Customer Details** — name/phone/email/address/property type/gate code/notes + promo code entry (if the add-on is enabled).
5. **Review & Pay** — terms acceptance (timestamped + versioned for compliance), Stripe card form. Without a Stripe key configured, a demo payment form renders instead.

A live order summary (desktop sidebar / mobile bottom bar) shows itemized pricing: item total → photo discount → promo discount → ZIP minimum enforcement → deposit (if deposit mode) → total due.

Languages: English + Spanish via a custom lightweight i18n layer (`widget_language` setting).

---

## 4. Payment Architecture (Stripe)

**Trust model: the browser is never trusted with money.**

```
Browser                    create-payment-intent (Edge Fn)         Stripe
   │  cart + booking_data ──►  rate limit (3 fails/IP/hr)
   │                           capacity check for the date
   │                           prices re-fetched from catalog_items  ── amounts
   │                           ZIP minimum + photo promo + deposit      computed
   │                           pending_bookings row saved (recovery)    SERVER-SIDE
   │  ◄── client_secret,       PaymentIntent created ────────────────►
   │      verified_amount
   │  confirmCardPayment ───────────────────────────────────────────►
   │  booking row saved (fast UX)
   │                                            payment_intent.succeeded
   │                           stripe-webhook  ◄──────────────────────
   │                             signature verified (HMAC)
   │                             booking confirmed (or crash-recovered)
   │                             email sent · events logged · QBO synced
```

**Resilience layers (a paid customer can never be lost):**
1. Browser saves the booking immediately (fast path).
2. If the browser crashes after payment → **stripe-webhook** recreates the booking from `pending_bookings` (full booking payload stored *before* charging).
3. If the webhook is missed entirely → **reconcile-bookings cron (every 5 min)** asks Stripe directly about stale pending payments and auto-confirms succeeded ones, duplicate-safe.
4. **reconcile-payments cron (daily)** sweeps the last 24 h of Stripe PaymentIntents for orphans and emails the admin.
5. Every Stripe event is recorded in the immutable `payment_events` audit log, idempotent via unique `stripe_event_id`.

**Other payment features:** test/live mode switch (publishable keys in admin, secret keys in Supabase secrets only), deposit mode (charge N% upfront), refunds (`refund-booking` function + self-serve cancellation window + Stripe Dashboard), 3-D Secure automatic, receipt emails, per-booking audit fields (`terms_accepted_at`, `terms_version`, `customer_ip`, `source`, `stripe_mode`, `amount_cents`).

---

## 5. Internal Event System & Email

- **`booking_events` table** records every state change (`booking.confirmed`, `email.sent/failed`, `outbound_webhook.*`, `quickbooks.*`, `reconciliation.auto_confirmed`, …) with source attribution. Realtime-enabled.
- **Admin Events feed** — live-updating stream with filters (Confirmed / Email / Webhooks / Errors), color-coded status, expandable JSON payloads.
- **Email** is sent by the system itself: SMTP via Gmail/Outlook App Password (`EMAIL_*` secrets) with Resend as fallback. Itemized HTML template with branding, pricing breakdown, deposit balance, cancellation link. One email per booking guaranteed (idempotency via `email.sent` event). Logged to `email_logs`.
- **`send-confirmation` is internal-only** (service-role): the browser cannot trigger emails. Fires SMS afterward if Twilio is configured.
- **Outbound webhooks (Make.com/Zapier) are optional add-ons**, fired best-effort after confirmation: the legacy trigger-based system (`webhook_queue` with 3 retries + permanent-failure admin alerts) plus a simple `outbound_webhook_url` setting with HMAC-SHA256 signing. If they fail, the booking is unaffected.

---

## 6. Database (15 tables)

| Table | Purpose |
|---|---|
| `bookings` | Confirmed bookings — customer, schedule, items, full pricing breakdown, Stripe fields, terms audit, cancel token |
| `pending_bookings` | Pre-payment booking payloads — the crash-recovery safety net (2 h expiry) |
| `payment_events` | Immutable Stripe event audit log (also powers IP rate limiting) |
| `booking_events` | Internal event log for every state change (realtime) |
| `app_settings` | All runtime config — branding, pricing rules, keys, feature flags (public-read by design; **no secrets**) |
| `integration_secrets` | OAuth tokens & client secrets (QuickBooks) — **admin-only RLS** |
| `catalog_items` | Service items with prices, images, ordering |
| `zip_pricing` | Service-area ZIPs with minimum prices |
| `service_types` | Configurable service offerings |
| `time_windows` | Configurable arrival windows |
| `blocked_dates` | Unavailable dates |
| `promo_codes` | Discount codes (percent/fixed, max uses, expiry) |
| `webhook_queue` + `webhook_logs` | Outbound delivery tracking with retries |
| `email_logs` | Every email attempt |
| `quickbooks_log` | Every QBO sync attempt |
| `api_keys` | Hashed keys for the public REST API |
| `admin_users` / `user_roles` | Admin access control (drives all RLS) |
| `app_images` | Uploaded branding/catalog images |

All tables have RLS. Pattern: public read only where the widget needs it; admin-gated writes; service-role-only for sensitive logs.

## 7. Edge Functions (18)

| Function | Role | Auth |
|---|---|---|
| `create-payment-intent` | Server-side pricing + PaymentIntent + pending booking | anon JWT |
| `stripe-webhook` | Booking confirmation authority (signature-verified) | none (HMAC) |
| `reconcile-bookings` | 5-min payment/booking reconciler | service role |
| `reconcile-payments` | Daily Stripe orphan sweep + admin alert | service role |
| `refund-booking` | Admin/self-serve refunds with window policy | JWT |
| `cancel-booking` | Self-serve cancellation via emailed token | anon JWT |
| `send-confirmation` | Email + SMS dispatcher (idempotent) | **service role only** |
| `send-sms` / `send-reminder` / `send-review-request` | Twilio SMS, 48h/2h reminders, Google review asks | service role / cron |
| `send-admin-alert` | Generic admin notification email | service role |
| `deliver-webhook` | Outbound Make.com/Zapier delivery w/ retries | JWT |
| `get-catalog` | Public catalog for the widget | none |
| `v1` | Public REST API (API-key authenticated) | API key |
| `quickbooks-oauth-initiate` / `-callback` | Intuit OAuth2 connect flow (CSRF-protected) | JWT / none (state) |
| `create-qbo-receipt` | QBO Sales Receipt creation (idempotent) | service role |
| `quickbooks-token-refresh` | Daily token roll | service role |

## 8. Scheduled Jobs (8 pg_cron)

| Job | Schedule | Does |
|---|---|---|
| `booking-reconciliation` | every 5 min | Confirm bookings Stripe says are paid but DB doesn't have |
| `cleanup-pending-bookings` | every 30 min | Expire stale pending bookings |
| `retry-failed-webhooks` | periodic | Re-deliver failed outbound webhooks (max 3) |
| `booking-reminder-48h` / `-2h` | hourly | Customer email reminders (add-on gated) |
| `review-request` | daily 10am | Post-service Google review emails (add-on gated) |
| `reconcile-stripe-payments` | daily 7am | Orphaned payment sweep + admin alert |
| `quickbooks-token-check` | daily 8am | Force-refresh QBO tokens so the 100-day refresh token never dies |

---

## 9. Admin Panel (16 sections, `/admin`)

**Operations:** Bookings (stats, search, filters, CSV export, detail sheet with cancel/replay-webhook) · Events (live feed) · Catalog (inline editing, image upload, drag-reorder) · ZIP Pricing · Date Blocking · Time Windows · Service Types

**Customise:** Theme (colors/radius, applied live via CSS variables) · Images · Webhooks (URLs, test/live mode, delivery logs, test-fire)

**Integrations:** Payments & Stripe (mode toggle, key validation, deposit %, refund window, terms version, payment events log) · API Keys · Analytics (GA4/Ads/GTM) · Add-ons · Setup & Onboarding (health checks: Stripe, ZIPs, webhooks, email)

Auth: Supabase email/password + `admin_users` role check; non-admins are redirected.

## 10. Add-ons (10 — coded, gated, zero-config-off)

Every add-on is fully built but **silently inactive** until credentials/toggles are set: SMS Confirmations (Twilio) · Booking Reminders · Self-Serve Cancellation (+refund window) · Review Requests · Promo Codes (+management UI) · Customer Portal (flag) · Google Analytics · Google Ads Conversions · Multi-Language (en/es) · **QuickBooks Online** (OAuth connect, auto Sales Receipts, customer dedupe, sandbox/production, sync log).

## 11. Public REST API

`/functions/v1/v1` with hashed API keys (admin-managed): programmatic access to bookings/catalog for client integrations.

---

## 12. Security Posture

- Amounts always computed server-side from DB prices; client prices ignored
- Stripe webhook HMAC signature verification (multi-secret: simple + test/live)
- Secret keys (`sk_`, `whsec_`, SMTP, QBO tokens) **only** in Supabase secrets / `integration_secrets` (admin-RLS) — never in public `app_settings`, never in the repo
- `send-confirmation`, `reconcile-*`, `create-qbo-receipt` locked to service role
- IP rate limiting on payment attempts (3 failed/hr → 429)
- QBO OAuth protected by single-use CSRF state
- Outbound webhooks HMAC-signed when a secret is set
- Idempotency everywhere: Stripe events (unique event id), emails (event guard), QBO receipts (sync-log guard), reconciler (existing-booking check)
- Terms acceptance recorded with timestamp + version + IP per booking
- No PII in analytics events

**Known accepted risks:** Twilio/GA keys still live in public-readable `app_settings` (legacy pattern — only QBO got the `integration_secrets` treatment); the anon key + project URL are committed in `.env` (standard for Supabase browser apps); `pending_bookings` has public read RLS (contains customer PII pre-payment — could be tightened to service-role only since the browser no longer reads it).

---

## 13. Quality & Verification Status

| Check | Status |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `eslint src` | ✅ 0 errors, 0 warnings |
| `vitest` | ✅ 20/20 (pricing math, ZIP validation, booking state, webhook payloads, deposit logic) |
| `vite build` | ✅ code-split, main chunk 130 kB gzip (was 1 MB monolith) |
| Live API test | `bash scripts/live-test.sh` — 10 tests against the deployed backend (settings, catalog, ZIPs, PaymentIntent creation + server-amount verification, empty-cart rejection, pending-booking creation, webhook signature enforcement, send-confirmation lockdown) |

---

## 14. What Still Requires Human Action (go-live checklist)

1. **Deploy latest:** `npx supabase db push && npx supabase functions deploy` (config.toml now disables JWT verification for stripe-webhook — required for Stripe to reach it)
2. **Register the Stripe webhook:** dashboard.stripe.com/webhooks → endpoint `https://jigtcyjgolqxlmavifxv.supabase.co/functions/v1/stripe-webhook` → event `payment_intent.succeeded` → put signing secret in Supabase secrets as `STRIPE_WEBHOOK_SECRET`
3. **Supabase Edge Function secrets:** `STRIPE_SECRET_KEY` (sk_live_…), `STRIPE_WEBHOOK_SECRET`, `EMAIL_HOST/PORT/USER/PASSWORD/FROM_NAME` (Gmail App Password) — without email secrets, confirmations log `email.failed` with an actionable message
4. **Admin → Payments:** enter live publishable key, switch mode to Live
5. **Run** `bash scripts/live-test.sh` from a machine with network access, then one real test payment with `4242 4242 4242 4242` in test mode
6. *(Optional)* Connect QuickBooks, Twilio, GA4, Make.com from the Add-ons/Analytics panels
