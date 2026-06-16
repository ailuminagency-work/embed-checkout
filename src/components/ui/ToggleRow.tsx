import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface ToggleRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  disabled?: boolean;
}

// Reusable labelled toggle used across the Setup wizard. Uses theme tokens
// (border/primary/muted-foreground) so it inherits the client's brand color.
export function ToggleRow({ label, description, enabled, onToggle, disabled }: ToggleRowProps) {
  return (
    <div className={cn(
      "flex items-start justify-between gap-4 rounded-lg border border-border p-4",
      disabled && "opacity-60",
    )}>
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        checked={enabled}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
