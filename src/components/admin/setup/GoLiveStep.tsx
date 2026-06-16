import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Copy, PlayCircle, AlertTriangle } from "lucide-react";
import type { StepProps } from "./SetupWizard";

export function GoLiveStep({ rawSettings }: StepProps) {
  const { toast } = useToast();
  const [showTest, setShowTest] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "your-project";

  const zipEnabled = rawSettings.enable_zip_restrictions !== "false";
  const checks = [
    { label: "Business name set", ok: !!(rawSettings.business_name || rawSettings.company_name) },
    { label: "Stripe connected", ok: rawSettings.setup_step_stripe === "true" && !!rawSettings.stripe_publishable_key },
    { label: "Email connected", ok: rawSettings.setup_step_email === "true" },
    { label: "Service area configured", ok: !zipEnabled || rawSettings.setup_step_area === "true" },
  ];
  const allGreen = checks.every((c) => c.ok);

  const embedCode = `<script
  src="https://${projectRef}.supabase.co/storage/v1/object/public/widget/embed.js"
  data-supabase-url="${supabaseUrl}"
  data-supabase-key="${anonKey}"
></script>
<div id="booking-widget"></div>`;

  return (
    <div className="space-y-5">
      {/* Health checks */}
      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2 text-sm">
            {c.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </div>
        ))}
      </div>

      {allGreen
        ? <Alert><CheckCircle2 className="h-4 w-4 text-success" /><AlertDescription>All systems ready. Copy your embed code below and paste it on your site.</AlertDescription></Alert>
        : <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Complete the steps above before going live.</AlertDescription></Alert>}

      {/* Operator one-time secret */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs leading-relaxed">
          <strong>One-time operator step</strong> for automatic Stripe/email key storage:
          Supabase → Project Settings → Edge Functions → Secrets →
          add <code>SUPABASE_ACCESS_TOKEN</code> (from Supabase → Account → Access Tokens).
        </AlertDescription>
      </Alert>

      {/* Embed code */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-foreground">Embed Code</span>
          <Button variant="outline" size="sm" onClick={() => {
            navigator.clipboard.writeText(embedCode);
            toast({ title: "Embed code copied" });
          }}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
          </Button>
        </div>
        <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">{embedCode}</pre>
      </div>

      <Button variant="outline" onClick={() => setShowTest(true)}>
        <PlayCircle className="h-4 w-4 mr-2" /> Run Test Booking
      </Button>

      <Dialog open={showTest} onOpenChange={setShowTest}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">Test Booking</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use Stripe test card <code className="font-mono">4242 4242 4242 4242</code>, any future expiry, any CVC.
          </p>
          <iframe title="Test booking" src="/embed" className="w-full h-[600px] rounded-lg border border-border" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
