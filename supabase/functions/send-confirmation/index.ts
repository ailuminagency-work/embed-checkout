// Change 7: Hardened confirmation email — reads config from DB, full itemized HTML,
// logs delivery to email_logs table, retries once on transient failure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingItem { name: string; quantity: number; price: number; lineTotal?: number; }

interface ConfirmationPayload {
  customerName: string;
  customerEmail: string;
  serviceType: string;
  scheduleDate: string | null;
  timeWindow: string | null;
  items: BookingItem[];
  total: number;
  reference: string | null;
  // Extended fields from Change 7
  itemTotal?: number;
  photoPromoDiscount?: number;
  adjustedItemTotal?: number;
  minimumPrice?: number | null;
  amountCharged?: number;
  depositMode?: boolean;
}

interface BusinessConfig {
  company_name: string;
  contact_email: string;
  currency_symbol: string;
  primary_color: string;
}

async function getBusinessConfig(): Promise<BusinessConfig> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]));
  return {
    company_name: map.company_name || "Your Service Company",
    contact_email: map.contact_email || "",
    currency_symbol: map.currency_symbol || "$",
    primary_color: map.primary_color || "#0d9488",
  };
}

function formatServiceLabel(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function buildEmailHtml(data: ConfirmationPayload, cfg: BusinessConfig): string {
  const sym = cfg.currency_symbol;
  const itemRows = data.items.map((i) =>
    `<tr>
      <td style="padding:6px 0;color:#374151;font-size:14px;">${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}</td>
      <td style="padding:6px 0;color:#374151;font-size:14px;text-align:right;">${sym}${(i.lineTotal ?? i.price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join("");

  const hasDiscount = data.photoPromoDiscount && data.photoPromoDiscount > 0;
  const hasMinimum  = data.minimumPrice && data.minimumPrice > (data.adjustedItemTotal ?? 0);

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
        <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;text-align:right;">${sym}${data.total.toFixed(2)}</td>
      </tr>`}
    </table>

    ${data.reference ? `<p style="margin:0 0 16px;font-size:12px;color:#9ca3af;">Booking ref: <strong>${data.reference}</strong></p>` : ""}

    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">
      Questions or need to reschedule? ${cfg.contact_email ? `Email us at <a href="mailto:${cfg.contact_email}" style="color:${cfg.primary_color};">${cfg.contact_email}</a>.` : "Reply to this email."}
    </p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      <a href="#" style="color:#9ca3af;">Cancellation Policy</a>
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

async function sendEmail(
  resendKey: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "bookings@resend.dev";

  if (!RESEND_API_KEY) {
    console.warn("[send-confirmation] RESEND_API_KEY not set — skipping");
    await supabase.from("email_logs").insert({ recipient: "unknown", status: "skipped", subject: "RESEND_API_KEY missing" });
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const data: ConfirmationPayload = await req.json();

    if (!data.customerEmail) {
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [cfg] = await Promise.all([getBusinessConfig()]);
    const subject = `Booking Confirmed — ${data.scheduleDate ?? "Your Upcoming Service"} · ${cfg.company_name}`;
    const html = buildEmailHtml(data, cfg);

    // First attempt
    let result = await sendEmail(RESEND_API_KEY, FROM_EMAIL, data.customerEmail, subject, html);

    // Retry once after 30s on transient failure
    if (!result.ok) {
      await new Promise((r) => setTimeout(r, 30_000));
      result = await sendEmail(RESEND_API_KEY, FROM_EMAIL, data.customerEmail, subject, html);
    }

    await supabase.from("email_logs").insert({
      booking_ref: data.reference,
      recipient: data.customerEmail,
      subject,
      status: result.ok ? "sent" : "failed",
      error: result.error ?? null,
    });

    if (!result.ok) throw new Error(result.error);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-confirmation]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
