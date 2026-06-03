// Change 4: Webhook delivery with proper attempt tracking and permanent failure handling.
// Called by DB triggers on booking INSERT/UPDATE, and by the pg_cron retry job.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_ATTEMPTS = 3;

interface TriggerPayload {
  type: "INSERT" | "UPDATE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

interface RetryPayload {
  booking_id: string;
}

async function deliverToUrl(
  url: string,
  label: string,
  mode: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; statusCode: number | null; error: string | null }> {
  let statusCode: number | null = null;
  let error: string | null = null;
  let success = false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    statusCode = res.status;
    success = res.ok;
    if (!res.ok) error = `HTTP ${res.status} ${res.statusText}`;
  } catch (e) {
    error = String(e);
  }

  supabase.from("webhook_logs").insert({
    webhook_url: url,
    mode,
    label,
    status_code: statusCode,
    success,
    error_message: error,
  }).then(() => {});

  return { success, statusCode, error };
}

async function sendAdminAlert(contactEmail: string, bookingId: string, error: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "bookings@resend.dev";
  if (!resendKey || !contactEmail) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: contactEmail,
      subject: "⚠️ Webhook permanently failed — action required",
      html: `<p>A webhook for booking <strong>${bookingId}</strong> failed after ${MAX_ATTEMPTS} attempts.</p>
             <p>Last error: <code>${error}</code></p>
             <p>Check the Webhooks panel in your admin dashboard.</p>`,
    }),
  }).catch((e) => console.error("[alert-email]", e));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let rawBody: TriggerPayload | RetryPayload;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  let booking: Record<string, unknown> | null = null;
  let eventType: string;
  let existingQueueId: string | null = null;

  if ("record" in rawBody && rawBody.record) {
    booking = rawBody.record;
    eventType = rawBody.type === "INSERT" ? "booking.confirmed" : "booking.cancelled";
  } else if ("booking_id" in rawBody && rawBody.booking_id) {
    // Retry path: find existing queue entry and load booking
    const { data: queueRow } = await supabase
      .from("webhook_queue")
      .select("id, attempts, booking_id, event_type")
      .eq("booking_id", rawBody.booking_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queueRow) {
      existingQueueId = queueRow.id;
      eventType = queueRow.event_type;
    } else {
      eventType = "booking.confirmed";
    }

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", rawBody.booking_id)
      .single();
    booking = data;
  } else {
    return new Response(JSON.stringify({ error: "Unrecognised payload" }), { status: 400 });
  }

  if (!booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404 });
  }

  // Create or look up the queue entry
  let queueId = existingQueueId;
  if (!queueId) {
    const { data: queueEntry } = await supabase
      .from("webhook_queue")
      .insert({ booking_id: booking.id as string, event_type: eventType!, status: "pending" })
      .select("id")
      .single();
    queueId = queueEntry?.id ?? null;
  }

  // Get current attempt count
  let currentAttempts = 0;
  if (queueId) {
    const { data: q } = await supabase
      .from("webhook_queue")
      .select("attempts")
      .eq("id", queueId)
      .single();
    currentAttempts = q?.attempts ?? 0;
  }

  // Fetch webhook settings
  const { data: settings } = await supabase
    .from("webhook_settings")
    .select("active_mode, test_url, live_url, twin_url")
    .limit(1)
    .single();

  if (!settings || (!settings.test_url && !settings.live_url)) {
    if (queueId) {
      await supabase.from("webhook_queue").update({
        status: "failed",
        attempts: currentAttempts + 1,
        last_error: "No webhook URLs configured",
      }).eq("id", queueId);
    }
    return new Response(JSON.stringify({ ok: false, error: "No webhook URLs configured" }), { status: 200 });
  }

  const mode = settings.active_mode ?? "test";
  const primaryUrl = mode === "live" ? settings.live_url : settings.test_url;
  const twinUrl = settings.twin_url || null;

  const webhookPayload = {
    event: eventType!,
    booking_id: booking.id,
    reference: booking.reference,
    service_type: booking.service_type,
    status: booking.status,
    schedule: { date: booking.schedule_date, time_window: booking.schedule_time_window },
    customer: {
      name: booking.customer_name,
      phone: booking.customer_phone,
      email: booking.customer_email,
      address: booking.customer_address,
      address2: booking.customer_address2,
      zip: booking.customer_zip,
      property_type: booking.customer_property_type,
      gate_code: booking.customer_gate_code,
      notes: booking.notes,
    },
    items: booking.items,
    custom_items: booking.custom_items,
    pricing: {
      item_total: booking.item_total,
      photo_promo_discount: booking.photo_promo_discount,
      adjusted_item_total: booking.adjusted_item_total,
      minimum_price: booking.minimum_price,
      final_total: booking.final_total,
      amount_charged: booking.amount_charged,
      deposit_mode: booking.deposit_mode,
    },
    payment_id: booking.payment_id,
    webhook_mode: mode,
    timestamp: new Date().toISOString(),
  };

  const tasks: Promise<{ success: boolean; statusCode: number | null; error: string | null }>[] = [];
  if (primaryUrl) tasks.push(deliverToUrl(primaryUrl, `Make:${mode}`, mode, webhookPayload));
  if (twinUrl) tasks.push(deliverToUrl(twinUrl, "Twin", mode, webhookPayload));

  const results = tasks.length > 0 ? await Promise.all(tasks) : [];
  const allSuccess = results.length > 0 && results.every((r) => r.success);
  const errors = results.filter((r) => r.error).map((r) => r.error).join("; ");
  const newAttempts = currentAttempts + 1;

  let finalStatus: string;
  if (allSuccess) {
    finalStatus = "delivered";
  } else if (newAttempts >= MAX_ATTEMPTS) {
    finalStatus = "permanently_failed";
    // Alert the admin
    const { data: emailSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "contact_email")
      .maybeSingle();
    const contactEmail = emailSetting?.value ?? "";
    if (contactEmail) {
      await sendAdminAlert(contactEmail, String(booking.id), errors);
    }
  } else {
    finalStatus = "failed";
  }

  if (queueId) {
    await supabase.from("webhook_queue").update({
      status: finalStatus,
      attempts: newAttempts,
      last_error: errors || null,
      delivered_at: allSuccess ? new Date().toISOString() : null,
    }).eq("id", queueId);
  }

  return new Response(
    JSON.stringify({ ok: allSuccess, event: eventType!, results, attempts: newAttempts, status: finalStatus }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
