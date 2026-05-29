import { supabase } from "@/integrations/supabase/client";

export async function fetchSettings() {
  return supabase.from("app_settings").select("key, value");
}

export async function updateSettings(updates: Record<string, string | null>) {
  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));
  return supabase.from("app_settings").upsert(rows, { onConflict: "key" });
}

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}
