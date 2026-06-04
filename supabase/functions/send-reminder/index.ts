// Booking reminder emails (48h and 2h before service).
// Called by pg_cron jobs in booking_reminders migration.
// Silently skips if addon_booking_reminders_enabled != 'true'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse, json } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { type, booking_id } = await req.json() as { type: "48h" | "2h"; booking_id: string };

    // Check add-on enabled
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["addon_booking_reminders_enabled", "company_name", "contact_email", "primary_color"]);

    const cfg = Object.fromEntries((settings ?? []).map((r: { key: string; value: string }) => [r.key, r.value ?? ""]));

    if (cfg.addon_booking_reminders_enabled !== "true") {
      return json({ skipped: true, reason: "Booking reminders not enabled" });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "bookings@resend.dev";
    if (!RESEND_API_KEY) return json({ skipped: true, reason: "No RESEND_API_KEY" });

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (bErr || !booking) return json({ skipped: true, reason: "Booking not found" });

    const sentFlag = type === "48h" ? "reminder_48h_sent" : "reminder_2h_sent";
    if (booking[sentFlag]) return json({ skipped: true, reason: "Already sent" });

    const timeLabel = type === "48h" ? "48 hours" : "2 hours";
    const companyName = cfg.company_name || "Your Service Company";
    const primaryColor = cfg.primary_color || "#0d9488";

    const html = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#f9fafb;padding:40px 20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
  <div style="background:${primaryColor};padding:28px 32px;">
    <h2 style="margin:0;color:#fff;font-size:18px;">Reminder: Your pickup is in ${timeLabel}</h2>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#374151;">Hi <strong>${booking.customer_name}</strong>,</p>
    <p style="color:#374151;">Just a reminder that your pickup is scheduled for <strong>${booking.schedule_date}</strong>${booking.schedule_time_window ? ` during the ${booking.schedule_time_window} window` : ""}.</p>
    <p style="color:#374151;">Pickup address: <strong>${booking.customer_address}${booking.customer_address2 ? `, ${booking.customer_address2}` : ""}</strong></p>
    <p style="color:#6b7280;font-size:13px;">Booking ref: ${booking.reference}</p>
    ${cfg.contact_email ? `<p style="color:#6b7280;font-size:13px;">Questions? <a href="mailto:${cfg.contact_email}" style="color:${primaryColor};">${cfg.contact_email}</a></p>` : ""}
  </div>
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${companyName}</p>
  </div>
</div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.customer_email,
        subject: `Reminder: Your ${companyName} pickup is in ${timeLabel}`,
        html,
      }),
    });

    if (res.ok) {
      await supabase.from("bookings").update({ [sentFlag]: true }).eq("id", booking_id);
      await supabase.from("email_logs").insert({
        booking_ref: booking.reference,
        recipient: booking.customer_email,
        subject: `Reminder (${type})`,
        status: "sent",
      });
    }

    return json({ ok: res.ok });
  } catch (e) {
    console.error("[send-reminder]", e);
    return json({ ok: false, error: String(e) });
  }
});
