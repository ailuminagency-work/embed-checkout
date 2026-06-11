// Daily QuickBooks token refresh — called by pg_cron at 8am.
// Force-refreshes the access token, which also rolls the 100-day refresh
// token forward. With this running daily, the connection never silently dies.
// If refresh fails, logs an actionable event the admin panel can surface.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getQBOConfig, getValidAccessToken } from "../_shared/quickbooks.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function logEvent(eventType: string, payload: Record<string, unknown>) {
  try {
    await supabase.from("booking_events").insert({
      booking_id: null, event_type: eventType, payload, source: "quickbooks",
    });
  } catch { /* never crash on logging */ }
}

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)) {
    return new Response("Forbidden", { status: 403 });
  }

  const config = await getQBOConfig();
  if (!config) {
    return new Response(JSON.stringify({ skipped: true, reason: "QuickBooks not connected" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await getValidAccessToken(config, true); // force refresh — rolls the refresh token
    await logEvent("quickbooks.token_refreshed", { environment: config.environment });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Refresh failed — likely the refresh token expired (100 days unused) or
    // the app was disconnected in Intuit. Admin must reconnect.
    await logEvent("quickbooks.token_refresh_failed", {
      error: String(err).slice(0, 400),
      action: "Reconnect QuickBooks from the Add-ons panel",
    });
    // Flag as disconnected so the admin panel shows the real state.
    await supabase.from("app_settings").upsert(
      { key: "quickbooks_connected", value: "" },
      { onConflict: "key" },
    );
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
