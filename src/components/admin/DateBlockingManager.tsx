import { useCallback, useEffect, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { CalendarOff, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockedDate {
  id: string;
  date: string; // "YYYY-MM-DD"
  reason: string | null;
  created_at: string;
}

type DialogMode = "block" | "unblock" | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseISODate(s: string): Date | null {
  try {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function niceDate(isoStr: string): string {
  const d = parseISODate(isoStr);
  return d ? format(d, "EEEE, MMMM d, yyyy") : isoStr;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="rounded-full bg-muted p-4">
        <CalendarOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">No dates blocked</p>
        <p className="text-sm text-muted-foreground mt-1">
          Click a date on the calendar or use the field below to block a date.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block Dialog
// ---------------------------------------------------------------------------

interface BlockDialogProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string, reason: string) => Promise<void>;
}

function BlockDialog({ date, open, onClose, onConfirm }: BlockDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset reason when dialog opens
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleConfirm = async () => {
    if (!date) return;
    setLoading(true);
    await onConfirm(date, reason);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Block Date</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {date && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{niceDate(date)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This date will be unavailable for booking.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="block-reason" className="text-sm">
              Reason{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="block-reason"
              placeholder="e.g. Holiday, team training, maintenance…"
              className="resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleConfirm();
              }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Block Date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Unblock Dialog
// ---------------------------------------------------------------------------

interface UnblockDialogProps {
  blockedDate: BlockedDate | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

function UnblockDialog({ blockedDate, open, onClose, onConfirm }: UnblockDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!blockedDate) return;
    setLoading(true);
    await onConfirm(blockedDate.id);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Unblock Date</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {blockedDate && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {niceDate(blockedDate.date)}
              </p>
              {blockedDate.reason && (
                <p className="text-xs text-muted-foreground">
                  Reason: {blockedDate.reason}
                </p>
              )}
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            This date will become available for booking again.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unblock Date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DateBlockingManager() {
  const { toast } = useToast();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [pendingBlockedDate, setPendingBlockedDate] = useState<BlockedDate | null>(null);
  const [manualDate, setManualDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  const fetchBlocked = useCallback(async () => {
    const { data, error } = await supabase
      .from("blocked_dates")
      .select("*")
      .order("date", { ascending: true });
    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to load blocked dates",
        description: error.message,
      });
    } else {
      setBlockedDates(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchBlocked();

    const channel = supabase
      .channel("blocked-dates-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocked_dates" },
        () => fetchBlocked()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBlocked]);

  // -------------------------------------------------------------------------
  // Calendar interaction
  // -------------------------------------------------------------------------

  const blockedDateSet = new Set(blockedDates.map((bd) => bd.date));

  const handleCalendarSelect = (day: Date | undefined) => {
    if (!day) return;
    const iso = toISODate(day);
    const existing = blockedDates.find((bd) => bd.date === iso);
    if (existing) {
      setPendingBlockedDate(existing);
      setDialogMode("unblock");
    } else {
      setPendingDate(iso);
      setDialogMode("block");
    }
  };

  // Build Date[] for the calendar modifiers
  const blockedDateObjects: Date[] = blockedDates
    .map((bd) => parseISODate(bd.date))
    .filter((d): d is Date => d !== null);

  // -------------------------------------------------------------------------
  // Block / Unblock actions
  // -------------------------------------------------------------------------

  const handleBlock = async (date: string, reason: string) => {
    const { error } = await supabase.from("blocked_dates").insert({
      date,
      reason: reason.trim() || null,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to block date",
        description: error.message,
      });
    } else {
      toast({ title: "Date blocked", description: niceDate(date) });
      setDialogMode(null);
      setPendingDate(null);
    }
  };

  const handleUnblock = async (id: string) => {
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to unblock date",
        description: error.message,
      });
    } else {
      toast({ title: "Date unblocked" });
      setDialogMode(null);
      setPendingBlockedDate(null);
    }
  };

  // -------------------------------------------------------------------------
  // Manual date input
  // -------------------------------------------------------------------------

  const handleManualBlock = () => {
    const trimmed = manualDate.trim();
    if (!trimmed) return;
    // Accept yyyy-MM-dd or MM/dd/yyyy
    let iso = trimmed;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [m, d, y] = trimmed.split("/");
      iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const parsed = parseISODate(iso);
    if (!parsed || !isValid(parsed)) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Please enter a date in YYYY-MM-DD format.",
      });
      return;
    }
    const isoStr = toISODate(parsed);
    const existing = blockedDates.find((bd) => bd.date === isoStr);
    if (existing) {
      setPendingBlockedDate(existing);
      setDialogMode("unblock");
    } else {
      setPendingDate(isoStr);
      setDialogMode("block");
    }
    setManualDate("");
    // Navigate calendar to that month
    setCalendarMonth(parsed);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Block dates to prevent customers from scheduling on those days. Blocked dates
          are highlighted in red on the calendar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
        {/* Calendar panel */}
        <div className="space-y-4">
          <Card className="w-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
                Calendar
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Click a date to block or unblock it.
              </p>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={handleCalendarSelect}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                modifiers={{ blocked: blockedDateObjects }}
                modifiersClassNames={{
                  blocked:
                    "!bg-destructive/15 !text-destructive font-semibold rounded-md hover:!bg-destructive/25 hover:!text-destructive",
                }}
                className="rounded-md"
              />
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-3.5 rounded-sm bg-destructive/20 border border-destructive/40" />
              <span>Blocked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-3.5 rounded-sm bg-accent" />
              <span>Today</span>
            </div>
          </div>

          {/* Manual date entry */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Block a Specific Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Enter date (YYYY-MM-DD)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="flex-1 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleManualBlock()}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleManualBlock}
                    disabled={!manualDate}
                    title="Block this date"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blocked dates list */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Blocked Dates</CardTitle>
              {blockedDates.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {blockedDates.length} date{blockedDates.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : blockedDates.length === 0 ? (
              <EmptyState />
            ) : (
              <ScrollArea className="max-h-[520px]">
                <div className="divide-y">
                  {blockedDates.map((bd) => {
                    const dateObj = parseISODate(bd.date);
                    const isPast = dateObj ? dateObj < new Date(new Date().setHours(0, 0, 0, 0)) : false;
                    return (
                      <div
                        key={bd.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">
                              {niceDate(bd.date)}
                            </p>
                            {isPast && (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground border-muted-foreground/30 py-0 h-5"
                              >
                                Past
                              </Badge>
                            )}
                          </div>
                          {bd.reason ? (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {bd.reason}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/50 mt-0.5 italic">
                              No reason given
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Unblock date"
                          onClick={() => {
                            setPendingBlockedDate(bd);
                            setDialogMode("unblock");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <BlockDialog
        date={pendingDate}
        open={dialogMode === "block"}
        onClose={() => {
          setDialogMode(null);
          setPendingDate(null);
        }}
        onConfirm={handleBlock}
      />

      <UnblockDialog
        blockedDate={pendingBlockedDate}
        open={dialogMode === "unblock"}
        onClose={() => {
          setDialogMode(null);
          setPendingBlockedDate(null);
        }}
        onConfirm={handleUnblock}
      />
    </div>
  );
}
