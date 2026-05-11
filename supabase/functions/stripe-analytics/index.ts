import Stripe from "npm:stripe@17";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const PERIOD_DAYS = 30;

interface DayRevenue { date: string; amountCents: number; }
interface TopCustomer { email: string; name: string; totalCents: number; count: number; }
interface AnalyticsPayload {
  connected: boolean;
  totalRevenueCents: number;
  chargeCount: number;
  aovCents: number;
  topCustomers: TopCustomer[];
  dailyRevenue: DayRevenue[];
  periodDays: number;
}

const empty = (): AnalyticsPayload => ({
  connected: false,
  totalRevenueCents: 0,
  chargeCount: 0,
  aovCents: 0,
  topCustomers: [],
  dailyRevenue: buildEmptyDays(),
  periodDays: PERIOD_DAYS,
});

function buildEmptyDays(): DayRevenue[] {
  const days: DayRevenue[] = [];
  for (let i = PERIOD_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push({ date: d.toISOString().slice(0, 10), amountCents: 0 });
  }
  return days;
}

// Module-level 60 s in-memory cache (lives as long as the worker instance).
let cache: { payload: AnalyticsPayload; ts: number } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Serve from cache if still fresh
  if (cache && Date.now() - cache.ts < 60_000) {
    return respond(cache.payload);
  }

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!secretKey) {
    return respond(empty());
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2025-04-30.basil" });
    const since = Math.floor(Date.now() / 1000) - PERIOD_DAYS * 86_400;

    // Fetch up to 300 successful charges in the period (3 pages × 100)
    const charges: Stripe.Charge[] = [];
    let startingAfter: string | undefined;
    for (let page = 0; page < 3; page++) {
      const result = await stripe.charges.list({
        limit: 100,
        created: { gte: since },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const c of result.data) {
        if (c.status === "succeeded" && !c.refunded) charges.push(c);
      }
      if (!result.has_more) break;
      startingAfter = result.data.at(-1)?.id;
    }

    // Aggregate totals
    const totalRevenueCents = charges.reduce((s, c) => s + c.amount, 0);
    const chargeCount = charges.length;
    const aovCents = chargeCount > 0 ? Math.round(totalRevenueCents / chargeCount) : 0;

    // Daily revenue buckets
    const dayMap = new Map<string, number>(buildEmptyDays().map((d) => [d.date, 0]));
    for (const c of charges) {
      const key = new Date(c.created * 1000).toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + c.amount);
    }
    const dailyRevenue: DayRevenue[] = [...dayMap.entries()].map(([date, amountCents]) => ({
      date,
      amountCents,
    }));

    // Top 5 customers by total spend
    const customerMap = new Map<string, TopCustomer>();
    for (const c of charges) {
      const email = c.billing_details?.email ?? c.metadata?.email ?? "unknown";
      const name = c.billing_details?.name ?? "Unknown";
      const existing = customerMap.get(email);
      if (existing) {
        existing.totalCents += c.amount;
        existing.count += 1;
      } else {
        customerMap.set(email, { email, name, totalCents: c.amount, count: 1 });
      }
    }
    const topCustomers = [...customerMap.values()]
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, 5);

    const payload: AnalyticsPayload = {
      connected: true,
      totalRevenueCents,
      chargeCount,
      aovCents,
      topCustomers,
      dailyRevenue,
      periodDays: PERIOD_DAYS,
    };

    cache = { payload, ts: Date.now() };
    return respond(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[stripe-analytics]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

function respond(payload: AnalyticsPayload): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "max-age=60",
    },
  });
}
