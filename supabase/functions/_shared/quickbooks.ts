// QuickBooks Online shared helpers: config loading + automatic token refresh.
// Credentials live in integration_secrets (admin-only RLS — NOT public
// app_settings); non-sensitive flags (environment, realm id) in app_settings.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export interface QBOConfig {
  clientId: string;
  clientSecret: string;
  realmId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  environment: string;
  serviceItemId: string;
}

export async function getQBOConfig(): Promise<QBOConfig | null> {
  const [{ data: secrets }, { data: settings }] = await Promise.all([
    supabase.from("integration_secrets").select("key, value").like("key", "quickbooks_%"),
    supabase.from("app_settings").select("key, value").like("key", "quickbooks_%"),
  ]);

  const sec = Object.fromEntries((secrets ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]));
  const set = Object.fromEntries((settings ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]));

  // Add-on not configured — caller must skip silently with zero errors.
  if (!sec.quickbooks_access_token || !set.quickbooks_realm_id) return null;

  return {
    clientId: sec.quickbooks_client_id,
    clientSecret: sec.quickbooks_client_secret,
    realmId: set.quickbooks_realm_id,
    accessToken: sec.quickbooks_access_token,
    refreshToken: sec.quickbooks_refresh_token,
    tokenExpiresAt: sec.quickbooks_token_expires_at,
    environment: set.quickbooks_environment || "sandbox",
    serviceItemId: set.quickbooks_service_item_id || "",
  };
}

export async function saveQBOTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
  const now = new Date().toISOString();
  await supabase.from("integration_secrets").upsert([
    { key: "quickbooks_access_token",            value: tokens.access_token, updated_at: now },
    { key: "quickbooks_refresh_token",           value: tokens.refresh_token, updated_at: now },
    { key: "quickbooks_token_expires_at",        value: expiresAt, updated_at: now },
    { key: "quickbooks_refresh_token_updated_at", value: now, updated_at: now },
  ], { onConflict: "key" });
}

export async function getValidAccessToken(config: QBOConfig, forceRefresh = false): Promise<string> {
  const bufferMs = 2 * 60 * 1000;
  const expiresAt = Date.parse(config.tokenExpiresAt || "0");

  if (!forceRefresh && expiresAt - Date.now() > bufferMs) {
    return config.accessToken;
  }

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`QBO token refresh failed (${res.status}): ${await res.text()}`);
  }

  const tokens = await res.json();
  await saveQBOTokens(tokens);
  return tokens.access_token;
}

export function getQBOBaseUrl(environment: string): string {
  return environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}
