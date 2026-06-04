import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, BarChart3, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrackingSettings {
  tracking_enabled: string;
  ga4_measurement_id: string;
  google_ads_conversion_id: string;
  google_ads_conversion_label: string;
}

const KEYS = ["tracking_enabled", "ga4_measurement_id", "google_ads_conversion_id", "google_ads_conversion_label"] as const;

export function TrackingManager() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TrackingSettings>({
    tracking_enabled: "false",
    ga4_measurement_id: "",
    google_ads_conversion_id: "",
    google_ads_conversion_label: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...KEYS])
      .then(({ data }) => {
        if (data) {
          const map: Partial<TrackingSettings> = {};
          for (const row of data) map[row.key as keyof TrackingSettings] = row.value ?? "";
          setSettings((prev) => ({ ...prev, ...map }));
        }
        setLoading(false);
      });
  }, []);

  const set = (key: keyof TrackingSettings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const rows = KEYS.map((key) => ({ key, value: settings[key] }));
    const { error } = await supabase
      .from("app_settings")
      .upsert(rows, { onConflict: "key" });

    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Tracking settings saved" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabled = settings.tracking_enabled === "true";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Analytics & Conversion Tracking
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure GA4 and Google Ads conversion tracking. No customer PII is sent — only event names, counts, and amounts.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Events fired: <code className="text-xs bg-muted px-1 py-0.5 rounded">booking_started</code>,{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">items_selected</code>,{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">date_selected</code>,{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">checkout_started</code>,{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">booking_confirmed</code>.
          All events also push to <code className="text-xs bg-muted px-1 py-0.5 rounded">window.dataLayer</code> for GTM.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enable Tracking</CardTitle>
              <CardDescription>Master switch — disabling this stops all analytics events.</CardDescription>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => set("tracking_enabled", v ? "true" : "false")}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className={!enabled ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Google Analytics 4</CardTitle>
          <CardDescription>
            Find your Measurement ID in GA4 → Admin → Data Streams → your stream.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="ga4-id">Measurement ID</Label>
            <Input
              id="ga4-id"
              placeholder="G-XXXXXXXXXX"
              value={settings.ga4_measurement_id}
              onChange={(e) => set("ga4_measurement_id", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The gtag.js script is loaded automatically — do not add it separately to your page.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className={!enabled ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Google Ads Conversion</CardTitle>
          <CardDescription>
            Fires a conversion event on booking_confirmed. Find these in Google Ads → Goals → Conversions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ads-id">Conversion ID</Label>
            <Input
              id="ads-id"
              placeholder="AW-XXXXXXXXX"
              value={settings.google_ads_conversion_id}
              onChange={(e) => set("google_ads_conversion_id", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ads-label">Conversion Label</Label>
            <Input
              id="ads-label"
              placeholder="AbCdEfGhIjKlMnOp"
              value={settings.google_ads_conversion_label}
              onChange={(e) => set("google_ads_conversion_label", e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Requires a GA4 Measurement ID above — Google Ads uses the same gtag.js load.
          </p>
        </CardContent>
      </Card>

      <Card className={!enabled ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Google Tag Manager</CardTitle>
          <CardDescription>
            No configuration needed. All events are automatically pushed to{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">window.dataLayer</code> regardless of the settings above.
            Install GTM on your page as normal and create triggers on the event names listed above.
          </CardDescription>
        </CardHeader>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Tracking Settings</>}
      </Button>
    </div>
  );
}
