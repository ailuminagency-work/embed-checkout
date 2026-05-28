const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingItem {
  name: string;
  quantity: number;
  price: number;
}

interface ConfirmationPayload {
  customerName: string;
  customerEmail: string;
  serviceType: string;
  scheduleDate: string | null;
  timeWindow: string | null;
  items: BookingItem[];
  total: number;
  reference: string | null;
}

function buildEmailHtml(data: ConfirmationPayload): string {
  const itemRows = data.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 0;color:#374151;">${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}</td>
          <td style="padding:6px 0;color:#374151;text-align:right;">$${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join("");

  const serviceLabel = data.serviceType === "junk-removal" ? "Junk Removal" : "Donation Pickup";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#0d9488;padding:32px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Booking Confirmed ✓</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">We've received your booking and can't wait to help!</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 24px;color:#374151;font-size:15px;">Hi <strong>${data.customerName}</strong>,</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Service</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${serviceLabel}</p>
              ${data.scheduleDate ? `
              <p style="margin:16px 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Date &amp; Time</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${data.scheduleDate}${data.timeWindow ? ` — ${data.timeWindow}` : ""}</p>
              ` : ""}
            </td></tr>
          </table>

          ${data.items.length > 0 ? `
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Items</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;margin-bottom:8px;">
            ${itemRows}
          </table>
          ` : ""}

          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:12px;margin-bottom:32px;">
            <tr>
              <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;">Total</td>
              <td style="padding:8px 0;font-size:15px;font-weight:700;color:#111827;text-align:right;">$${data.total.toFixed(2)}</td>
            </tr>
          </table>

          ${data.reference ? `<p style="margin:0 0 24px;font-size:12px;color:#9ca3af;">Reference: ${data.reference}</p>` : ""}

          <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
            If you have any questions or need to reschedule, reply to this email and we'll get back to you promptly.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            This is an automated confirmation. Please do not reply directly to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "bookings@resend.dev";

  if (!RESEND_API_KEY) {
    console.warn("[send-confirmation] RESEND_API_KEY not set — skipping email");
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const data: ConfirmationPayload = await req.json();

    if (!data.customerEmail) {
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: data.customerEmail,
        subject: `Booking Confirmed — ${data.scheduleDate ?? "Your Upcoming Service"}`,
        html: buildEmailHtml(data),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-confirmation]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
