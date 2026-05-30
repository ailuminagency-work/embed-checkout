import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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

  // Log every attempt (fire-and-forget)
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

  // Determine booking record — either from DB trigger (has `type` + `record`) or manual retry (has `booking_id`)
  let booking: Record<string, unknown> | null = null;
  let eventType: string;

  if ("record" in rawBody && rawBody.record) {
    // Called from DB trigger via supabase_functions.http_request
    booking = rawBody.record;
    eventType = rawBody.type === "INSERT" ? "booking.confirmed" : "booking.cancelled";
  } else if ("booking_id" in rawBody && rawBody.booking_id) {
    // Manual retry from admin UI
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", rawBody.booking_id)
      .single();
    booking = data;
    eventType = data?.status === "cancelled" ? "booking.cancelled" : "booking.confirmed";
  } else {
    return new Response(JSON.stringify({ error: "Unrecognised payload" }), { status: 400 });
  }

  if (!booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404 });
  }

  // Create queue entry so this delivery is trackable
  const { data: queueEntry } = await supabase
    .from("webhook_queue")
    .insert({
      booking_id: booking.id as string,
      event_type: eventType,
      status: "pending",
    })
    .select("id")
    .single();

  // Fetch webhook settings (test_url / live_url / twin_url)
  const { data: settings } = await supabase
    .from("webhook_settings")
    .select("active_mode, test_url, live_url, twin_url")
    .limit(1)
    .single();

  if (!settings || (!settings.test_url && !settings.live_url)) {
    if (queueEntry) {
      await supabase.from("webhook_queue").update({
        status: "failed",
        attempts: 1,
        last_error: "No webhook URLs configured",
      }).eq("id", queueEntry.id);
    }
    return new Response(JSON.stringify({ ok: false, error: "No webhook URLs configured" }), { status: 200 });
  }

  const mode: string = settings.active_mode ?? "test";
  const primaryUrl: string = mode === "live" ? settings.live_url : settings.test_url;
  const twinUrl: string | null = settings.twin_url || null;

  // Build a clean, typed webhook payload
  const webhookPayload = {
    event: eventType,
    booking_id: booking.id,
    reference: booking.reference,
    service_type: booking.service_type,
    status: booking.status,
    schedule: {
      date: booking.schedule_date,
      time_window: booking.schedule_time_window,
    },
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

  // Fire all configured endpoints in parallel
  const tasks: Promise<{ success: boolean; statusCode: number | null; error: string | null }>[] = [];
  if (primaryUrl) tasks.push(deliverToUrl(primaryUrl, `Make:${mode}`, mode, webhookPayload));
  if (twinUrl) tasks.push(deliverToUrl(twinUrl, "Twin", mode, webhookPayload));

  const results = tasks.length > 0 ? await Promise.all(tasks) : [];

  const allSuccess = results.length > 0 && results.every((r) => r.success);
  const errors = results.filter((r) => r.error).map((r) => r.error).join("; ");

  // Update queue entry with result
  if (queueEntry) {
    await supabase.from("webhook_queue").update({
      status: allSuccess ? "delivered" : results.length === 0 ? "failed" : "failed",
      attempts: results.length > 0 ? 1 : 0,
      last_error: errors || null,
      delivered_at: allSuccess ? new Date().toISOString() : null,
    }).eq("id", queueEntry.id);
  }

  return new Response(JSON.stringify({ ok: allSuccess, event: eventType, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
