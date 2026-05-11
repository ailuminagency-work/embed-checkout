import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ─── Zod schema ───────────────────────────────────────────────────────────────
const payloadSchema = z.object({
  serviceType: z.enum(["junk-removal", "donation-pickup"]),
  items: z.array(z.object({
    id: z.string().max(100),
    name: z.string().max(200),
    price: z.number().nonnegative(),
    quantity: z.number().int().positive(),
    lineTotal: z.number().nonnegative(),
  })).max(100),
  customItems: z.array(z.object({ description: z.string().max(500) })).max(20),
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  amountCharged: z.number().nonnegative(),
  depositMode: z.boolean(),
  schedule: z.object({
    date: z.string().optional(),
    timeWindow: z.string().max(100).optional(),
  }),
  customer: z.object({
    name: z.string().max(200),
    phone: z.string().max(30),
    email: z.string().email().max(254),
    address: z.string().max(500),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    gateCode: z.string().max(100),
    notes: z.string().max(2000),
  }),
  stripePaymentId: z.string().max(255).nullable(),
  currency: z.string().length(3),
  webhookMode: z.enum(["test", "live"]),
  timestamp: z.string(),
});

type Payload = z.infer<typeof payloadSchema>;

// ─── Supabase admin client (reads webhook_settings, writes webhook_logs) ──────
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function fireWebhook(
  label: string, url: string, mode: string, payload: Payload,
): Promise<void> {
  let statusCode: number | null = null;
  let success = false;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    statusCode = res.status;
    success = res.ok;
    if (!res.ok) errorMessage = `HTTP ${res.status} ${res.statusText}`;
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Network error";
  }

  await supabaseAdmin.from("webhook_logs").insert({
    webhook_url: url,
    mode,
    label,
    status_code: statusCode,
    success,
    error_message: errorMessage,
    payload,
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const ip = req.headers.get("x-real-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? "unknown";

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
      { status: 422, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const payload = parsed.data;

  // Read webhook config server-side (anon can no longer read this table)
  const { data: settings } = await supabaseAdmin
    .from("webhook_settings")
    .select("active_mode, test_url, live_url, twin_url")
    .limit(1)
    .maybeSingle();

  const mode = settings?.active_mode ?? payload.webhookMode;
  const makeUrl = settings
    ? (mode === "live" ? settings.live_url : settings.test_url)
    : "";
  const twinUrl = settings?.twin_url ?? "";

  const requests: Promise<void>[] = [];
  if (makeUrl) requests.push(fireWebhook(`Make:${mode}`, makeUrl, mode, payload));
  if (twinUrl) requests.push(fireWebhook("Twin", twinUrl, mode, payload));

  await Promise.allSettled(requests);

  return new Response(
    JSON.stringify({ ok: true, fired: requests.length }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
