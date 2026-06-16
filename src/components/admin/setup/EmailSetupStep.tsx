import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Save, CheckCircle2 } from "lucide-react";
import type { StepProps } from "./SetupWizard";

export function EmailSetupStep({ rawSettings, reload }: StepProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState(rawSettings.email_provider || "gmail");
  const [emailUser, setEmailUser] = useState(rawSettings.email_user_hint || "");
  const [emailPassword, setEmailPassword] = useState("");
  const [fromName, setFromName] = useState(rawSettings.email_from_name || rawSettings.business_name || rawSettings.company_name || "");
  const [adminEmail, setAdminEmail] = useState(rawSettings.admin_notification_email || "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const connected = rawSettings.setup_step_email === "true";

  const call = async (test_only: boolean) => {
    const { data, error } = await supabase.functions.invoke("setup-email", {
      body: { provider, email_user: emailUser.trim(), email_password: emailPassword, from_name: fromName.trim(), admin_email: adminEmail.trim(), test_only },
    });
    if (error || data?.error) {
      toast({ variant: "destructive", title: "Email setup failed", description: data?.error ?? error?.message });
      return false;
    }
    if (data?.warning) toast({ variant: "destructive", title: "Saved, but keys not stored", description: data.warning });
    return true;
  };

  const sendTest = async () => {
    setTesting(true);
    const ok = await call(true);
    setTesting(false);
    if (ok) toast({ title: "Test email sent", description: `Check the inbox for ${adminEmail || emailUser}.` });
  };

  const save = async () => {
    setSaving(true);
    const ok = await call(false);
    setSaving(false);
    if (ok) { toast({ title: "Email connected" }); await reload(); }
  };

  return (
    <div className="space-y-5">
      {connected && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription>Email is connected via {rawSettings.email_provider || "SMTP"} ({rawSettings.email_user_hint}).</AlertDescription>
        </Alert>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Email Provider</Label>
        <RadioGroup value={provider} onValueChange={setProvider} className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="gmail" /> Gmail
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="outlook" /> Outlook / Microsoft 365
          </label>
        </RadioGroup>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
        {provider === "gmail" ? (
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Go to <strong>myaccount.google.com</strong> → Security</li>
            <li>Enable <strong>2-Step Verification</strong> (required)</li>
            <li>Open <strong>App Passwords</strong> → App: Mail, Device: Other → "Booking Widget"</li>
            <li>Copy the 16-character password and paste it below</li>
          </ol>
        ) : (
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Go to <strong>account.microsoft.com/security</strong></li>
            <li>Advanced Security → <strong>App Passwords</strong></li>
            <li>Create a new app password for "Booking Widget"</li>
            <li>Copy and paste it below</li>
          </ol>
        )}
      </div>

      <div className="grid gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Email Address</Label>
          <Input value={emailUser} onChange={(e) => setEmailUser(e.target.value)} placeholder="you@gmail.com" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">App Password</Label>
          <Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="16-character app password (not your login password)" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">From Name</Label>
          <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="CleanSlate Hauling" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Admin Notification Email</Label>
          <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="owner@example.com" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Where new-booking alerts are sent.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={sendTest} disabled={testing || !emailUser || !emailPassword}>
          {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send Test Email
        </Button>
        <Button onClick={save} disabled={saving || !emailUser || !emailPassword}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save & Connect
        </Button>
      </div>
    </div>
  );
}
