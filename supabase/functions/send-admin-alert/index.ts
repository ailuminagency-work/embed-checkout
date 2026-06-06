// Generic admin alert email — used by reconcile-payments and other server-side jobs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, json } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { subject, message, admin_email } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "alerts@resend.dev";

    if (!RESEND_API_KEY || !admin_email) {
      return json({ skipped: true, reason: "No RESEND_API_KEY or admin_email" });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: admin_email, subject, text: message }),
    });

    return json({ ok: res.ok });
  } catch (e) {
    console.error("[send-admin-alert]", e);
    return json({ ok: false, error: String(e) });
  }
});
