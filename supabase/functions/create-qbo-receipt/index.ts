// Creates a Sales Receipt in QuickBooks Online for a confirmed booking.
// Called by stripe-webhook (non-blocking) with { booking_id }. All data is
// loaded from the bookings row server-side — the caller cannot spoof amounts.
// Silently skips if QuickBooks is not connected. Idempotent per booking.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getQBOConfig, getValidAccessToken, getQBOBaseUrl } from "../_shared/quickbooks.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function formatServiceLabel(slug: string): string {
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function logEvent(bookingId: string | null, eventType: string, payload: Record<string, unknown>) {
  try {
    await supabase.from("booking_events").insert({
      booking_id: bookingId, event_type: eventType, payload, source: "quickbooks",
    });
  } catch { /* never crash on logging */ }
}

Deno.serve(async (req) => {
  // Internal only — callable by other edge functions with the service role key.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { booking_id } = await req.json() as { booking_id?: string };
  if (!booking_id) {
    return new Response(JSON.stringify({ error: "booking_id required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // ── 1. Add-on configured? ───────────────────────────────────────────────────
  const config = await getQBOConfig();
  if (!config) {
    return new Response(JSON.stringify({ skipped: true, reason: "QuickBooks not connected" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // ── 2. Load the booking (server-trusted source of truth) ───────────────────
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", booking_id)
    .single();

  if (!booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  // ── 3. Idempotency: one receipt per booking ────────────────────────────────
  const { data: alreadySynced } = await supabase
    .from("quickbooks_log")
    .select("id")
    .eq("booking_id", booking_id)
    .eq("status", "success")
    .limit(1)
    .maybeSingle();
  if (alreadySynced) {
    return new Response(JSON.stringify({ skipped: true, reason: "already synced" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const baseUrl = getQBOBaseUrl(config.environment);

  try {
    const accessToken = await getValidAccessToken(config);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const customerName = (booking.customer_name as string) || "Customer";
    const customerEmail = (booking.customer_email as string) || "";

    // ── 4. Find or create Customer (dedupe by email) ──────────────────────────
    let customerId: string | null = null;

    if (customerEmail) {
      // QBO SQL: escape single quotes in the email value
      const safeEmail = customerEmail.replace(/'/g, "\\'");
      const query = encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${safeEmail}'`);
      const searchRes = await fetch(
        `${baseUrl}/v3/company/${config.realmId}/query?query=${query}&minorversion=65`,
        { headers },
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        customerId = searchData.QueryResponse?.Customer?.[0]?.Id ?? null;
      }
    }

    if (!customerId) {
      const [firstName, ...lastParts] = customerName.split(" ");
      const createRes = await fetch(
        `${baseUrl}/v3/company/${config.realmId}/customer?minorversion=65`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            DisplayName: `${customerName} (${customerEmail || booking.reference})`.slice(0, 100),
            GivenName: firstName,
            FamilyName: lastParts.join(" ") || undefined,
            ...(customerEmail ? { PrimaryEmailAddr: { Address: customerEmail } } : {}),
            ...(booking.customer_phone ? { PrimaryPhone: { FreeFormNumber: booking.customer_phone } } : {}),
          }),
        },
      );
      const newCustomer = await createRes.json();
      customerId = newCustomer.Customer?.Id ?? null;
      if (!customerId) {
        throw new Error(`Customer creation failed: ${JSON.stringify(newCustomer.Fault ?? newCustomer).slice(0, 400)}`);
      }
    }

    // ── 5. Create the Sales Receipt ───────────────────────────────────────────
    const amountDollars = booking.amount_cents != null
      ? booking.amount_cents / 100
      : Number(booking.amount_charged ?? 0);
    const serviceLabel = formatServiceLabel((booking.service_type as string) ?? "Service");
    const itemRef = config.serviceItemId || "1"; // default QBO "Services" item

    const receiptPayload = {
      TxnDate: booking.schedule_date ?? new Date().toISOString().slice(0, 10),
      CustomerRef: { value: customerId },
      PrivateNote: `Booking ${booking.reference} — ${serviceLabel} (Stripe ${booking.payment_intent_id ?? booking.payment_id ?? ""})`,
      Line: [
        {
          Amount: amountDollars,
          DetailType: "SalesItemLineDetail",
          Description: `${serviceLabel} — Booking ${booking.reference}`,
          SalesItemLineDetail: {
            ItemRef: { value: itemRef },
            Qty: 1,
            UnitPrice: amountDollars,
          },
        },
      ],
    };

    const receiptRes = await fetch(
      `${baseUrl}/v3/company/${config.realmId}/salesreceipt?minorversion=65`,
      { method: "POST", headers, body: JSON.stringify(receiptPayload) },
    );

    if (!receiptRes.ok) {
      throw new Error(`Sales Receipt creation failed (${receiptRes.status}): ${(await receiptRes.text()).slice(0, 400)}`);
    }

    const receiptData = await receiptRes.json();
    const receiptId = receiptData.SalesReceipt?.Id ?? null;

    // ── 6. Log success ────────────────────────────────────────────────────────
    await supabase.from("quickbooks_log").insert({
      booking_id,
      reference: booking.reference,
      qbo_sales_receipt_id: receiptId,
      qbo_customer_id: customerId,
      status: "success",
    });
    await logEvent(booking_id, "quickbooks.receipt_created", {
      receipt_id: receiptId, customer_id: customerId, amount: amountDollars,
    });

    return new Response(JSON.stringify({ ok: true, receipt_id: receiptId }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Log failure — the booking is already confirmed, never crash the flow.
    await supabase.from("quickbooks_log").insert({
      booking_id,
      reference: booking.reference,
      status: "failed",
      error_message: String(err).slice(0, 500),
    });
    await logEvent(booking_id, "quickbooks.receipt_failed", { error: String(err).slice(0, 500) });

    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
