import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface WebhookSettings {
  id: string;
  active_mode: string;
  test_url: string;
  live_url: string;
  twin_url: string;
}

interface WebhookLog {
  id: string;
  webhook_url: string;
  mode: string;
  label: string;
  status_code: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export function WebhooksManager() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WebhookSettings | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [testUrl, setTestUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [twinUrl, setTwinUrl] = useState("");
  const [activeMode, setActiveMode] = useState<"test" | "live">("test");

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("webhook_settings")
      .select("*")
      .limit(1)
      .single();
    if (error) {
      toast({ variant: "destructive", title: "Error loading settings", description: error.message });
      return;
    }
    setSettings(data);
    setTestUrl(data.test_url);
    setLiveUrl(data.live_url);
    setTwinUrl(data.twin_url);
    setActiveMode(data.active_mode as "test" | "live");
  }, [toast]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("webhook_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs(data ?? []);
  }, []);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchLogs()]).then(() => setLoading(false));
  }, [fetchSettings, fetchLogs]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("webhook_settings")
      .update({
        active_mode: activeMode,
        test_url: testUrl.trim(),
        live_url: liveUrl.trim(),
        twin_url: twinUrl.trim(),
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Webhook settings saved" });
      fetchSettings();
    }
  };

  const handleTestWebhook = async () => {
    const url = activeMode === "test" ? testUrl : liveUrl;
    if (!url.trim()) {
      toast({ variant: "destructive", title: "No URL", description: `No ${activeMode} webhook URL configured.` });
      return;
    }

    setTesting(true);
    const samplePayload = {
      _test: true,
      serviceType: "junk-removal",
      items: [{ id: "test-item", name: "Test Item", price: 50, quantity: 1, lineTotal: 50 }],
      subtotal: 50,
      total: 50,
      amountCharged: 50,
      schedule: { date: new Date().toISOString(), timeWindow: "8am – 12pm" },
      customer: { name: "Test Customer", phone: "555-0100", email: "test@example.com", address: "123 Test St", zip: "00000" },
      webhookMode: activeMode,
      timestamp: new Date().toISOString(),
    };

    let statusCode: number | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(samplePayload),
      });
      statusCode = res.status;
      success = res.ok;
      if (!res.ok) errorMessage = `HTTP ${res.status} ${res.statusText}`;
    } catch (e: any) {
      errorMessage = e?.message || "Network error";
    }

    // Log the result
    await supabase.from("webhook_logs").insert({
      webhook_url: url.trim(),
      mode: activeMode,
      label: "Test",
      status_code: statusCode,
      success,
      error_message: errorMessage,
    });

    setTesting(false);
    fetchLogs();

    if (success) {
      toast({ title: "Test webhook sent", description: `Status: ${statusCode}` });
    } else {
      toast({ variant: "destructive", title: "Test webhook failed", description: errorMessage || "Unknown error" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeUrl = activeMode === "test" ? testUrl : liveUrl;

  return (
    <div className="space-y-6">
      {/* Mode & URLs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Configuration</CardTitle>
          <CardDescription>Configure your Make.com webhook URLs and active mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="space-y-2">
            <Label>Active Mode</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeMode === "test" ? "default" : "outline"}
                onClick={() => setActiveMode("test")}
              >
                Test
              </Button>
              <Button
                size="sm"
                variant={activeMode === "live" ? "default" : "outline"}
                onClick={() => setActiveMode("live")}
              >
                Live
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Currently sending to: <span className="font-medium">{activeMode}</span> URL
            </p>
          </div>

          <div className="space-y-1">
            <Label>Test Webhook URL</Label>
            <Input
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://hook.us1.make.com/..."
              className={activeMode === "test" ? "border-primary" : ""}
            />
          </div>

          <div className="space-y-1">
            <Label>Live Webhook URL</Label>
            <Input
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="https://hook.us1.make.com/..."
              className={activeMode === "live" ? "border-primary" : ""}
            />
          </div>

          <div className="space-y-1">
            <Label>Twin Agent URL (optional)</Label>
            <Input
              value={twinUrl}
              onChange={(e) => setTwinUrl(e.target.value)}
              placeholder="https://build.twin.so/..."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Webhook</CardTitle>
          <CardDescription>
            Send a sample payload to the active ({activeMode}) URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
              {activeUrl || "No URL configured"}
            </code>
            <Button
              size="sm"
              onClick={handleTestWebhook}
              disabled={testing || !activeUrl}
            >
              {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Webhook Logs</CardTitle>
          <CardDescription>Last 20 webhook deliveries.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No webhook logs yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 text-sm border border-border rounded-md px-3 py-2"
                >
                  {log.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <Badge variant={log.mode === "live" ? "default" : "secondary"} className="text-xs shrink-0">
                    {log.mode}
                  </Badge>
                  <span className="text-muted-foreground shrink-0">{log.label}</span>
                  <span className="font-mono text-xs truncate flex-1">{log.webhook_url}</span>
                  {log.status_code && (
                    <span className="text-xs text-muted-foreground shrink-0">{log.status_code}</span>
                  )}
                  {log.error_message && (
                    <span className="text-xs text-destructive truncate max-w-[200px] shrink-0" title={log.error_message}>
                      {log.error_message}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(log.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
