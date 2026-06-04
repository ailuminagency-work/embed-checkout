import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADDON_REGISTRY, KEY_LABELS, type Addon, type AddonCategory } from "@/lib/addons";
import { useAddons } from "@/hooks/useAddons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Bell, CalendarX, Star, Tag, UserCircle,
  BarChart, TrendingUp, Globe, ExternalLink, ChevronDown, ChevronUp,
  Loader2, Plus, Trash2, CheckCircle2, XCircle,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare, Bell, CalendarX, Star, Tag, UserCircle,
  BarChart, TrendingUp, Globe,
};

const CATEGORY_LABELS: Record<AddonCategory, string> = {
  communication: "Communication",
  marketing: "Marketing",
  operations: "Operations",
  analytics: "Analytics",
};

const CATEGORY_ORDER: AddonCategory[] = ["communication", "marketing", "operations", "analytics"];

interface PromoCode {
  id: string;
  code: string;
  discount_type: "fixed" | "percent";
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
}

function PromoCodesPanel() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", discount_type: "percent" as "fixed" | "percent", discount_value: "", max_uses: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    setCodes((data ?? []) as PromoCode[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.code.trim() || !form.discount_value) return;
    setAdding(true);
    const { error } = await supabase.from("promo_codes").insert({
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setForm({ code: "", discount_type: "percent", discount_value: "", max_uses: "" });
      await load();
      toast({ title: "Promo code created" });
    }
    setAdding(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("promo_codes").update({ active }).eq("id", id);
    await load();
  };

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Manage Codes</p>

      {/* Create new code */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">Code</Label>
          <Input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="SAVE20"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Type</Label>
          <select
            value={form.discount_type}
            onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as "fixed" | "percent" }))}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="percent">% off</option>
            <option value="fixed">$ off</option>
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Value</Label>
          <Input
            type="number"
            value={form.discount_value}
            onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
            placeholder={form.discount_type === "percent" ? "20" : "10"}
            className="mt-1"
          />
        </div>
        <Button onClick={handleAdd} disabled={adding || !form.code || !form.discount_value} size="sm">
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
        </Button>
      </div>

      {/* Code list */}
      {codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No promo codes yet.</p>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
              <div className="flex items-center gap-3">
                {c.active ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div>
                  <p className="text-sm font-mono font-medium text-foreground">{c.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.discount_type === "percent" ? `${c.discount_value}% off` : `$${c.discount_value} off`}
                    {c.max_uses ? ` · ${c.uses_count}/${c.max_uses} uses` : ` · ${c.uses_count} uses`}
                  </p>
                </div>
              </div>
              <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c.id, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddonCard({ addon, rawSettings, onSave }: {
  addon: Addon;
  rawSettings: Record<string, string>;
  onSave: (updates: Record<string, string>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(addon.requiredKeys.map((k) => [k, rawSettings[k] ?? ""])),
  );
  const [saving, setSaving] = useState(false);

  const Icon = ICON_MAP[addon.icon] ?? Tag;
  const isActive = addon.status === "active";

  const handleActivate = async () => {
    setSaving(true);
    await onSave(values);
    setSaving(false);
    setExpanded(false);
    toast({ title: isActive ? `${addon.name} updated` : `${addon.name} activated` });
  };

  const handleDisable = async () => {
    setSaving(true);
    if (addon.requiredKeys.length === 0) {
      await onSave({ [`addon_${addon.id}_enabled`]: "false" });
    } else {
      await onSave(Object.fromEntries(addon.requiredKeys.map((k) => [k, ""])));
    }
    setSaving(false);
    setExpanded(false);
    toast({ title: `${addon.name} disabled` });
  };

  const handleNoKeyEnable = async (enabled: boolean) => {
    setSaving(true);
    await onSave({ [`addon_${addon.id}_enabled`]: enabled ? "true" : "false" });
    setSaving(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{addon.name}</CardTitle>
                <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                  {isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardDescription className="mt-0.5 text-xs leading-relaxed">{addon.description}</CardDescription>
            </div>
          </div>

          {/* No-key addon: simple toggle */}
          {addon.requiredKeys.length === 0 && addon.id !== "promo_codes" && (
            <Switch
              checked={isActive}
              onCheckedChange={handleNoKeyEnable}
              disabled={saving}
              className="shrink-0 mt-0.5"
            />
          )}

          {/* Key-based addon or promo codes: expandable */}
          {(addon.requiredKeys.length > 0 || addon.id === "promo_codes") && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {/* Key inputs */}
          {addon.requiredKeys.length > 0 && (
            <>
              <div className="space-y-3">
                {addon.requiredKeys.map((key) => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground">{KEY_LABELS[key] ?? key}</Label>
                    <Input
                      value={values[key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      placeholder={KEY_LABELS[key] ?? key}
                      type={key.includes("token") || key.includes("auth") ? "password" : "text"}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                {addon.docsUrl ? (
                  <a href={addon.docsUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Setup Guide <ExternalLink className="h-3 w-3" />
                  </a>
                ) : <span />}

                <div className="flex gap-2">
                  {isActive && (
                    <Button variant="outline" size="sm" onClick={handleDisable} disabled={saving}>
                      Disable
                    </Button>
                  )}
                  <Button size="sm" onClick={handleActivate} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isActive ? "Update" : "Activate"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Promo codes panel */}
          {addon.id === "promo_codes" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Enable promo codes at checkout</span>
                <Switch
                  checked={isActive}
                  onCheckedChange={handleNoKeyEnable}
                  disabled={saving}
                />
              </div>
              {isActive && <PromoCodesPanel />}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function AddonsManager() {
  const [rawSettings, setRawSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) setRawSettings(Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value ?? ""])));
    setLoading(false);
  };

  useEffect(() => { loadSettings(); }, []);

  const addons = useAddons(rawSettings);

  const handleSave = async (updates: Record<string, string>) => {
    const rows = Object.entries(updates).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      await loadSettings();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Add-ons</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enable premium features by entering the required credentials. Disabled add-ons have zero impact on the booking flow.
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = addons.filter((a) => a.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="space-y-3">
              {items.map((addon) => (
                <AddonCard
                  key={addon.id}
                  addon={addon}
                  rawSettings={rawSettings}
                  onSave={handleSave}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
