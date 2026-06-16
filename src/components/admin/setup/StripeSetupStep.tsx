import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { StepProps } from "./SetupWizard";

export function StripeSetupStep({ rawSettings, reload }: StepProps) {
  const { toast } = useToast();
  const [publishableKey, setPublishableKey] = useState(rawSettings.stripe_publishable_key || "");
  const [secretKey, setSecretKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<{ webhook_url: string; mode: string; warning?: string | null } | null>(null);

  const connected = rawSettings.setup_step_stripe === "true";
  const mode = secretKey.startsWith("sk_live") ? "live" : secretKey.startsWith("sk_test") ? "test" : null;

  const connect = async () => {
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke("setup-stripe", {
      body: { secret_key: secretKey.trim(), publishable_key: publishableKey.trim() },
    });
    setConnecting(false);
    if (error || data?.error) {
      toast({ variant: "destructive", title: "Stripe connection failed", description: data?.error ?? error?.message });
      return;
    }
    setResult(data);
    setSecretKey("");
    if (data.warning) {
      toast({ variant: "destructive", title: "Connected, but keys not stored", description: data.warning });
    } else {
      toast({ title: `Stripe connected (${data.mode} mode)` });
    }
    await reload();
  };

  return (
    <div className="space-y-4">
      {connected && !result && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription>
            Stripe is already connected{rawSettings.stripe_mode ? ` (${rawSettings.stripe_mode} mode)` : ""}
            {rawSettings.stripe_secret_key_hint ? ` · key ${rawSettings.stripe_secret_key_hint}` : ""}. Re-connect below to rotate keys or re-register the webhook.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Stripe Publishable Key</Label>
        <Input value={publishableKey} onChange={(e) => setPublishableKey(e.target.value)} placeholder="pk_live_… or pk_test_…" className="mt-1 font-mono text-sm" />
        <p className="text-xs text-muted-foreground mt-1">Stripe Dashboard → Developers → API Keys</p>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Stripe Secret Key</Label>
        <Input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="sk_live_… or sk_test_…" className="mt-1 font-mono text-sm" />
        <p className="text-xs text-muted-foreground mt-1">Stored encrypted in your project secrets — never in the database.</p>
      </div>

      {mode === "test" && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Test Mode — no real charges</Badge>}
      {mode === "live" && <Badge className="bg-success/10 text-success border-success/20">Live Mode — real payments</Badge>}

      <Button onClick={connect} disabled={connecting || !secretKey || !publishableKey}>
        {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
        Connect Stripe & Auto-Register Webhook
      </Button>

      {result && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1.5">
          <p className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> Stripe connected ({result.mode} mode)</p>
          <p className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> Webhook registered</p>
          <p className="font-mono text-xs text-muted-foreground break-all pl-6">{result.webhook_url}</p>
          {result.warning && (
            <p className="flex items-start gap-1.5 text-amber-600"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{result.warning}</p>
          )}
        </div>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Automatic key storage requires a one-time operator step: add <code>SUPABASE_ACCESS_TOKEN</code> (Supabase → Account → Access Tokens)
          to your project's Edge Function secrets. See the Go Live step for details.
        </AlertDescription>
      </Alert>
    </div>
  );
}
