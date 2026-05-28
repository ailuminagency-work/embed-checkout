import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isThisMonth, parseISO } from "date-fns";
import {
  CalendarDays,
  DollarSign,
  Download,
  Loader2,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Json } from "@/integrations/supabase/types";

interface BookingItem {
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

interface CustomItem {
  description: string;
}

interface Booking {
  id: string;
  reference: string;
  service_type: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_address2: string | null;
  customer_zip: string | null;
  customer_property_type: string | null;
  customer_gate_code: string | null;
  schedule_date: string | null;
  schedule_time_window: string | null;
  items: Json;
  custom_items: Json;
  item_total: number;
  photo_promo_discount: number;
  adjusted_item_total: number;
  minimum_price: number | null;
  final_total: number;
  amount_charged: number;
  deposit_mode: boolean;
  payment_id: string | null;
  notes: string | null;
  created_at: string;
}

type FilterType = "all" | "junk_removal" | "donation_pickup";

function parseItems(raw: Json): BookingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as BookingItem[];
}

function parseCustomItems(raw: Json): CustomItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as CustomItem[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
        Confirmed
      </Badge>
    );
  }
  if (status === "cancelled") {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function BookingDetailSheet({
  booking,
  open,
  onClose,
  onCancelled,
}: {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onCancelled: (id: string) => void;
}) {
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState(false);

  if (!booking) return null;

  const items = parseItems(booking.items);
  const customItems = parseCustomItems(booking.custom_items);

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    setCancelling(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to cancel",
        description: error.message,
      });
    } else {
      toast({ title: "Booking cancelled" });
      onCancelled(booking.id);
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg">
                Booking #{booking.reference}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {booking.created_at
                  ? format(parseISO(booking.created_at), "MMM d, yyyy · h:mm a")
                  : "—"}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Service & Schedule */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Service
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">
                    {booking.service_type.replace("_", " ")}
                  </span>
                </div>
                {booking.schedule_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {format(parseISO(booking.schedule_date), "EEEE, MMM d, yyyy")}
                    </span>
                  </div>
                )}
                {booking.schedule_time_window && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time window</span>
                    <span className="font-medium">
                      {booking.schedule_time_window}
                    </span>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* Customer */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Customer
              </h3>
              <div className="space-y-2 text-sm">
                {booking.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{booking.customer_name}</span>
                  </div>
                )}
                {booking.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{booking.customer_phone}</span>
                  </div>
                )}
                {booking.customer_email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium break-all">
                      {booking.customer_email}
                    </span>
                  </div>
                )}
                {booking.customer_address && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Address</span>
                    <span className="font-medium text-right">
                      {booking.customer_address}
                      {booking.customer_address2 && (
                        <>, {booking.customer_address2}</>
                      )}
                    </span>
                  </div>
                )}
                {booking.customer_zip && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ZIP</span>
                    <span className="font-medium">{booking.customer_zip}</span>
                  </div>
                )}
                {booking.customer_property_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property type</span>
                    <span className="font-medium capitalize">
                      {booking.customer_property_type}
                    </span>
                  </div>
                )}
                {booking.customer_gate_code && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gate code</span>
                    <span className="font-medium font-mono">
                      {booking.customer_gate_code}
                    </span>
                  </div>
                )}
                {booking.notes && (
                  <div className="pt-1">
                    <span className="text-muted-foreground block mb-1">Notes</span>
                    <p className="text-sm bg-muted rounded-md p-3 leading-relaxed">
                      {booking.notes}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {(items.length > 0 || customItems.length > 0) && (
              <>
                <Separator />
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Items
                  </h3>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {item.name}
                          {item.quantity > 1 && (
                            <span className="ml-1 text-xs">×{item.quantity}</span>
                          )}
                        </span>
                        <span className="font-medium">{fmt(item.lineTotal)}</span>
                      </div>
                    ))}
                    {customItems.map((item, i) => (
                      <div key={`c${i}`} className="flex justify-between text-sm">
                        <span className="text-muted-foreground italic">
                          {item.description}
                        </span>
                        <span className="text-xs text-muted-foreground">custom</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            <Separator />

            {/* Pricing */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Pricing
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item total</span>
                  <span>{fmt(booking.item_total)}</span>
                </div>
                {booking.photo_promo_discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Photo promo discount</span>
                    <span>−{fmt(booking.photo_promo_discount)}</span>
                  </div>
                )}
                {booking.minimum_price != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Minimum price</span>
                    <span>{fmt(booking.minimum_price)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Final total</span>
                  <span>{fmt(booking.final_total)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>
                    {booking.deposit_mode ? "Deposit charged" : "Amount charged"}
                  </span>
                  <span className="text-primary">{fmt(booking.amount_charged)}</span>
                </div>
                {booking.payment_id && (
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Payment ID</span>
                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                      {booking.payment_id}
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>

        {booking.status !== "cancelled" && (
          <div className="px-6 py-4 border-t">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Cancelled
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function BookingsManager() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to load bookings",
        description: error.message,
      });
    } else {
      setBookings(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchBookings();

    const channel = supabase
      .channel("bookings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => fetchBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        b.customer_name?.toLowerCase().includes(q) ||
        b.customer_email?.toLowerCase().includes(q) ||
        b.reference?.toLowerCase().includes(q) ||
        b.customer_zip?.toLowerCase().includes(q);

      const matchesFilter =
        filter === "all" ||
        (filter === "junk_removal" && b.service_type === "junk_removal") ||
        (filter === "donation_pickup" && b.service_type === "donation_pickup");

      return matchesSearch && matchesFilter;
    });
  }, [bookings, search, filter]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const revenue = bookings.reduce((sum, b) => sum + (b.amount_charged ?? 0), 0);
    const thisMonth = bookings.filter(
      (b) => b.created_at && isThisMonth(parseISO(b.created_at))
    ).length;
    return { total, revenue, thisMonth };
  }, [bookings]);

  const openDetail = (b: Booking) => {
    setSelected(b);
    setSheetOpen(true);
  };

  const handleCancelled = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b))
    );
  };

  const exportCSV = () => {
    const headers = [
      "Reference",
      "Service",
      "Status",
      "Date",
      "Customer Name",
      "Email",
      "Phone",
      "Address",
      "ZIP",
      "Items",
      "Amount Charged",
      "Created At",
    ];
    const rows = bookings.map((b) => [
      b.reference,
      b.service_type,
      b.status,
      b.schedule_date ?? "",
      b.customer_name ?? "",
      b.customer_email ?? "",
      b.customer_phone ?? "",
      [b.customer_address, b.customer_address2].filter(Boolean).join(", "),
      b.customer_zip ?? "",
      parseItems(b.items).length + parseCustomItems(b.custom_items).length,
      b.amount_charged,
      b.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Bookings"
              value={String(stats.total)}
              icon={CalendarDays}
            />
            <StatCard
              title="Total Revenue"
              value={fmt(stats.revenue)}
              icon={DollarSign}
              sub="Sum of amount charged"
            />
            <StatCard
              title="This Month"
              value={String(stats.thisMonth)}
              icon={TrendingUp}
              sub={format(new Date(), "MMMM yyyy")}
            />
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["all", "junk_removal", "donation_pickup"] as FilterType[]).map(
            (f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === "all"
                  ? "All"
                  : f === "junk_removal"
                  ? "Junk Removal"
                  : "Donation Pickup"}
              </Button>
            )
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, ref, ZIP…"
              className="pl-9 pr-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={exportCSV} title="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    {search || filter !== "all"
                      ? "No bookings match your filters."
                      : "No bookings yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => {
                  const itemCount = parseItems(b.items).length;
                  const customCount = parseCustomItems(b.custom_items).length;
                  return (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(b)}
                    >
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {b.schedule_date
                          ? format(parseISO(b.schedule_date), "MMM d, yyyy")
                          : b.created_at
                          ? format(parseISO(b.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {b.customer_name ?? "—"}
                        </div>
                        {b.customer_email && (
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {b.customer_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm capitalize whitespace-nowrap">
                        {b.service_type.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {itemCount > 0 && `${itemCount} item${itemCount !== 1 ? "s" : ""}`}
                        {itemCount > 0 && customCount > 0 && " + "}
                        {customCount > 0 && `${customCount} custom`}
                        {itemCount === 0 && customCount === 0 && "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {fmt(b.amount_charged)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(b);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <BookingDetailSheet
        booking={selected}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCancelled={handleCancelled}
      />
    </div>
  );
}
