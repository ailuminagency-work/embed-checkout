import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/hooks/useAppConfig";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface HealthStatus { ok: boolean; detail: string; loading: boolean; }

function StatusRow({ label, status }: { label: string; status: HealthStatus }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{status.loading ? "Checking…" : status.detail}</p>
      </div>
      {status.loading
        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : status.ok
          ? <CheckCircle2 className="h-5 w-5 text-success" />
          : <XCircle className="h-5 w-5 text-destructive" />}
    </div>
  );
}

const EDITABLE_KEYS = [
  { key: "company_name",        label: "Company Name",          type: "text" },
  { key: "contact_email",       label: "Contact Email",          type: "email" },
  { key: "currency",            label: "Currency Code (e.g. USD)", type: "text" },
  { key: "currency_symbol",     label: "Currency Symbol (e.g. $)", type: "text" },
  { key: "stripe_publishable_key", label: "Stripe Publishable Key (pk_…)", type: "text" },
  { key: "deposit_mode",        label: "Deposit Mode",           type: "boolean" },
  { key: "deposit_percentage",  label: "Deposit Percentage (%)", type: "number" },
  { key: "photo_promo_percent", label: "Photo Promo Discount (%)", type: "number" },
  { key: "webhook_mode",        label: "Webhook Mode (test/live)", type: "text" },
  { key: "make_webhook_url_test", label: "Make.com Webhook URL (test)", type: "url" },
  { key: "make_webhook_url_live", label: "Make.com Webhook URL (live)", type: "url" },
  { key: "twin_webhook_url",    label: "Twin AI Webhook URL",    type: "url" },
];

export function OnboardingTab() {
  const { toast } = useToast();
  const { config, reload: reloadConfig } = useAppConfig();
  const [health, setHealth] = useState<Record<string, HealthStatus>>({
    stripe:   { ok: false, detail: "", loading: true },
    webhooks: { ok: false, detail: "", loading: true },
    zip:      { ok: false, detail: "", loading: true },
    email:    { ok: false, detail: "", loading: true },
  });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const runChecks = async () => {
    setHealth(h => Object.fromEntries(Object.keys(h).map(k => [k, { ...h[k], loading: true }])));

    // Stripe check
    const stripeKey = config.stripe_publishable_key;
    setHealth(h => ({ ...h, stripe: { ok: !!stripeKey, detail: stripeKey ? `Connected (${stripeKey.slice(0, 12)}…)` : "No publishable key set", loading: false } }));

    // ZIP pricing check
    const { count } = await supabase.from("zip_pricing").select("*", { count: "exact", head: true }).eq("active", true);
    setHealth(h => ({ ...h, zip: { ok: (count ?? 0) > 0, detail: `${count ?? 0} active ZIP codes`, loading: false } }));

    // Webhook check
    const { data: wq } = await supabase.from("webhook_queue").select("status, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!wq) {
      setHealth(h => ({ ...h, webhooks: { ok: false, detail: "No webhook attempts yet", loading: false } }));
    } else {
      const ok = wq.status === "delivered";
      setHealth(h => ({ ...h, webhooks: { ok, detail: `Last delivery: ${wq.status} (${new Date(wq.created_at).toLocaleDateString()})`, loading: false } }));
    }

    // Email check
    const { data: el } = await supabase.from("email_logs").select("status, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!el) {
      setHealth(h => ({ ...h, email: { ok: false, detail: "No emails sent yet", loading: false } }));
    } else {
      const ok = el.status === "sent";
      setHealth(h => ({ ...h, email: { ok, detail: `Last email: ${el.status} (${new Date(el.created_at).toLocaleDateString()})`, loading: false } }));
    }
  };

  useEffect(() => {
    // Load current settings into editable form
    supabase.from("app_settings").select("key, value").then(({ data }) => {
      if (data) setSettings(Object.fromEntries(data.map(r => [r.key, r.value ?? ""])));
    });
    runChecks();
  }, [config.stripe_publishable_key]);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(
      EDITABLE_KEYS.map(({ key }) => {
        const value = settings[key] ?? "";
        return supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
      })
    );
    setSaving(false);
    toast({ title: "Settings saved" });
    reloadConfig();
    runChecks();
  };

  const embedCode = `<script
  src="https://cdn.yourdomain.com/widget.js"
  data-supabase-url="${import.meta.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co'}"
  data-supabase-key="${import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20) || 'eyJ...'}..."
></script>`;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Health checks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Setup Status</h2>
          <Button size="sm" variant="outline" onClick={runChecks}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
        <div className="border border-border rounded-lg bg-card px-4">
          <StatusRow label="Stripe Connected" status={health.stripe} />
          <StatusRow label="Webhooks Working" status={health.webhooks} />
          <StatusRow label="ZIP Pricing Loaded" status={health.zip} />
          <StatusRow label="Confirmation Emails" status={health.email} />
        </div>
      </section>

      {/* Settings editor */}
      <section>
        <h2 className="text-base font-semibold mb-3">Business Settings</h2>
        <div className="space-y-4 border border-border rounded-lg bg-card p-4">
          {EDITABLE_KEYS.map(({ key, label, type }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs font-medium">{label}</Label>
              {type === "boolean" ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={settings[key] === "true"}
                    onCheckedChange={v => setSettings(s => ({ ...s, [key]: v ? "true" : "false" }))}
                  />
                  <span className="text-sm text-muted-foreground">{settings[key] === "true" ? "Enabled" : "Disabled"}</span>
                </div>
              ) : type === "url" ? (
                <Input
                  type="url"
                  value={settings[key] ?? ""}
                  onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                  placeholder="https://…"
                  className="text-sm"
                />
              ) : (
                <Input
                  type={type}
                  value={settings[key] ?? ""}
                  onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                  className="text-sm"
                />
              )}
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save All Settings
          </Button>
        </div>
      </section>

      {/* Embed code */}
      <section>
        <h2 className="text-base font-semibold mb-3">Embed Code</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Copy this script tag into any website. Build <code className="text-xs bg-muted px-1 py-0.5 rounded">npm run build:widget</code> first to generate <code className="text-xs bg-muted px-1 py-0.5 rounded">dist/widget.js</code>.
        </p>
        <Textarea readOnly value={embedCode} rows={5} className="font-mono text-xs bg-muted/40" onClick={e => (e.target as HTMLTextAreaElement).select()} />
      </section>
    </div>
  );
}
