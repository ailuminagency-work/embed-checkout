import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";

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

interface QueueEntry {
  id: string;
  booking_id: string;
  event_type: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
}

export function WebhooksManager() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WebhookSettings | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

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

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from("webhook_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setQueue(data ?? []);
  }, []);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchLogs(), fetchQueue()]).then(() => setLoading(false));
  }, [fetchSettings, fetchLogs, fetchQueue]);

  const handleRetry = async (entry: QueueEntry) => {
    setRetrying(entry.id);
    try {
      const { error } = await supabase.functions.invoke("deliver-webhook", {
        body: { booking_id: entry.booking_id },
      });
      if (error) throw error;
      toast({ title: "Webhook retried", description: "Check the queue for updated status." });
      await Promise.all([fetchLogs(), fetchQueue()]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Retry failed", description: msg });
    }
    setRetrying(null);
  };

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

      {/* Delivery Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Delivery Queue</CardTitle>
              <CardDescription>Server-side webhook deliveries. Triggered automatically on every booking event.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchQueue()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No deliveries recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {queue.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 text-sm border border-border rounded-md px-3 py-2.5"
                >
                  {entry.status === "delivered" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : entry.status === "failed" ? (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}

                  <Badge
                    variant={entry.status === "delivered" ? "secondary" : entry.status === "failed" ? "destructive" : "outline"}
                    className="text-xs shrink-0"
                  >
                    {entry.status}
                  </Badge>

                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {entry.event_type}
                  </span>

                  <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                    {entry.booking_id.slice(0, 8)}…
                  </span>

                  {entry.last_error && (
                    <span
                      className="text-xs text-destructive truncate max-w-[160px] shrink-0"
                      title={entry.last_error}
                    >
                      {entry.last_error}
                    </span>
                  )}

                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(parseISO(entry.created_at), { addSuffix: true })}
                  </span>

                  {entry.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs shrink-0"
                      disabled={retrying === entry.id}
                      onClick={() => handleRetry(entry)}
                    >
                      {retrying === entry.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
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
