// Change 1: All client-specific config comes from app_settings at runtime.
// This hook is the single source of truth for config in the frontend.
// Starts with safe defaults so the UI renders immediately; DB values override on load.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppConfig {
  // ── Branding ───────────────────────────────────────────────────────────────
  company_name: string;
  logo_url: string | null;
  contact_email: string;
  primary_color: string;
  border_radius: string;

  // ── Business rules ─────────────────────────────────────────────────────────
  currency: string;
  currency_symbol: string;
  deposit_mode: boolean;
  deposit_percentage: number;
  photo_promo_percent: number;
  zip_code_pattern: RegExp;
  zip_code_pattern_raw: string;

  // ── Payments ───────────────────────────────────────────────────────────────
  stripe_publishable_key: string | null;

  // ── Webhooks ───────────────────────────────────────────────────────────────
  webhook_mode: "test" | "live";
  make_webhook_url_test: string;
  make_webhook_url_live: string;
  twin_webhook_url: string;
}

export const CONFIG_DEFAULTS: AppConfig = {
  company_name: "My Business",
  logo_url: null,
  contact_email: "",
  primary_color: "#0d9488",
  border_radius: "0.625",
  currency: "USD",
  currency_symbol: "$",
  deposit_mode: false,
  deposit_percentage: 25,
  photo_promo_percent: 5,
  zip_code_pattern: /^\d{5}(?:-\d{4})?$/,
  zip_code_pattern_raw: "^\\d{5}(?:-\\d{4})?$",
  stripe_publishable_key: null,
  webhook_mode: "test",
  make_webhook_url_test: "",
  make_webhook_url_live: "",
  twin_webhook_url: "",
};

function parseRows(rows: { key: string; value: string | null }[]): AppConfig {
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value != null) map[r.key] = r.value;

  const patternRaw = map.zip_code_pattern ?? CONFIG_DEFAULTS.zip_code_pattern_raw;
  let pattern = CONFIG_DEFAULTS.zip_code_pattern;
  try { pattern = new RegExp(patternRaw); } catch { /* keep default */ }

  return {
    company_name: map.company_name ?? CONFIG_DEFAULTS.company_name,
    logo_url: map.company_logo_url ?? map.logo_url ?? null,
    contact_email: map.contact_email ?? "",
    primary_color: map.primary_color ?? CONFIG_DEFAULTS.primary_color,
    border_radius: map.border_radius ?? CONFIG_DEFAULTS.border_radius,
    currency: map.currency ?? CONFIG_DEFAULTS.currency,
    currency_symbol: map.currency_symbol ?? CONFIG_DEFAULTS.currency_symbol,
    deposit_mode: map.deposit_mode === "true",
    deposit_percentage: Number(map.deposit_percentage ?? CONFIG_DEFAULTS.deposit_percentage),
    photo_promo_percent: Number(map.photo_promo_percent ?? CONFIG_DEFAULTS.photo_promo_percent),
    zip_code_pattern: pattern,
    zip_code_pattern_raw: patternRaw,
    stripe_publishable_key: map.stripe_publishable_key ?? null,
    webhook_mode: (map.webhook_mode === "live" ? "live" : "test") as "test" | "live",
    make_webhook_url_test: map.make_webhook_url_test ?? "",
    make_webhook_url_live: map.make_webhook_url_live ?? "",
    twin_webhook_url: map.twin_webhook_url ?? "",
  };
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) setConfig(parseRows(data));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel("app_config_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  return { config, loading, reload };
}
