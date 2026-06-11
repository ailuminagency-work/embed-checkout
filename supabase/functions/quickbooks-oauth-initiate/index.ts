// Generates the Intuit OAuth2 authorization URL for the admin panel.
// The panel calls this via functions.invoke (JWT attached) and opens the
// returned auth_url — avoids needing a public redirect endpoint here.
// CSRF state is stored in integration_secrets and verified by the callback.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { data: secrets } = await supabase
    .from("integration_secrets")
    .select("key, value")
    .eq("key", "quickbooks_client_id")
    .maybeSingle();

  const clientId = secrets?.value ?? "";
  if (!clientId) {
    return new Response(
      JSON.stringify({ error: "Save your QuickBooks Client ID first." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const state = crypto.randomUUID();
  await supabase.from("integration_secrets").upsert(
    { key: "quickbooks_oauth_state", value: state, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/quickbooks-oauth-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  return new Response(
    JSON.stringify({
      auth_url: `https://appcenter.intuit.com/connect/oauth2?${params}`,
      redirect_uri: redirectUri,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
