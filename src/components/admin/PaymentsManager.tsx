import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentEvent {
  id: string;
  payment_intent_id: string;
  event_type: string;
  stripe_mode: string;
  amount_cents: number | null;
  currency: string | null;
  customer_email: string | null;
  error_message: string | null;
  created_at: string;
}

interface Settings {
  stripe_mode: string;
  stripe_publishable_key_test: string;
  stripe_publishable_key_live: string;
  deposit_mode: string;
  deposit_percentage: string;
  terms_version: string;
  receipt_email_enabled: string;
}

const SETTING_KEYS = [
  "stripe_mode", "stripe_publishable_key_test", "stripe_publishable_key_live",
  "deposit_mode", "deposit_percentage",
  "terms_version", "receipt_email_enabled",
] as const;

function fmt(cents: number | null, currency = "usd") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function EventTypeBadge({ type }: { type: string }) {
  if (type === "payment_succeeded") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">Succeeded</Badge>;
  if (type === "payment_failed")    return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="secondary">{type}</Badge>;
}

export function PaymentsManager() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>({
    stripe_mode: "test",
    stripe_publishable_key_test: "",
    stripe_publishable_key_live: "",
    deposit_mode: "false",
    deposit_percentage: "25",
    terms_version: "1.0",
    receipt_email_enabled: "true",
  });
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [{ data: rows }, { data: evts }] = await Promise.all([
      supabase.from("app_settings").select("key, value").in("key", [...SETTING_KEYS]),
      supabase.from("payment_events").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (rows) {
      const map: Partial<Settings> = {};
      for (const r of rows) map[r.key as keyof Settings] = r.value ?? "";
      setSettings((prev) => ({ ...prev, ...map }));
    }
    setEvents((evts ?? []) as PaymentEvent[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const set = (key: keyof Settings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const rows = SETTING_KEYS.map((k) => ({ key: k, value: settings[k] }));
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Payment settings saved" });
    }
    setSaving(false);
  };

  const handleRefreshEvents = async () => {
    setRefreshing(true);
    const { data } = await supabase.from("payment_events").select("*").order("created_at", { ascending: false }).limit(50);
    setEvents((data ?? []) as PaymentEvent[]);
    setRefreshing(false);
  };

  const validateKey = (key: string, mode: "test" | "live") => {
    if (!key) return null;
    const prefix = mode === "test" ? "pk_test_" : "pk_live_";
    return key.startsWith(prefix);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isTestMode = settings.stripe_mode === "test";
  const testKeyValid = validateKey(settings.stripe_publishable_key_test, "test");
  const liveKeyValid = validateKey(settings.stripe_publishable_key_live, "live");
  const depositEnabled = settings.deposit_mode === "true";
  const depositPct = parseFloat(settings.deposit_percentage || "25");

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Payments & Stripe</h2>

      {/* Mode warning */}
      {isTestMode && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Test mode active</strong> — no real charges will be made. Switch to Live mode when you're ready to accept real payments.
          </AlertDescription>
        </Alert>
      )}

      {/* Stripe Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stripe Configuration</CardTitle>
          <CardDescription>Keys are published per-mode. Switching mode takes effect immediately — no page reload required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Mode</p>
              <p className="text-xs text-muted-foreground">{isTestMode ? "Test — safe for development" : "Live — real charges"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${isTestMode ? "text-primary" : "text-muted-foreground"}`}>Test</span>
              <Switch
                checked={!isTestMode}
                onCheckedChange={(v) => set("stripe_mode", v ? "live" : "test")}
              />
              <span className={`text-xs font-medium ${!isTestMode ? "text-primary" : "text-muted-foreground"}`}>Live</span>
            </div>
          </div>

          {/* Test key */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              Publishable Key (Test)
              {testKeyValid === true && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {testKeyValid === false && <XCircle className="h-3.5 w-3.5 text-destructive" />}
            </Label>
            <Input
              value={settings.stripe_publishable_key_test}
              onChange={(e) => set("stripe_publishable_key_test", e.target.value)}
              placeholder="pk_test_..."
            />
          </div>

          {/* Live key */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              Publishable Key (Live)
              {liveKeyValid === true && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {liveKeyValid === false && <XCircle className="h-3.5 w-3.5 text-destructive" />}
            </Label>
            <Input
              value={settings.stripe_publishable_key_live}
              onChange={(e) => set("stripe_publishable_key_live", e.target.value)}
              placeholder="pk_live_..."
            />
            <p className="text-xs text-muted-foreground">Add secret keys (sk_...) and webhook secrets to Supabase Vault — never store them here.</p>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Mode */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Deposit Mode</CardTitle>
              <CardDescription>Charge only a percentage upfront instead of the full amount.</CardDescription>
            </div>
            <Switch checked={depositEnabled} onCheckedChange={(v) => set("deposit_mode", v ? "true" : "false")} />
          </div>
        </CardHeader>
        {depositEnabled && (
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deposit Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="99"
                  value={settings.deposit_percentage}
                  onChange={(e) => set("deposit_percentage", e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
              Customer will be charged {depositPct}% of their total at booking. The balance is collected on the day of service.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Terms version */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Terms & Compliance</CardTitle>
          <CardDescription>Version number is recorded with every booking for audit purposes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Terms Version</Label>
            <Input
              value={settings.terms_version}
              onChange={(e) => set("terms_version", e.target.value)}
              placeholder="1.0"
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Payment Settings</>}
      </Button>

      {/* Payment Events Log */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Payment Events Log</h3>
          <Button variant="outline" size="sm" onClick={handleRefreshEvents} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <Card>
          <div className="rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No payment events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(e.created_at), "MMM d · h:mm a")}
                      </TableCell>
                      <TableCell><EventTypeBadge type={e.event_type} /></TableCell>
                      <TableCell className="text-sm font-medium">
                        {fmt(e.amount_cents, e.currency ?? "usd")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {e.customer_email ?? "—"}
                        {e.error_message && (
                          <p className="text-destructive text-xs truncate">{e.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.stripe_mode === "live" ? "default" : "secondary"} className="text-xs">
                          {e.stripe_mode}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
