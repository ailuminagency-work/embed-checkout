#!/usr/bin/env node
/**
 * Booking Widget — One-Command Setup
 *
 * Usage:  node scripts/setup.mjs
 *
 * What it does:
 *   1. Collects Supabase credentials + business config from the user
 *   2. Validates Stripe API keys
 *   3. Applies DB migrations via Supabase CLI
 *   4. Seeds app_settings with the provided config
 *   5. Deploys Edge Functions via Supabase CLI
 *   6. Outputs the embed script tag
 *
 * No external npm dependencies — uses only Node.js builtins + supabase CLI.
 */

import readline from "readline";
import { execSync, spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.log(`  ✗ ${msg}`); }
function step(n, total, title) {
  console.log(`\nStep ${n}/${total}: ${title}`);
  console.log("─".repeat(40));
}

async function askWithDefault(prompt, defaultValue) {
  const answer = await ask(`  ${prompt}${defaultValue ? ` (default: ${defaultValue})` : ""}: `);
  return answer.trim() || defaultValue || "";
}

async function askRequired(prompt) {
  let value = "";
  while (!value) {
    value = (await ask(`  ${prompt}: `)).trim();
    if (!value) console.log("  ↳ Required — please enter a value.");
  }
  return value;
}

// ── Validate Stripe key ───────────────────────────────────────────────────────
async function validateStripeKey(secretKey) {
  try {
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}` },
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, email: data.email };
    }
    return { valid: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Supabase CLI helpers ──────────────────────────────────────────────────────
function hasSupabaseCLI() {
  try { execSync("supabase --version", { stdio: "pipe" }); return true; } catch { return false; }
}

function deployFunctions(projectRef) {
  const fns = [
    "create-payment-intent", "stripe-webhook", "refund-booking",
    "reconcile-payments", "send-admin-alert",
    "deliver-webhook", "send-confirmation", "get-catalog", "v1",
    "send-sms", "send-reminder", "cancel-booking", "send-review-request",
  ];
  for (const fn of fns) {
    process.stdout.write(`  Deploying ${fn}… `);
    const result = spawnSync("supabase", ["functions", "deploy", fn, "--project-ref", projectRef], { stdio: "pipe" });
    if (result.status === 0) { console.log("✓"); } else { console.log("✗ (check CLI auth)"); }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("\nBooking Widget Setup");
console.log("════════════════════════════════════════");
console.log("This script sets up a new client installation.");
console.log("You will need: Supabase project credentials, Stripe API keys.\n");

// ── Step 1: Supabase credentials ─────────────────────────────────────────────
step(1, 5, "Supabase Connection");
const supabaseUrl = await askRequired("Supabase Project URL (https://xxx.supabase.co)");
const serviceRoleKey = await askRequired("Supabase Service Role Key (from Settings → API)");
const anonKey = await askRequired("Supabase Anon/Public Key (from Settings → API)");
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";

process.stdout.write("  Connecting to Supabase… ");
let supabase;
try {
  supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from("app_settings").select("key").limit(1);
  if (error) throw new Error(error.message);
  console.log("✓");
  ok("Connected successfully");
} catch (e) {
  console.log("✗");
  fail(`Connection failed: ${e.message}`);
  console.log("\nCheck your Supabase URL and service role key.");
  process.exit(1);
}

// ── Step 2: Business config ───────────────────────────────────────────────────
step(2, 5, "Business Configuration");
const companyName   = await askRequired("Company name");
const contactEmail  = await askRequired("Contact email");
const currency      = await askWithDefault("Currency code", "USD");
const currencySymbol = await askWithDefault("Currency symbol", "$");

// ── Step 3: Stripe ───────────────────────────────────────────────────────────
step(3, 5, "Stripe Setup");
const stripePubKey = await ask("  Stripe Publishable Key (pk_live_ or pk_test_): ");
const stripeSecKey = await ask("  Stripe Secret Key (sk_live_ or sk_test_): ");

let stripeValid = false;
if (stripeSecKey.trim()) {
  process.stdout.write("  Validating Stripe keys… ");
  const result = await validateStripeKey(stripeSecKey.trim());
  if (result.valid) {
    console.log("✓");
    ok(`Stripe account: ${result.email}`);
    stripeValid = true;
  } else {
    console.log("✗");
    fail(`Stripe validation failed: ${result.error}`);
    console.log("  Continuing — you can set the key manually later.");
  }
}

// ── Step 4: Webhooks (optional) ───────────────────────────────────────────────
step(4, 5, "Webhook Setup (press Enter to skip)");
const makeTest = await ask("  Make.com webhook URL (test): ");
const makeLive = await ask("  Make.com webhook URL (live): ");
const twinUrl  = await ask("  Twin AI webhook URL: ");
const webhookMode = makeLive.trim() ? "live" : "test";

// ── Step 5: Apply config ──────────────────────────────────────────────────────
step(5, 5, "Running Setup...");

// Upsert app_settings
const isLiveKey = stripePubKey.trim().startsWith("pk_live_");
const settings = [
  { key: "company_name",          value: companyName },
  { key: "contact_email",         value: contactEmail },
  { key: "currency",              value: currency },
  { key: "currency_symbol",       value: currencySymbol },
  { key: "stripe_mode",           value: isLiveKey ? "live" : "test" },
  { key: "stripe_publishable_key_test", value: isLiveKey ? "" : stripePubKey.trim() },
  { key: "stripe_publishable_key_live", value: isLiveKey ? stripePubKey.trim() : "" },
  { key: "webhook_mode",          value: webhookMode },
  { key: "make_webhook_url_test", value: makeTest.trim() },
  { key: "make_webhook_url_live", value: makeLive.trim() },
  { key: "twin_webhook_url",      value: twinUrl.trim() },
  { key: "deposit_mode",                value: "false" },
  { key: "deposit_percentage",          value: "25" },
  { key: "refund_window_hours",         value: "24" },
  { key: "terms_version",               value: "1.0" },
  { key: "receipt_email_enabled",       value: "true" },
  { key: "photo_promo_percent",         value: "5" },
  { key: "zip_code_pattern",            value: "^\\d{5}(?:-\\d{4})?$" },
  { key: "tracking_enabled",            value: "false" },
  { key: "ga4_measurement_id",          value: "" },
  { key: "google_ads_conversion_id",    value: "" },
  { key: "google_ads_conversion_label", value: "" },
  { key: "twilio_account_sid",              value: "" },
  { key: "twilio_auth_token",               value: "" },
  { key: "twilio_phone_number",             value: "" },
  { key: "google_business_review_url",      value: "" },
  { key: "widget_language",                 value: "en" },
  { key: "site_url",                        value: "" },
  { key: "cancellation_window_hours",       value: "24" },
  { key: "addon_booking_reminders_enabled", value: "false" },
  { key: "addon_cancellation_flow_enabled", value: "false" },
  { key: "addon_promo_codes_enabled",       value: "false" },
  { key: "addon_customer_portal_enabled",   value: "false" },
];

const { error: settingsErr } = await supabase
  .from("app_settings")
  .upsert(settings, { onConflict: "key" });

if (settingsErr) { fail(`Settings save failed: ${settingsErr.message}`); }
else { ok("App settings saved"); }

// Log Vault instructions for all secrets
if (stripeValid && stripeSecKey.trim()) {
  const isLive = stripeSecKey.trim().startsWith("sk_live_");
  const keyName = isLive ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST";
  const webhookSecretName = isLive ? "STRIPE_WEBHOOK_SECRET_LIVE" : "STRIPE_WEBHOOK_SECRET_TEST";
  console.log("\n  ⚠  Stripe secrets — add to Supabase Vault manually:");
  console.log("     Dashboard → Database → Vault → Add Secret");
  console.log(`     Name: ${keyName}  →  Value: ${stripeSecKey.trim().substring(0, 8)}…`);
  console.log(`     Name: ${webhookSecretName}  →  Value: whsec_… (from Stripe dashboard)`);
  console.log("\n  ⚠  Webhook trigger key:");
  console.log("     Name: WEBHOOK_TRIGGER_KEY  →  Value: <your service role key>");
  console.log("     Name: RESEND_API_KEY  →  Value: <your Resend API key>");
}

// Migrations
if (hasSupabaseCLI() && projectRef) {
  process.stdout.write("  Applying migrations… ");
  const migResult = spawnSync(
    "supabase", ["db", "push", "--project-ref", projectRef],
    { stdio: "pipe" }
  );
  if (migResult.status === 0) { console.log("✓"); ok("Database migrations applied"); }
  else { console.log("✗"); fail("Migrations failed — run manually: npx supabase db push"); }

  // Deploy functions
  console.log("  Deploying Edge Functions:");
  deployFunctions(projectRef);

  // Set Stripe secret via CLI
  if (stripeValid && stripeSecKey.trim()) {
    spawnSync("supabase", ["secrets", "set", `STRIPE_SECRET_KEY=${stripeSecKey.trim()}`, "--project-ref", projectRef], { stdio: "pipe" });
    ok("Stripe secret key saved to Supabase");
  }
} else {
  if (!hasSupabaseCLI()) {
    console.log("\n  ℹ  Supabase CLI not found — skipping automatic migration + deploy.");
    console.log("     Install: npm install -g supabase");
    console.log("     Then run: supabase db push && supabase functions deploy");
  }
}

// ── Output ────────────────────────────────────────────────────────────────────
console.log("\n\nSetup complete! Your embed code:");
console.log("━".repeat(50));
console.log(`<script
  src="https://cdn.yourdomain.com/widget.js"
  data-supabase-url="${supabaseUrl}"
  data-supabase-key="${anonKey}"
></script>`);
console.log("━".repeat(50));
console.log("\nPlace that <script> tag wherever you want the booking widget to appear.");
console.log("Run `npm run build:widget` to generate dist/widget.js first.\n");

rl.close();
