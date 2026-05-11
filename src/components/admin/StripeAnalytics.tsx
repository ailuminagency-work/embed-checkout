import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Loader2, RefreshCw, TrendingUp, ShoppingCart, DollarSign, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayRevenue { date: string; amountCents: number; }
interface TopCustomer { email: string; name: string; totalCents: number; count: number; }
interface AnalyticsData {
  connected: boolean;
  totalRevenueCents: number;
  chargeCount: number;
  aovCents: number;
  topCustomers: TopCustomer[];
  dailyRevenue: DayRevenue[];
  periodDays: number;
}

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function StripeAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: result, error: err } = await supabase.functions.invoke("stripe-analytics");
    if (err || result?.error) {
      setError(err?.message ?? result?.error ?? "Failed to load analytics");
    } else {
      setData(result as AnalyticsData);
      setLastFetched(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (data?.dailyRevenue ?? []).map((d) => ({
    date: format(parseISO(d.date), "MMM d"),
    revenue: +(d.amountCents / 100).toFixed(2),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Stripe Analytics</h2>
          {data && (
            <span className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              data.connected
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            )}>
              {data.connected
                ? <><Wifi className="h-3 w-3" />Connected</>
                : <><WifiOff className="h-3 w-3" />Not connected</>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Updated {format(lastFetched, "h:mm:ss a")}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!data && loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && !data.connected && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">Stripe is not connected</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Deploy the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">stripe-analytics</code> Edge Function and set the{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code> secret in Supabase.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.connected && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={DollarSign}
              label="Total Revenue"
              value={fmt(data.totalRevenueCents)}
              sub={`Last ${data.periodDays} days`}
            />
            <StatCard
              icon={ShoppingCart}
              label="Charges"
              value={data.chargeCount.toString()}
              sub={`Last ${data.periodDays} days`}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Order Value"
              value={data.aovCents > 0 ? fmt(data.aovCents) : "—"}
              sub="Per successful charge"
            />
            <StatCard
              icon={Wifi}
              label="Connection"
              value="Live"
              sub="Stripe API"
              valueClass="text-green-600 dark:text-green-400"
            />
          </div>

          {/* Daily revenue chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Daily Revenue — Last {data.periodDays} days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    interval={6}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `$${v}`}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top 5 Customers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No charges in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-center">Orders</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topCustomers.map((c) => (
                      <TableRow key={c.email}>
                        <TableCell>
                          <div className="font-medium text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{c.count}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{fmt(c.totalCents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}

function StatCard({ icon: Icon, label, value, sub, valueClass }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className={cn("text-2xl font-bold text-foreground", valueClass)}>{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}
