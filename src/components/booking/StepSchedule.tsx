import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { TimeWindow } from "@/types/booking";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function StepSchedule() {
  const { state, setSelectedDate, setSelectedTimeWindow } = useBooking();
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    supabase.from("blocked_dates").select("date").then(({ data }) => {
      if (data) setBlockedDates(data.map(r => new Date(r.date + 'T00:00:00')));
    });

    supabase
      .from("time_windows")
      .select("id, label, sort_order")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setTimeWindows(data.map(r => ({ id: r.id, label: r.label })));
      });
  }, []);

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
        <div className="flex flex-col items-center gap-2">
          <Calendar
            mode="single"
            selected={state.selectedDate ?? undefined}
            onSelect={(date) => setSelectedDate(date ?? null)}
            disabled={(date) => {
              if (date < today) return true;
              return blockedDates.some(b =>
                b.getFullYear() === date.getFullYear() &&
                b.getMonth() === date.getMonth() &&
                b.getDate() === date.getDate()
              );
            }}
            className="rounded-xl border border-border bg-card p-3 pointer-events-auto"
          />
          {blockedDates.length > 0 && (
            <p className="text-xs text-muted-foreground">Some dates unavailable</p>
          )}
        </div>

        {/* Time windows */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Time Window</span>
          </div>
          <div className="space-y-2">
            {timeWindows.map((tw) => (
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
