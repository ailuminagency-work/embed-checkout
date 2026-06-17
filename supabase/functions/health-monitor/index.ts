// Self-healing health monitor. Checks DB, settings, catalog; retries failed
// webhook deliveries from the last 24h. Returns a JSON health report.
// Deployed with --no-verify-jwt so it can be hit as a status URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const checks: Record<string, { ok: boolean; [k: string]: unknown }> = {};

  // 1. Database connectivity
  try {
    const { count, error } = await supabase.from("bookings").select("*", { count: "exact", head: true });
    checks.database = { ok: !error, booking_count: count ?? 0, error: error?.message };
  } catch (e) {
    checks.database = { ok: false, error: String(e) };
  }

  // 2. Settings / Stripe configuration
  try {
    const { data, error } = await supabase.from("app_settings").select("key,value")
      .in("key", ["stripe_publishable_key", "stripe_publishable_key_live", "stripe_publishable_key_test", "company_name", "business_name"]);
    const s: Record<string, string> = {};
    data?.forEach((r: { key: string; value: string }) => { s[r.key] = r.value; });
    const pk = s.stripe_publishable_key || s.stripe_publishable_key_live || s.stripe_publishable_key_test || "";
    checks.settings = {
      ok: !error && pk.startsWith("pk_"),
      stripe_key_present: pk.startsWith("pk_"),
      stripe_mode: pk.startsWith("pk_live_") ? "LIVE" : pk.startsWith("pk_test_") ? "TEST" : "UNSET",
      company: s.business_name || s.company_name || null,
    };
  } catch (e) {
    checks.settings = { ok: false, error: String(e) };
  }

  // 3. Retry failed webhook deliveries from the last 24h (self-healing)
  let retried = 0;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: failed } = await supabase
      .from("webhook_logs")
      .select("id, booking_id")
      .eq("success", false)
      .gte("created_at", since)
      .limit(10);

    for (const wh of failed ?? []) {
      if (!wh.booking_id) continue;
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/deliver-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ booking_id: wh.booking_id }),
        });
        retried++;
      } catch { /* best effort */ }
    }
    checks.webhook_retry = { ok: true, retried };
  } catch (e) {
    checks.webhook_retry = { ok: false, error: String(e) };
  }

  // 4. Catalog integrity
  try {
    const { count: active } = await supabase.from("catalog_items").select("*", { count: "exact", head: true }).eq("active", true);
    const { count: total } = await supabase.from("catalog_items").select("*", { count: "exact", head: true });
    checks.catalog = { ok: (active ?? 0) > 0, active: active ?? 0, total: total ?? 0 };
  } catch (e) {
    checks.catalog = { ok: false, error: String(e) };
  }

  const all = Object.values(checks);
  const healthy = all.filter((c) => c.ok).length;
  const report = {
    timestamp: new Date().toISOString(),
    status: all.every((c) => c.ok) ? "HEALTHY" : "DEGRADED",
    healthy,
    total: all.length,
    checks,
  };

  return new Response(JSON.stringify(report, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: report.status === "HEALTHY" ? 200 : 207,
  });
});
