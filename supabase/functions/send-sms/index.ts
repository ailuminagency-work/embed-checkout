// SMS confirmation via Twilio.
// Silently skips if Twilio keys are not configured in app_settings.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse, json } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { data: rows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"]);

    const cfg = Object.fromEntries((rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value ?? ""]));

    if (!cfg.twilio_account_sid || !cfg.twilio_auth_token || !cfg.twilio_phone_number) {
      return json({ skipped: true, reason: "SMS not configured" });
    }

    const { customerPhone, customerName, scheduleDate, timeWindow, reference } = await req.json();

    if (!customerPhone) return json({ skipped: true, reason: "No phone number" });

    const body = `Hi ${customerName}! Your pickup is confirmed for ${scheduleDate}${timeWindow ? ` (${timeWindow})` : ""}. Ref: ${reference}. Reply STOP to opt out.`;

    const auth = btoa(`${cfg.twilio_account_sid}:${cfg.twilio_auth_token}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilio_account_sid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: cfg.twilio_phone_number, To: customerPhone, Body: body }),
      },
    );

    const result = await res.json();
    if (!res.ok) {
      console.warn("[send-sms] Twilio error:", result.message);
      return json({ ok: false, error: result.message });
    }

    return json({ ok: true, sid: result.sid });
  } catch (e) {
    console.error("[send-sms]", e);
    return json({ ok: false, error: String(e) });
  }
});
