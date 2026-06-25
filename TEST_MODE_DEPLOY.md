# 🧪 Bison Junk Hauling — Test-Mode Deploy (Saturday rehearsal)

Goal: deploy the app and put Stripe in **Test mode** so `4242 4242 4242 4242`
works end-to-end with **no real money**. Verified against the actual code.

---

## 1. The build is done ✅

`dist/` is built and ready (`npm run build`, clean). It contains:

- `dist/_redirects` → `/*  /index.html  200`  (without this, refreshing `/admin` 404s — it's present)
- `/embed`  → the booking widget (put THIS in the client iframe)
- `/admin`  → the admin portal

**Deploy:** drag the **`dist/`** folder onto https://app.netlify.com/drop → one URL.

```
Admin :  https://<your-site>.netlify.app/admin
Widget:  https://<your-site>.netlify.app/embed
```

---

## 2. Put Stripe in TEST mode — two places must agree

Mode is read from the database (`app_settings`) by **both** the browser (publishable key)
and the `create-payment-intent` edge function (secret key). Set both:

### a) Database — run in Supabase → SQL Editor

```sql
-- Switch the whole system to TEST mode + set the test publishable key
insert into public.app_settings (key, value) values
  ('stripe_mode',                 'test'),
  ('stripe_publishable_key_test', 'pk_test_REPLACE_ME')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

> Code path: `useAppConfig.ts:104-109` resolves the publishable key from
> `stripe_publishable_key_test` when `stripe_mode = 'test'`.

### b) Supabase secret — Edge Functions → Secrets

```
STRIPE_SECRET_KEY_TEST = sk_test_REPLACE_ME
```

> Code path: `create-payment-intent/index.ts:45-48` reads `STRIPE_SECRET_KEY_TEST`
> in test mode (falls back to `STRIPE_SECRET_KEY`). If you only ever use one key,
> you can instead set `STRIPE_SECRET_KEY = sk_test_…` — but never leave an
> `sk_live_…` there while `stripe_mode = 'test'`, or the keys won't match.

**Easier alternative to the SQL:** Admin → **Payments** → toggle to **Test**,
paste `pk_test_…`, Save. Same effect as the SQL above.

---

## 3. (For instant confirmation email) register the TEST webhook — optional

Bookings confirm and email **either way**. With the webhook → instant. Without it →
the reconcile cron confirms within ~15 min.

- Stripe Dashboard (in **Test mode**) → Webhooks → add endpoint
  `https://jigtcyjgolqxlmavifxv.supabase.co/functions/v1/stripe-webhook`
  → event `payment_intent.succeeded` → copy signing secret
- Supabase secret: `STRIPE_WEBHOOK_SECRET_TEST = whsec_…`
  (the webhook verifies against test/live/simple secrets — `stripe-webhook/index.ts:114-116`)
- Or just use Admin → Setup → Stripe → "Connect & Auto-Register Webhook".

---

## 4. Don't forget the admin role (or login bounces to /login)

After creating the auth user (Supabase → Authentication → Add User):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where email = 'admin@bisonjunkhauling.com'
on conflict do nothing;
```

---

## 5. Test the money flow

1. Open `https://<your-site>.netlify.app/embed`
2. Build a booking → on Review & Pay use card **`4242 4242 4242 4242`**, any future
   expiry, any CVC, any ZIP.
3. Admin → Bookings: the booking appears with a **`test`** mode badge.
4. (If webhook set) confirmation email arrives; otherwise within ~15 min.

✅ Green = ready. To go live later: flip Admin → Payments to **Live**, paste
`pk_live_…`, set `STRIPE_SECRET_KEY_LIVE`, and test with a **real** card (4242 is
declined on live keys).

---

### Note on what I could NOT verify from here

This environment is network-sandboxed, so I could not reach the live
`jigtcyjgolqxlmavifxv` backend. The "already done" claims (catalog items, ZIPs,
deployed functions, existing secrets) need confirming from your machine:

```bash
bash scripts/live-test.sh
```
