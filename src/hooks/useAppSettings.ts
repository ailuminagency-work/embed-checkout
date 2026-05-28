import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  company_name: string;
  company_logo_url: string | null;
  primary_color: string;
  border_radius: string;
  deposit_mode: boolean;
  deposit_percentage: number;
  photo_promo_percent: number;
  stripe_publishable_key: string | null;
}

const DEFAULTS: AppSettings = {
  company_name: "CleanSlate Hauling",
  company_logo_url: null,
  primary_color: "#0d9488",
  border_radius: "0.625",
  deposit_mode: false,
  deposit_percentage: 25,
  photo_promo_percent: 5,
  stripe_publishable_key: null,
};

function parseSettings(rows: { key: string; value: string | null }[]): AppSettings {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    company_name: map.company_name ?? DEFAULTS.company_name,
    company_logo_url: map.company_logo_url ?? null,
    primary_color: map.primary_color ?? DEFAULTS.primary_color,
    border_radius: map.border_radius ?? DEFAULTS.border_radius,
    deposit_mode: map.deposit_mode === "true",
    deposit_percentage: Number(map.deposit_percentage ?? DEFAULTS.deposit_percentage),
    photo_promo_percent: Number(map.photo_promo_percent ?? DEFAULTS.photo_promo_percent),
    stripe_publishable_key: map.stripe_publishable_key ?? null,
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) setSettings(parseSettings(data));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel("app_settings_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  return { settings, loading, reload };
}
