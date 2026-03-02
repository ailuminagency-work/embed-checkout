import { useBooking } from "@/context/BookingContext";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEP_LABELS = ["Service", "Items", "Schedule", "Details", "Payment"];

export function StepIndicator() {
  const { state, setStep } = useBooking();

  return (
    <div className="shrink-0 px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {STEP_LABELS.map((label, i) => {
          const isCompleted = i < state.step;
          const isCurrent = i === state.step;

          return (
            <div key={label} className="flex items-center gap-0 flex-1 last:flex-none">
              <button
                onClick={() => isCompleted && setStep(i)}
                disabled={!isCompleted}
                className={cn(
                  "flex items-center gap-1.5 transition-colors",
                  isCompleted && "cursor-pointer",
                  !isCompleted && !isCurrent && "opacity-40",
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors shrink-0",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:inline",
                    isCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-2",
                    i < state.step ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
