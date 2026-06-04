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

  // ── Analytics & tracking ───────────────────────────────────────────────────
  tracking_enabled: boolean;
  ga4_measurement_id: string;
  google_ads_conversion_id: string;
  google_ads_conversion_label: string;

  // ── i18n ───────────────────────────────────────────────────────────────────
  widget_language: string;

  // ── Add-on flags (no-key addons toggled via app_settings) ─────────────────
  addon_promo_codes_enabled: boolean;
  addon_cancellation_flow_enabled: boolean;
  addon_booking_reminders_enabled: boolean;
  addon_customer_portal_enabled: boolean;
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
  tracking_enabled: false,
  ga4_measurement_id: "",
  google_ads_conversion_id: "",
  google_ads_conversion_label: "",
  widget_language: "en",
  addon_promo_codes_enabled: false,
  addon_cancellation_flow_enabled: false,
  addon_booking_reminders_enabled: false,
  addon_customer_portal_enabled: false,
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
    tracking_enabled: map.tracking_enabled === "true",
    ga4_measurement_id: map.ga4_measurement_id ?? "",
    google_ads_conversion_id: map.google_ads_conversion_id ?? "",
    google_ads_conversion_label: map.google_ads_conversion_label ?? "",
    widget_language: map.widget_language ?? "en",
    addon_promo_codes_enabled: map.addon_promo_codes_enabled === "true",
    addon_cancellation_flow_enabled: map.addon_cancellation_flow_enabled === "true",
    addon_booking_reminders_enabled: map.addon_booking_reminders_enabled === "true",
    addon_customer_portal_enabled: map.addon_customer_portal_enabled === "true",
  };
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAULTS);
  const [rawSettings, setRawSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) {
      const map: Record<string, string> = {};
      for (const r of data) if (r.value != null) map[r.key] = r.value;
      setRawSettings(map);
      setConfig(parseRows(data));
    }
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

  return { config, rawSettings, loading, reload };
}
