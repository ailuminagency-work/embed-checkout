// Review request emails — sent 24 hours after service completion.
// Called by pg_cron daily job.
// Silently skips if google_business_review_url is not configured.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, json } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { booking_id } = await req.json() as { booking_id: string };

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["google_business_review_url", "company_name", "contact_email", "primary_color"]);

    const cfg = Object.fromEntries((settings ?? []).map((r: { key: string; value: string }) => [r.key, r.value ?? ""]));

    if (!cfg.google_business_review_url) {
      return json({ skipped: true, reason: "Review URL not configured" });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "bookings@resend.dev";
    if (!RESEND_API_KEY) return json({ skipped: true, reason: "No RESEND_API_KEY" });

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("customer_name, customer_email, reference")
      .eq("id", booking_id)
      .single();

    if (bErr || !booking) return json({ skipped: true, reason: "Booking not found" });

    const companyName = cfg.company_name || "Your Service Company";
    const primaryColor = cfg.primary_color || "#0d9488";
    const reviewUrl = cfg.google_business_review_url;

    const html = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#f9fafb;padding:40px 20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
  <div style="background:${primaryColor};padding:28px 32px;">
    <h2 style="margin:0;color:#fff;font-size:18px;">How did we do?</h2>
  </div>
  <div style="padding:28px 32px;text-align:center;">
    <p style="color:#374151;font-size:15px;">Hi <strong>${booking.customer_name}</strong>,</p>
    <p style="color:#374151;">We hope your pickup with ${companyName} went smoothly! Your feedback means the world to us and helps others find our service.</p>
    <p style="margin:28px 0;">
      <a href="${reviewUrl}" target="_blank" style="display:inline-block;background:${primaryColor};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Leave a Google Review ⭐
      </a>
    </p>
    <p style="color:#9ca3af;font-size:12px;">Takes less than 60 seconds.</p>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${companyName} · Ref: ${booking.reference}</p>
  </div>
</div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.customer_email,
        subject: `How did ${companyName} do? We'd love your feedback`,
        html,
      }),
    });

    if (res.ok) {
      await supabase.from("email_logs").insert({
        booking_ref: booking.reference,
        recipient: booking.customer_email,
        subject: "Review request",
        status: "sent",
      });
    }

    return json({ ok: res.ok });
  } catch (e) {
    console.error("[send-review-request]", e);
    return json({ ok: false, error: String(e) });
  }
});
