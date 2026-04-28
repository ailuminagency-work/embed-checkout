import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface ZipPricingRow {
  id: string;
  zip_code: string;
  minimum_price: number;
  active: boolean;
}

export function ZipPricingManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ZipPricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ zip_code: "", minimum_price: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("zip_pricing")
      .select("id, zip_code, minimum_price, active")
      .order("zip_code");

    if (error) {
      toast({ variant: "destructive", title: "Unable to load ZIP pricing", description: error.message });
    } else {
      setRows((data ?? []).map((row) => ({ ...row, minimum_price: Number(row.minimum_price) })));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(
    () => rows.filter((row) => row.zip_code.includes(search.trim())),
    [rows, search],
  );

  const saveRow = async () => {
    if (!form.zip_code.trim()) {
      toast({ variant: "destructive", title: "ZIP code required" });
      return;
    }
    const { error } = await supabase.from("zip_pricing").insert({
      zip_code: form.zip_code.trim(),
      minimum_price: form.minimum_price,
    });
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
      return;
    }
    setDialogOpen(false);
    setForm({ zip_code: "", minimum_price: 0 });
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ZIP Pricing</CardTitle>
        <CardDescription>Set the minimum service charge per ZIP code. Required for checkout.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Input
            placeholder="Search ZIP codes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add ZIP</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New ZIP Pricing</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>ZIP code</Label>
                  <Input
                    value={form.zip_code}
                    onChange={(e) => setForm((s) => ({ ...s, zip_code: e.target.value }))}
                    placeholder="90210"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Minimum price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.minimum_price}
                    onChange={(e) => setForm((s) => ({ ...s, minimum_price: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <DialogFooter><Button onClick={saveRow}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ZIP</TableHead>
              <TableHead>Minimum Price</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Input
                    value={row.zip_code}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setRows((items) => items.map((r) => r.id === row.id ? { ...r, zip_code: value } : r));
                      await supabase.from("zip_pricing").update({ zip_code: value }).eq("id", row.id);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    value={row.minimum_price}
                    onChange={async (e) => {
                      const value = Number(e.target.value);
                      setRows((items) => items.map((r) => r.id === row.id ? { ...r, minimum_price: value } : r));
                      await supabase.from("zip_pricing").update({ minimum_price: value }).eq("id", row.id);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={row.active}
                    onCheckedChange={async (checked) => {
                      setRows((items) => items.map((r) => r.id === row.id ? { ...r, active: checked } : r));
                      await supabase.from("zip_pricing").update({ active: checked }).eq("id", row.id);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    await supabase.from("zip_pricing").delete().eq("id", row.id);
                    fetchData();
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                  No ZIP codes configured yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}