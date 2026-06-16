import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { ZipPricingManager } from "@/components/admin/ZipPricingManager";
import type { StepProps } from "./SetupWizard";

export function ServiceAreaStep({ rawSettings, reload }: StepProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(rawSettings.enable_zip_restrictions !== "false");
  const [outOfArea, setOutOfArea] = useState(rawSettings.out_of_area_behavior === "allow" ? "allow" : "block");
  const [saving, setSaving] = useState(false);

  // Persist the toggle immediately so the live widget reflects it without a full save.
  const toggle = async (val: boolean) => {
    setEnabled(val);
    await supabase.from("app_settings").upsert(
      { key: "enable_zip_restrictions", value: val ? "true" : "false" }, { onConflict: "key" });
    await reload();
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert([
      { key: "enable_zip_restrictions", value: enabled ? "true" : "false" },
      { key: "out_of_area_behavior", value: outOfArea },
      { key: "setup_step_area", value: "true" },
    ], { onConflict: "key" });
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Save failed", description: error.message });
    else { toast({ title: "Service area saved" }); await reload(); }
  };

  return (
    <div className="space-y-5">
      <ToggleRow
        label="Enable Service Area Restrictions"
        description={enabled
          ? "Customers must enter a ZIP code. Only listed ZIPs are accepted, with per-zone minimum prices."
          : "Bookings accepted from any location. No ZIP check, no area minimums — customers skip ZIP entry."}
        enabled={enabled}
        onToggle={toggle}
      />

      {enabled && (
        <>
          <div className="rounded-lg border border-border p-4">
            <Label className="text-sm font-medium text-foreground">ZIP codes not in your list</Label>
            <RadioGroup value={outOfArea} onValueChange={setOutOfArea} className="mt-2 space-y-2">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="block" className="mt-0.5" />
                <span><strong>Block</strong> — show an "outside service area" message</span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="allow" className="mt-0.5" />
                <span><strong>Allow</strong> — accept the booking but apply no minimum price</span>
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Service Area ZIP Codes & Minimums</Label>
            <div className="mt-2 rounded-lg border border-border p-1">
              <ZipPricingManager />
            </div>
          </div>
        </>
      )}

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save Service Area
      </Button>
    </div>
  );
}
