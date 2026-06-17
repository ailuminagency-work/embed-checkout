// Change 1: All client-specific config comes from app_settings at runtime.
// This hook is the single source of truth for config in the frontend.
// Starts with safe defaults so the UI renders immediately; DB values override on load.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppConfig {
  // ── Branding ───────────────────────────────────────────────────────────────
  company_name: string;
  business_name: string;
  widget_title: string;
  show_logo: boolean;
  logo_url: string | null;
  contact_email: string;
  admin_notification_email: string;
  primary_color: string;
  border_radius: string;

  // ── Service area ───────────────────────────────────────────────────────────
  enable_zip_restrictions: boolean;
  out_of_area_behavior: "block" | "allow";

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
  stripe_mode: "test" | "live";
  stripe_publishable_key_test: string | null;
  stripe_publishable_key_live: string | null;
  terms_version: string;
  receipt_email_enabled: boolean;

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
  business_name: "My Business",
  widget_title: "Book a Pickup",
  show_logo: true,
  logo_url: null,
  contact_email: "",
  admin_notification_email: "",
  primary_color: "#0d9488",
  border_radius: "0.625",
  enable_zip_restrictions: true,
  out_of_area_behavior: "block",
  currency: "USD",
  currency_symbol: "$",
  deposit_mode: false,
  deposit_percentage: 25,
  photo_promo_percent: 5,
  zip_code_pattern: /^\d{5}(?:-\d{4})?$/,
  zip_code_pattern_raw: "^\\d{5}(?:-\\d{4})?$",
  stripe_publishable_key: null,
  stripe_mode: "test",
  stripe_publishable_key_test: null,
  stripe_publishable_key_live: null,
  terms_version: "1.0",
  receipt_email_enabled: true,
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

function resolveStripePublishableKey(map: Record<string, string>): string | null {
  const mode = map.stripe_mode === "live" ? "live" : "test";
  return (
    (mode === "live" ? map.stripe_publishable_key_live : map.stripe_publishable_key_test) ||
    map.stripe_publishable_key ||
    null
  );
}

function parseRows(rows: { key: string; value: string | null }[]): AppConfig {
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value != null) map[r.key] = r.value;

  const patternRaw = map.zip_code_pattern ?? CONFIG_DEFAULTS.zip_code_pattern_raw;
  let pattern = CONFIG_DEFAULTS.zip_code_pattern;
  try { pattern = new RegExp(patternRaw); } catch { /* keep default */ }

  const businessName = map.business_name || map.company_name || CONFIG_DEFAULTS.company_name;

  return {
    company_name: map.company_name ?? CONFIG_DEFAULTS.company_name,
    business_name: businessName,
    widget_title: map.widget_title || businessName,
    show_logo: map.show_logo !== "false",
    logo_url: map.company_logo_url ?? map.logo_url ?? null,
    contact_email: map.contact_email ?? "",
    admin_notification_email: map.admin_notification_email ?? "",
    primary_color: map.primary_color ?? CONFIG_DEFAULTS.primary_color,
    border_radius: map.border_radius ?? CONFIG_DEFAULTS.border_radius,
    enable_zip_restrictions: map.enable_zip_restrictions !== "false",
    out_of_area_behavior: (map.out_of_area_behavior === "allow" ? "allow" : "block") as "block" | "allow",
    currency: map.currency ?? CONFIG_DEFAULTS.currency,
    currency_symbol: map.currency_symbol ?? CONFIG_DEFAULTS.currency_symbol,
    deposit_mode: map.deposit_mode === "true",
    deposit_percentage: Number(map.deposit_percentage ?? CONFIG_DEFAULTS.deposit_percentage),
    photo_promo_percent: Number(map.photo_promo_percent ?? CONFIG_DEFAULTS.photo_promo_percent),
    zip_code_pattern: pattern,
    zip_code_pattern_raw: patternRaw,
    stripe_publishable_key: resolveStripePublishableKey(map),
    stripe_mode: (map.stripe_mode === "live" ? "live" : "test") as "test" | "live",
    stripe_publishable_key_test: map.stripe_publishable_key_test ?? null,
    stripe_publishable_key_live: map.stripe_publishable_key_live ?? null,
    terms_version: map.terms_version ?? "1.0",
    receipt_email_enabled: map.receipt_email_enabled !== "false",
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
