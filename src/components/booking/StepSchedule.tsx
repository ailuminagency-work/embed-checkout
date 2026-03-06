import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { TimeWindow } from "@/types/booking";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Clock } from "lucide-react";

const TIME_WINDOWS: TimeWindow[] = [
  { id: "early-morning", label: "8:00 AM – 12:00 AM" },
  { id: "morning", label: "12:00 AM – 4:00 PM" },
  { id: "afternoon", label: "4:00 PM – 8:00 PM" },
  
];

export function StepSchedule() {
  const { state, setSelectedDate, setSelectedTimeWindow } = useBooking();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">Pick a date & time</h2>
      <p className="text-sm text-muted-foreground mb-6">Choose when works best for you.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={state.selectedDate ?? undefined}
            onSelect={(date) => setSelectedDate(date ?? null)}
            disabled={(date) => date < today}
            className="rounded-xl border border-border bg-card p-3 pointer-events-auto"
          />
        </div>

        {/* Time windows */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Time Window</span>
          </div>
          <div className="space-y-2">
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.id}
                onClick={() => setSelectedTimeWindow(tw)}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all",
                  state.selectedTimeWindow?.id === tw.id
                    ? "border-primary bg-primary/5 text-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
