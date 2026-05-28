import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Paintbrush } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThemeSettings {
  company_name: string;
  company_logo_url: string;
  primary_color: string;
  border_radius: string;
}

const DEFAULTS: ThemeSettings = {
  company_name: "",
  company_logo_url: "",
  primary_color: "#0d9488",
  border_radius: "0.625",
};

const PRESET_COLORS = [
  { hex: "#0d9488", label: "Teal" },
  { hex: "#7c3aed", label: "Purple" },
  { hex: "#2563eb", label: "Blue" },
  { hex: "#dc2626", label: "Red" },
  { hex: "#ea580c", label: "Orange" },
  { hex: "#16a34a", label: "Green" },
  { hex: "#0891b2", label: "Cyan" },
  { hex: "#db2777", label: "Pink" },
];

// ---------------------------------------------------------------------------
// Color conversion helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}

function hexToHsl(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyColorToDom(hex: string) {
  document.documentElement.style.setProperty("--primary", hexToHsl(hex));
}

function applyRadiusToDom(radius: string) {
  document.documentElement.style.setProperty("--radius", `${radius}rem`);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground mb-4">{children}</h3>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Preview
// ---------------------------------------------------------------------------

function LivePreview({
  color,
  radius,
  companyName,
}: {
  color: string;
  radius: string;
  companyName: string;
}) {
  const radiusPx = `${parseFloat(radius) * 16}px`;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Paintbrush className="h-4 w-4 text-muted-foreground" />
          Live Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini brand header */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="h-7 w-7 flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: color, borderRadius: radiusPx }}
            >
              {companyName ? companyName[0].toUpperCase() : "A"}
            </div>
            <span className="text-sm font-semibold text-foreground truncate">
              {companyName || "Your Company"}
            </span>
          </div>
        </div>

        {/* Preview button */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Button
          </p>
          <button
            className="w-full py-2 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color, borderRadius: radiusPx }}
          >
            Book Now
          </button>
          <button
            className="w-full py-2 px-4 text-sm font-medium border transition-colors hover:bg-muted/50"
            style={{
              color: color,
              borderColor: color,
              borderRadius: radiusPx,
              background: "transparent",
            }}
          >
            Learn More
          </button>
        </div>

        {/* Preview card */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Card
          </p>
          <div
            className="border bg-card p-3 shadow-sm"
            style={{ borderRadius: radiusPx }}
          >
            <div
              className="h-1.5 mb-2"
              style={{ backgroundColor: color, borderRadius: "9999px", width: "40%" }}
            />
            <div className="h-2 bg-muted rounded-full mb-1.5 w-full" />
            <div className="h-2 bg-muted rounded-full w-3/4" />
            <div className="mt-3 flex justify-end">
              <div
                className="px-3 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: color, borderRadius: radiusPx }}
              >
                Action
              </div>
            </div>
          </div>
        </div>

        {/* Preview input */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Input
          </p>
          <input
            readOnly
            value="customer@example.com"
            className="w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-offset-1"
            style={{ borderRadius: radiusPx, focusRingColor: color } as React.CSSProperties}
          />
        </div>

        {/* Color chip */}
        <div className="flex items-center gap-3 pt-1">
          <div
            className="h-8 w-8 shrink-0 border shadow-sm"
            style={{ backgroundColor: color, borderRadius: radiusPx }}
          />
          <div>
            <p className="text-xs font-mono font-semibold text-foreground">{color}</p>
            <p className="text-xs text-muted-foreground">Border radius: {radius}rem</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThemeManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [settings, setSettings] = useState<ThemeSettings>({ ...DEFAULTS });
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Track a stable "saved" copy to compute dirtiness
  const savedRef = useRef<ThemeSettings>({ ...DEFAULTS });

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["company_name", "company_logo_url", "primary_color", "border_radius"]);

      if (error) {
        toast({
          variant: "destructive",
          title: "Failed to load theme settings",
          description: error.message,
        });
      } else if (data) {
        const map: Record<string, string> = {};
        data.forEach(({ key, value }) => {
          if (value != null) map[key] = value;
        });
        const loaded: ThemeSettings = {
          company_name: map.company_name ?? DEFAULTS.company_name,
          company_logo_url: map.company_logo_url ?? DEFAULTS.company_logo_url,
          primary_color: map.primary_color ?? DEFAULTS.primary_color,
          border_radius: map.border_radius ?? DEFAULTS.border_radius,
        };
        setSettings(loaded);
        savedRef.current = { ...loaded };
        applyColorToDom(loaded.primary_color);
        applyRadiusToDom(loaded.border_radius);
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const update = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      setDirty(
        next.company_name !== savedRef.current.company_name ||
          next.company_logo_url !== savedRef.current.company_logo_url ||
          next.primary_color !== savedRef.current.primary_color ||
          next.border_radius !== savedRef.current.border_radius
      );
      return next;
    });
    if (key === "primary_color") applyColorToDom(value as string);
    if (key === "border_radius") applyRadiusToDom(value as string);
  };

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    const rows = (Object.keys(settings) as (keyof ThemeSettings)[]).map((key) => ({
      key,
      value: settings[key] || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("app_settings")
      .upsert(rows, { onConflict: "key" });

    setSaving(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to save settings",
        description: error.message,
      });
    } else {
      savedRef.current = { ...settings };
      setDirty(false);
      toast({ title: "Theme settings saved" });
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const radiusVal = parseFloat(settings.border_radius);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Customize your brand colors, identity, and UI shape.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
          {!dirty && !saving && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty} size="sm">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
        {/* Left: editor panels */}
        <div className="space-y-6">
          {/* Business Identity */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Business Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Company Name">
                <Input
                  placeholder="Your Company Name"
                  value={settings.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                />
              </InfoRow>
              <InfoRow label="Logo URL">
                <Input
                  placeholder="https://example.com/logo.png"
                  value={settings.company_logo_url}
                  onChange={(e) => update("company_logo_url", e.target.value)}
                />
              </InfoRow>
              {settings.company_logo_url && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <img
                    src={settings.company_logo_url}
                    alt="Logo preview"
                    className="h-10 w-auto max-w-[120px] object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Logo preview</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brand Color */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Brand Color</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Current color + native picker */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="relative h-10 w-10 shrink-0 rounded-full border-2 border-white shadow-md ring-2 ring-border focus:outline-none focus:ring-primary"
                  style={{ backgroundColor: settings.primary_color }}
                  title="Open color picker"
                  onClick={() => colorInputRef.current?.click()}
                  aria-label="Open color picker"
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  className="sr-only"
                  value={settings.primary_color}
                  onChange={(e) => update("primary_color", e.target.value)}
                />
                <div>
                  <p className="text-sm font-mono font-semibold text-foreground">
                    {settings.primary_color}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click the swatch to open color picker
                  </p>
                </div>
              </div>

              <Separator />

              {/* Preset swatches */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
                  Presets
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {PRESET_COLORS.map(({ hex, label }) => (
                    <button
                      key={hex}
                      type="button"
                      title={label}
                      aria-label={label}
                      onClick={() => update("primary_color", hex)}
                      className={cn(
                        "relative h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
                        settings.primary_color.toLowerCase() === hex.toLowerCase()
                          ? "border-white ring-2 ring-foreground scale-110 shadow-md"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: hex }}
                    >
                      {settings.primary_color.toLowerCase() === hex.toLowerCase() && (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shape / Border Radius */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Shape</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex justify-between text-xs text-muted-foreground mb-1 select-none">
                <span>Square</span>
                <span>Rounded</span>
                <span>Pill</span>
              </div>
              <Slider
                min={0}
                max={1.5}
                step={0.125}
                value={[radiusVal]}
                onValueChange={([v]) => update("border_radius", String(v))}
                className="w-full"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Border radius
                </p>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {settings.border_radius}rem
                </span>
              </div>

              {/* Shape preview row */}
              <div className="flex gap-3 pt-1">
                {[0, 0.375, 0.75, 1.5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    title={`${r}rem`}
                    onClick={() => update("border_radius", String(r))}
                    className={cn(
                      "h-10 flex-1 border transition-colors text-xs font-medium",
                      parseFloat(settings.border_radius) === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                    style={{ borderRadius: `${r}rem` }}
                  >
                    {r === 0 ? "■" : r === 0.375 ? "▢" : r === 0.75 ? "⬜" : "●"}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: live preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <LivePreview
            color={settings.primary_color}
            radius={settings.border_radius}
            companyName={settings.company_name}
          />
        </div>
      </div>

      {/* Footer save */}
      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
