import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse, json, error } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── API key authentication ─────────────────────────────────────────────────────
async function authenticate(req: Request): Promise<{ ok: boolean; permissions?: string[] }> {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!key) return { ok: false };

  const prefix = key.slice(0, 8);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data } = await supabase
    .from("api_keys")
    .select("permissions, active, expires_at")
    .eq("key_prefix", prefix)
    .eq("key_hash", keyHash)
    .single();

  if (!data || !data.active) return { ok: false };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { ok: false };

  // Update last_used_at asynchronously — don't await
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() })
    .eq("key_prefix", prefix).then(() => {});

  return { ok: true, permissions: data.permissions ?? [] };
}

// ── router ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  const url = new URL(req.url);
  // Strip the function name prefix: /v1/... or just /...
  const rawPath = url.pathname.replace(/^\/v1/, "").replace(/^\/functions\/v1\/v1/, "");
  const path = rawPath || "/";
  const method = req.method;

  // Health check — no auth required
  if (path === "/health" && method === "GET") {
    return json({ status: "ok", timestamp: new Date().toISOString() });
  }

  // All other routes require API key
  const auth = await authenticate(req);
  if (!auth.ok) return error("Unauthorized — provide a valid X-Api-Key header", 401);

  // ── GET /catalog ─────────────────────────────────────────────────────────────
  if (path === "/catalog" && method === "GET") {
    const activeOnly = url.searchParams.get("active") !== "false";
    let query = supabase.from("catalog_items").select("*").order("sort_order", { ascending: true });
    if (activeOnly) query = query.eq("active", true);
    const { data, error: err } = await query;
    if (err) return error(err.message, 500);
    return json(data);
  }

  // ── GET /bookings ─────────────────────────────────────────────────────────────
  if (path === "/bookings" && method === "GET") {
    const page = parseInt(url.searchParams.get("page") ?? "0");
    const pageSize = Math.min(parseInt(url.searchParams.get("page_size") ?? "50"), 200);
    const status = url.searchParams.get("status");
    const serviceType = url.searchParams.get("service_type");

    let query = supabase
      .from("bookings")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (status) query = query.eq("status", status);
    if (serviceType) query = query.eq("service_type", serviceType);

    const { data, error: err, count } = await query;
    if (err) return error(err.message, 500);
    return json({ data, count, page, page_size: pageSize, total_pages: Math.ceil((count ?? 0) / pageSize) });
  }

  // ── GET /bookings/:id ─────────────────────────────────────────────────────────
  const bookingMatch = path.match(/^\/bookings\/([^/]+)$/);
  if (bookingMatch && method === "GET") {
    const id = bookingMatch[1];
    const { data, error: err } = await supabase.from("bookings").select("*").eq("id", id).single();
    if (err) return error(err.message, err.code === "PGRST116" ? 404 : 500);
    return json(data);
  }

  // ── POST /bookings ────────────────────────────────────────────────────────────
  if (path === "/bookings" && method === "POST") {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return error("Invalid JSON body"); }

    if (!body.reference || !body.service_type) {
      return error("reference and service_type are required");
    }

    const { data, error: err } = await supabase
      .from("bookings")
      .insert(body)
      .select("id, reference")
      .single();
    if (err) return error(err.message, 500);
    return json(data, 201);
  }

  // ── POST /bookings/:id/cancel ─────────────────────────────────────────────────
  const cancelMatch = path.match(/^\/bookings\/([^/]+)\/cancel$/);
  if (cancelMatch && method === "POST") {
    const id = cancelMatch[1];
    const { error: err } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (err) return error(err.message, 500);
    return json({ success: true });
  }

  // ── POST /bookings/:id/webhook/replay ─────────────────────────────────────────
  const replayMatch = path.match(/^\/bookings\/([^/]+)\/webhook\/replay$/);
  if (replayMatch && method === "POST") {
    const id = replayMatch[1];
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) return error(fetchErr.message, fetchErr.code === "PGRST116" ? 404 : 500);

    const { data: settings } = await supabase.from("app_settings").select("key, value");
    const webhookUrl = settings?.find((s: { key: string }) => s.key === "webhook_url")?.value;
    if (!webhookUrl) return error("No webhook URL configured", 422);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "booking.replay", booking }),
      });
      return json({ success: res.ok, status: res.status });
    } catch (e) {
      return error(String(e), 502);
    }
  }

  // ── GET /webhooks/logs ────────────────────────────────────────────────────────
  if (path === "/webhooks/logs" && method === "GET") {
    const { data, error: err } = await supabase
      .from("webhook_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (err) return error(err.message, 500);
    return json(data);
  }

  return error("Not found", 404);
});
