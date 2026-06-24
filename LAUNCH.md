# 🦬 Bison Junk Hauling — Corrected Launch Guide

The Saturday plan is solid, but **five details don't match how this system is actually built.**
Follow this version — it deploys the same thing, just correctly.

> ⚠️ I could not verify the live Supabase backend from my environment (network is
> sandboxed). The "ALREADY DONE" claims (360 items, functions deployed, keys set)
> need confirming — run `bash scripts/live-test.sh` from your machine to check them
> in 30 seconds. Everything below is verified against the actual code.

---

## Correction 1 — It's ONE app, not two folders

There is no `deploy/admin/` and `deploy/widget/`. This is a single build. **Deploy the
`dist/` folder once** and you get both:

| What | URL after deploy |
|---|---|
| Admin portal | `https://<your-site>.netlify.app/admin` |
| Booking widget | `https://<your-site>.netlify.app/embed` ← put THIS in the client's iframe |

**Thursday Step 1+2 (replaces both):** drag the **`dist/`** folder onto
https://app.netlify.com/drop. One drop, one URL. Done.

(The `_redirects` file is already inside `dist/` — without it, refreshing `/admin`
shows a blank 404. That was the #1 thing that would have broken your demo.)

Embed code for the client's site:
```html
<iframe src="https://<your-site>.netlify.app/embed"
        width="100%" height="900" frameborder="0"
        style="border-radius:12px"></iframe>
```

---

## Correction 2 — Creating the auth user is NOT enough to log into admin (CRITICAL)

The admin portal checks the **`user_roles`** table — a Supabase auth user with no admin
role will log in, then get bounced straight back to /login. After Thursday Step 3
(Add User), run this once in **Supabase → SQL Editor**:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where email = 'admin@bisonjunkhauling.com'
on conflict do nothing;
```

Then Step 4 (test admin login) will actually work.

---

## Correction 3 — Test card `4242` only works in TEST mode

The plan says "you're already on LIVE (pk_live_)" **and** "use test card 4242" — those
contradict. `4242 4242 4242 4242` is **declined on live keys.**

- **Friday dress rehearsal:** Admin → **Payments** → set mode to **Test**, with
  `pk_test_…` / `sk_test_…`. Now 4242 works end-to-end, no real money.
- **Going live (Saturday or after):** switch mode to **Live**, `pk_live_…` / `sk_live_…`,
  and test with a **real card** (you can refund yourself from the Stripe Dashboard —
  this system has no refund code by design).

You cannot prove the money flow with 4242 on live keys. Pick test for the rehearsal.

---

## Correction 4 — Email is SMTP-first, not Resend

We send confirmation emails directly via Gmail/Outlook SMTP (Resend is only a fallback).
"No confirmation email" is fixed by **either**:

- **Preferred:** Admin → **Setup → Email** → connect Gmail/Outlook with an App Password →
  "Send Test Email". This stores `EMAIL_HOST/USER/PASSWORD/FROM_NAME` for you.
- **Or:** set `RESEND_API_KEY` in Edge Function secrets.

If neither is set, bookings still save — only the email is skipped (logged as
`email.failed` in the Events tab).

---

## Correction 5 — The confirmation email fires from the Stripe webhook

Emails now send **server-side from the `stripe-webhook` function**, not the browser. For
the email to arrive **instantly**, the Stripe webhook must be registered and
`STRIPE_WEBHOOK_SECRET` set. The easiest way — it does this automatically:

> Admin → **Setup → Stripe** → paste keys → **"Connect Stripe & Auto-Register Webhook"**

If the webhook isn't registered, bookings still confirm and the email still goes out, but
via the reconciliation cron **within ~15 min**, not instantly. For a live demo, register it.

(Auto key-storage needs a one-time `SUPABASE_ACCESS_TOKEN` secret — see Setup → Go Live.)

---

## The fastest correct path (use the built-in Setup wizard)

Most of Thursday's manual steps are a wizard already: **Admin → Setup**:
1. **Brand** — name, logo, color
2. **Stripe** — paste keys, auto-registers webhook ✅ (Corrections 3 + 5)
3. **Email** — Gmail/Outlook + test send ✅ (Correction 4)
4. **Service Area** — ZIP restrictions on/off
5. **Go Live** — health checks, embed code, **Run Test Booking** (the 4242 flow)

---

## Pre-flight checklist (run from your machine, has network)

```bash
git pull
bash scripts/live-test.sh      # confirms catalog, ZIPs, payment-intent, webhook, email lockdown
npm run build                  # already clean; produces dist/ to drag to Netlify
```

| Verify | How |
|---|---|
| 360 catalog items / 102 ZIPs really exist | `live-test.sh` T2/T3, or admin Catalog tab |
| Edge functions deployed | `live-test.sh` T4/T7, or Supabase dashboard |
| Stripe mode matches your card (test↔4242, live↔real) | Admin → Payments |
| Admin user has `admin` role | SQL in Correction 2 |
| Webhook registered | Setup → Stripe → Connect, or Stripe Dashboard → Webhooks |
| Email connected | Setup → Email → Send Test Email |

When all six are green, you're ready for Saturday.
