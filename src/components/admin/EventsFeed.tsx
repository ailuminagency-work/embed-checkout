import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Circle } from "lucide-react";

interface BookingEvent {
  id: string;
  booking_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  source: string;
  created_at: string;
  bookings?: { reference: string | null; customer_email: string | null } | null;
}

type EventFilter = "all" | "confirmed" | "email" | "webhook" | "errors";

const FILTERS: { id: EventFilter; label: string }[] = [
  { id: "all",       label: "All events" },
  { id: "confirmed", label: "Confirmed" },
  { id: "email",     label: "Email" },
  { id: "webhook",   label: "Webhooks" },
  { id: "errors",    label: "Errors" },
];

function matchesFilter(e: BookingEvent, f: EventFilter): boolean {
  if (f === "all") return true;
  if (f === "confirmed") return e.event_type.startsWith("booking.confirmed") || e.event_type.startsWith("reconciliation");
  if (f === "email") return e.event_type.startsWith("email.");
  if (f === "webhook") return e.event_type.includes("webhook");
  if (f === "errors") return /failed|error|rejected|invalid|abandoned/.test(e.event_type);
  return true;
}

function eventColor(type: string): string {
  if (/failed|error|rejected|invalid/.test(type)) return "text-destructive fill-destructive";
  if (/abandoned|cancelled/.test(type)) return "text-amber-500 fill-amber-500";
  if (/confirmed|sent|auto_confirmed/.test(type)) return "text-emerald-500 fill-emerald-500";
  return "text-muted-foreground fill-muted-foreground";
}

function summarize(e: BookingEvent): string {
  const p = e.payload ?? {};
  const parts: string[] = [e.source];
  if (typeof p.amount_cents === "number") {
    parts.push(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p.amount_cents / 100));
  }
  if (typeof p.to === "string") parts.push(`to: ${p.to}`);
  else if (e.bookings?.customer_email) parts.push(e.bookings.customer_email);
  if (typeof p.status === "number") parts.push(`status: ${p.status}`);
  if (typeof p.error === "string" && p.error) parts.push(p.error.slice(0, 120));
  return parts.join(" · ");
}

export function EventsFeed() {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<EventFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("booking_events")
      .select("*, bookings(reference, customer_email)")
      .order("created_at", { ascending: false })
      .limit(50);
    setEvents((data ?? []) as unknown as BookingEvent[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel("booking_events_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_events" },
        () => fetchEvents(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents]);

  const visible = events.filter((e) => matchesFilter(e, filter));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Events</h2>
          <p className="text-sm text-muted-foreground">
            Live feed of every state change — confirmations, emails, webhooks, errors. Updates in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as EventFilter)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); fetchEvents(); }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        {visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {filter === "all"
              ? "No events yet. Events appear here as bookings are confirmed, emails are sent, and webhooks fire."
              : "No events match this filter."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((e) => {
              const isOpen = expanded === e.id;
              return (
                <div key={e.id}>
                  <button
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                  >
                    <Circle className={`h-2.5 w-2.5 mt-1.5 shrink-0 ${eventColor(e.event_type)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono">{e.event_type}</span>
                        {e.bookings?.reference && (
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {e.bookings.reference.slice(0, 18)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{summarize(e)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(parseISO(e.created_at), { addSuffix: true })}
                      </span>
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                  {isOpen && (
                    <pre className="mx-4 mb-3 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
