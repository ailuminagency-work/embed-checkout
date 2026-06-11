// INTERNAL ONLY — called by stripe-webhook and reconcile-bookings with the
// service role key. The browser can no longer trigger emails.
//
// Accepts { booking_id } and derives everything from the bookings row, so the
// caller cannot spoof amounts or recipients. Sends via SMTP (Gmail/Outlook)
// with Resend fallback, logs to email_logs + booking_events, fires SMS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface BookingItem { name: string; quantity: number; price: number; lineTotal?: number; }

interface BusinessConfig {
  company_name: string;
  contact_email: string;
  currency_symbol: string;
  primary_color: string;
  site_url: string;
  addon_cancellation_flow_enabled: string;
}

async function getBusinessConfig(): Promise<BusinessConfig> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]));
  return {
    company_name: map.company_name || "Your Service Company",
    contact_email: map.contact_email || "",
    currency_symbol: map.currency_symbol || "$",
    primary_color: map.primary_color || "#0d9488",
    site_url: map.site_url || "",
    addon_cancellation_flow_enabled: map.addon_cancellation_flow_enabled || "false",
  };
}

function formatServiceLabel(slug: string): string {
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface EmailData {
  customerName: string;
  serviceType: string;
  scheduleDate: string | null;
  timeWindow: string | null;
  items: BookingItem[];
  total: number;
  reference: string | null;
  itemTotal: number | null;
  photoPromoDiscount: number | null;
  adjustedItemTotal: number | null;
  minimumPrice: number | null;
  amountCharged: number | null;
  depositMode: boolean;
  cancelToken: string | null;
}

function buildEmailHtml(data: EmailData, cfg: BusinessConfig): string {
  const sym = cfg.currency_symbol;
  const itemRows = data.items.map((i) =>
    `<tr>
      <td style="padding:6px 0;color:#374151;font-size:14px;">${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}</td>
      <td style="padding:6px 0;color:#374151;font-size:14px;text-align:right;">${sym}${(i.lineTotal ?? i.price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join("");

  const hasDiscount = data.photoPromoDiscount != null && data.photoPromoDiscount > 0;
  const hasMinimum  = data.minimumPrice != null && data.minimumPrice > (data.adjustedItemTotal ?? 0);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:${cfg.primary_color};padding:32px 40px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Booking Confirmed ✓</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${cfg.company_name} — we can't wait to help!</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;">Hi <strong>${data.customerName}</strong>,</p>

    <!-- Service + schedule -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin-bottom:24px;">
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Service</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${formatServiceLabel(data.serviceType)}</p>
      ${data.scheduleDate ? `
      <p style="margin:16px 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Date &amp; Time</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${data.scheduleDate}${data.timeWindow ? ` — ${data.timeWindow}` : ""}</p>
      ` : ""}
    </td></tr>
    </table>

    <!-- Items -->
    ${data.items.length > 0 ? `
    <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em;">Items</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;margin-bottom:8px;">
      ${itemRows}
    </table>` : ""}

    <!-- Pricing summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:12px;margin-bottom:24px;">
      ${data.itemTotal != null ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Item subtotal</td>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;text-align:right;">${sym}${data.itemTotal.toFixed(2)}</td>
      </tr>` : ""}
      ${hasDiscount ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#059669;">Photo discount</td>
        <td style="padding:4px 0;font-size:13px;color:#059669;text-align:right;">−${sym}${data.photoPromoDiscount!.toFixed(2)}</td>
      </tr>` : ""}
      ${hasMinimum ? `
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#9ca3af;">Area minimum applied</td>
        <td style="padding:4px 0;font-size:12px;color:#9ca3af;text-align:right;">${sym}${data.minimumPrice!.toFixed(2)}</td>
      </tr>` : ""}
      ${data.depositMode ? `
      <tr>
        <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;">Deposit charged</td>
        <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;text-align:right;">${sym}${(data.amountCharged ?? data.total).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:2px 0;font-size:12px;color:#9ca3af;">Balance due on day of service</td>
        <td style="padding:2px 0;font-size:12px;color:#9ca3af;text-align:right;">${sym}${(data.total - (data.amountCharged ?? data.total)).toFixed(2)}</td>
      </tr>` : `
      <tr>
        <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;">Total charged</td>
        <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;text-align:right;">${sym}${(data.amountCharged ?? data.total).toFixed(2)}</td>
      </tr>`}
    </table>

    ${data.reference ? `<p style="margin:0 0 16px;font-size:12px;color:#9ca3af;">Booking ref: <strong>${data.reference}</strong></p>` : ""}

    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">
      Questions or need to reschedule? ${cfg.contact_email ? `Email us at <a href="mailto:${cfg.contact_email}" style="color:${cfg.primary_color};">${cfg.contact_email}</a>.` : "Reply to this email."}
    </p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      ${cfg.addon_cancellation_flow_enabled === "true" && data.cancelToken && cfg.site_url
        ? `<a href="${cfg.site_url}/cancel?token=${data.cancelToken}" style="color:#9ca3af;">Need to cancel?</a>`
        : ""}
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${cfg.company_name} · Automated booking confirmation</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function logEvent(bookingId: string | null, eventType: string, payload: Record<string, unknown>, source = "system") {
  try {
    await supabase.from("booking_events").insert({ booking_id: bookingId, event_type: eventType, payload, source });
  } catch { /* logging must never crash the flow */ }
}

Deno.serve(async (req) => {
  // Internal only: caller must present the service role key.
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: "Forbidden — internal function" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { booking_id, source = "system" } = await req.json() as { booking_id?: string; source?: string };
    if (!booking_id) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    if (!booking.customer_email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no customer email" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Idempotency: don't email the same booking twice.
    const { data: alreadySent } = await supabase
      .from("booking_events")
      .select("id")
      .eq("booking_id", booking_id)
      .eq("event_type", "email.sent")
      .limit(1)
      .maybeSingle();
    if (alreadySent) {
      return new Response(JSON.stringify({ skipped: true, reason: "already sent" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const cfg = await getBusinessConfig();
    const emailData: EmailData = {
      customerName: booking.customer_name ?? "there",
      serviceType: booking.service_type ?? "service",
      scheduleDate: booking.schedule_date,
      timeWindow: booking.schedule_time_window,
      items: Array.isArray(booking.items) ? booking.items as BookingItem[] : [],
      total: Number(booking.final_total ?? 0),
      reference: booking.reference,
      itemTotal: booking.item_total != null ? Number(booking.item_total) : null,
      photoPromoDiscount: booking.photo_promo_discount != null ? Number(booking.photo_promo_discount) : null,
      adjustedItemTotal: booking.adjusted_item_total != null ? Number(booking.adjusted_item_total) : null,
      minimumPrice: booking.minimum_price != null ? Number(booking.minimum_price) : null,
      amountCharged: booking.amount_charged != null ? Number(booking.amount_charged) : null,
      depositMode: booking.deposit_mode === true,
      cancelToken: (booking as Record<string, unknown>).cancel_token as string | null ?? null,
    };

    const subject = `Booking Confirmed — ${booking.schedule_date ?? "Your Upcoming Service"} · ${cfg.company_name}`;
    const html = buildEmailHtml(emailData, cfg);

    let result = await sendEmail(booking.customer_email, subject, html);
    if (!result.ok) {
      // one retry on transient failure
      await new Promise((r) => setTimeout(r, 5_000));
      result = await sendEmail(booking.customer_email, subject, html);
    }

    await supabase.from("email_logs").insert({
      booking_ref: booking.reference,
      recipient: booking.customer_email,
      subject,
      status: result.ok ? "sent" : "failed",
      error: result.error ?? null,
    });
    await logEvent(booking_id, result.ok ? "email.sent" : "email.failed", {
      to: booking.customer_email,
      provider: result.provider ?? null,
      error: result.error ?? null,
    }, source);

    // SMS confirmation — non-blocking, skips silently if Twilio not configured
    if (result.ok && booking.customer_phone) {
      supabase.functions.invoke("send-sms", {
        body: {
          customerPhone: booking.customer_phone,
          customerName: booking.customer_name,
          scheduleDate: booking.schedule_date,
          timeWindow: booking.schedule_time_window,
          reference: booking.reference,
        },
      }).catch((e) => console.warn("[send-confirmation] SMS fire failed:", e));
    }

    return new Response(JSON.stringify({ sent: result.ok, provider: result.provider, error: result.error ?? null }), {
      status: result.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-confirmation]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
