import { useState } from "react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { BrandSetupStep } from "./BrandSetupStep";
import { StripeSetupStep } from "./StripeSetupStep";
import { EmailSetupStep } from "./EmailSetupStep";
import { ServiceAreaStep } from "./ServiceAreaStep";
import { GoLiveStep } from "./GoLiveStep";

export interface StepProps {
  rawSettings: Record<string, string>;
  reload: () => Promise<void> | void;
}

const STEPS = [
  { id: "brand",  title: "Brand",        flag: "setup_step_brand",  Component: BrandSetupStep },
  { id: "stripe", title: "Stripe",       flag: "setup_step_stripe", Component: StripeSetupStep },
  { id: "email",  title: "Email",        flag: "setup_step_email",  Component: EmailSetupStep },
  { id: "area",   title: "Service Area", flag: "setup_step_area",   Component: ServiceAreaStep },
  { id: "golive", title: "Go Live",      flag: null,                Component: GoLiveStep },
] as const;

export function SetupWizard() {
  const { rawSettings, loading, reload } = useAppConfig();
  const [open, setOpen] = useState<string>("brand");

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const isDone = (flag: string | null) =>
    flag ? rawSettings[flag] === "true" : STEPS.every((s) => !s.flag || rawSettings[s.flag] === "true");

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Setup</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Go from zero to live in a few minutes. Each step saves and tests before it's marked complete.
        </p>
      </div>

      {STEPS.map((step, i) => {
        const done = isDone(step.flag);
        const expanded = open === step.id;
        const { Component } = step;
        return (
          <Card key={step.id} className="overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/40 transition-colors"
              onClick={() => setOpen(expanded ? "" : step.id)}
            >
              {done
                ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
              <div className="flex-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Step {i + 1}</span>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
              </div>
              {done && <Badge className="bg-success/10 text-success border-success/20">Done</Badge>}
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {expanded && (
              <div className={cn("border-t border-border px-4 py-5")}>
                <Component rawSettings={rawSettings} reload={reload} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
