import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Save } from "lucide-react";
import type { StepProps } from "./SetupWizard";

// Always store primary_color WITH a leading '#' — ThemeProvider/useAppSettings depend on it.
function normalizeHex(v: string): string {
  const clean = v.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return `#${clean}`;
}

export function BrandSetupStep({ rawSettings, reload }: StepProps) {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState(rawSettings.business_name || rawSettings.company_name || "");
  const [widgetTitle, setWidgetTitle] = useState(rawSettings.widget_title || "");
  const [primaryColor, setPrimaryColor] = useState(rawSettings.primary_color || "#0d9488");
  const [showLogo, setShowLogo] = useState(rawSettings.show_logo !== "false");
  const [logoUrl, setLogoUrl] = useState(rawSettings.company_logo_url || rawSettings.logo_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Logo must be under 2MB." });
      return;
    }
    setUploading(true);
    const path = `logos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
    } else {
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast({ title: "Logo uploaded" });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = [
      { key: "business_name", value: businessName },
      { key: "company_name", value: businessName },         // keep canonical key in sync
      { key: "widget_title", value: widgetTitle },
      { key: "primary_color", value: primaryColor },
      { key: "show_logo", value: showLogo ? "true" : "false" },
      { key: "company_logo_url", value: logoUrl },
      { key: "setup_step_brand", value: "true" },
    ];
    const { error } = await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Brand saved" });
      await reload();
    }
  };

  const previewTitle = widgetTitle || businessName || "Book a Pickup";

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs text-muted-foreground">Business Name</Label>
        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="CleanSlate Hauling" className="mt-1" />
        <p className="text-xs text-muted-foreground mt-1">Used as the widget title and email sender name.</p>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Widget Title (optional)</Label>
        <Input value={widgetTitle} onChange={(e) => setWidgetTitle(e.target.value)} placeholder="Leave blank to use Business Name" className="mt-1" />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Brand Color</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={primaryColor.length === 7 ? primaryColor : "#0d9488"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-12 rounded border border-input bg-background cursor-pointer"
            aria-label="Brand color"
          />
          <Input value={primaryColor} onChange={(e) => setPrimaryColor(normalizeHex(e.target.value))} className="w-32 font-mono" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Used for buttons and accents in the booking widget.</p>
      </div>

      <ToggleRow
        label="Show Logo in Widget"
        description="On: display your logo at the top of the widget. Off: show only your business name."
        enabled={showLogo}
        onToggle={setShowLogo}
      />

      {showLogo && (
        <div className="rounded-lg border border-border p-4">
          <Label className="text-xs text-muted-foreground">Logo</Label>
          <div className="flex items-center gap-3 mt-2">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain rounded border border-border bg-background p-1" />}
            <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer rounded-md border border-input px-3 py-1.5 hover:bg-accent">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {logoUrl ? "Replace" : "Upload"}
              <input type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">PNG or SVG recommended. Max 2MB.</p>
        </div>
      )}

      {/* Live preview */}
      <div>
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div className="mt-1 flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3">
          {showLogo && logoUrl && <img src={logoUrl} alt="" className="h-7 w-auto object-contain" />}
          <span className="font-bold text-base" style={{ color: primaryColor.length === 7 ? primaryColor : undefined }}>{previewTitle}</span>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || !businessName}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save Brand
      </Button>
    </div>
  );
}
