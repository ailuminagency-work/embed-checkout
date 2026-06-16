// One-click email setup, called from the admin Setup wizard.
// Sends a test email via Gmail/Outlook SMTP to prove the App Password works, then
// (unless test_only) pushes SMTP secrets to the Edge Function env and stores
// non-sensitive hints/flags in app_settings. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, error as jsonError } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function requireAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return false;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return false;
  // user_roles is the authoritative admin source used by the app's own auth.
  const { data } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return !!data;
}

async function pushSecrets(secrets: { name: string; value: string }[]): Promise<string | null> {
  const accessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!accessToken || !projectRef) {
    return "SUPABASE_ACCESS_TOKEN not set — add it to Edge Function secrets to enable automatic key storage.";
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(secrets),
  });
  if (!res.ok) return `Failed to store secrets via Management API (${res.status}): ${await res.text()}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!(await requireAdmin(req))) return jsonError("Admin access required", 403);

  try {
    const { provider, email_user, email_password, from_name, admin_email, test_only } = await req.json();

    if (!email_user || !email_password) return jsonError("Email address and app password are required", 400);

    const host = provider === "outlook" ? "smtp-mail.outlook.com" : "smtp.gmail.com";
    const port = 587;
    const fromName = from_name || "Bookings";

    // 1. Prove the credentials work by sending a real test email
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const client = new SMTPClient({
        connection: { hostname: host, port, tls: false, auth: { username: email_user, password: email_password } },
      });
      await client.send({
        from: `${fromName} <${email_user}>`,
        to: admin_email || email_user,
        subject: "✓ Booking Widget — Email Connected Successfully",
        html: `<div style="font-family:-apple-system,sans-serif;padding:24px;max-width:500px;">
          <h2 style="color:#22c55e;">Email is connected!</h2>
          <p>Your booking widget will now send confirmation emails directly from <strong>${email_user}</strong>.</p>
          <p>When a customer completes a booking they'll receive a professional confirmation, and their replies land in this inbox.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
          <p style="color:#94a3b8;font-size:12px;">Test message from the booking widget setup wizard.</p>
        </div>`,
      });
      await client.close();
    } catch (err) {
      return jsonError(`Connection failed — check the email address and app password. (${err instanceof Error ? err.message : String(err)})`, 400);
    }

    if (test_only) return json({ success: true, message: "Test email sent — check the inbox." });

    // 2. Persist: secrets to env, hints/flags to app_settings
    const secretError = await pushSecrets([
      { name: "EMAIL_HOST", value: host },
      { name: "EMAIL_PORT", value: String(port) },
      { name: "EMAIL_USER", value: email_user },
      { name: "EMAIL_PASSWORD", value: email_password },
      { name: "EMAIL_FROM_NAME", value: fromName },
    ]);

    await admin.from("app_settings").upsert([
      { key: "email_provider", value: provider || "gmail" },
      { key: "email_user_hint", value: email_user },
      { key: "email_from_name", value: fromName },
      { key: "admin_notification_email", value: admin_email || "" },
      { key: "setup_step_email", value: secretError ? "false" : "true" },
    ], { onConflict: "key" });

    return json({ success: !secretError, warning: secretError });
  } catch (err) {
    console.error("[setup-email]", err);
    return jsonError(err instanceof Error ? err.message : "Setup failed", 500);
  }
});
