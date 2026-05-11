import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

interface ZipPricingRow {
  id: string;
  zip_code: string;
  minimum_price: number;
  active: boolean;
}

type RowEdits = Record<string, { zip_code?: string; minimum_price?: number }>;

export function ZipPricingManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ZipPricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ zip_code: "", minimum_price: 0 });
  const [edits, setEdits] = useState<RowEdits>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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
      setEdits({});
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRows = useMemo(
    () => rows.filter((row) => row.zip_code.includes(search.trim())),
    [rows, search],
  );

  // Merge committed row with any pending local edits for display
  const display = (row: ZipPricingRow) => ({ ...row, ...edits[row.id] });

  const markEdit = (id: string, patch: { zip_code?: string; minimum_price?: number }) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const isDirty = (id: string) => !!edits[id] && Object.keys(edits[id]).length > 0;

  const handleSaveRow = async (row: ZipPricingRow) => {
    const edit = edits[row.id];
    if (!edit) return;
    setSaving((s) => ({ ...s, [row.id]: true }));
    const { error } = await supabase
      .from("zip_pricing")
      .update({
        zip_code: edit.zip_code ?? row.zip_code,
        minimum_price: edit.minimum_price ?? row.minimum_price,
      })
      .eq("id", row.id);
    setSaving((s) => ({ ...s, [row.id]: false }));
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      setRows((prev) => prev.map((r) =>
        r.id === row.id ? { ...r, ...edit } : r,
      ));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      toast({ title: `ZIP ${edit.zip_code ?? row.zip_code} saved` });
    }
  };

  const handleToggleActive = async (row: ZipPricingRow) => {
    const { error } = await supabase
      .from("zip_pricing")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, active: !r.active } : r));
    }
  };

  const handleSoftDelete = async (id: string) => {
    const { error } = await supabase
      .from("zip_pricing")
      .update({ active: false })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Deactivate failed", description: error.message });
    } else {
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, active: false } : r));
      toast({ title: "ZIP code deactivated" });
    }
  };

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
    toast({ title: "ZIP code added" });
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
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const d = display(row);
              const dirty = isDirty(row.id);
              const isSaving = saving[row.id];
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    !row.active && "opacity-50",
                    dirty && "bg-amber-50 dark:bg-amber-950/20",
                  )}
                >
                  <TableCell>
                    <Input
                      value={d.zip_code}
                      onChange={(e) => markEdit(row.id, { zip_code: e.target.value })}
                      className="h-8 w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={d.minimum_price}
                      onChange={(e) => markEdit(row.id, { minimum_price: Number(e.target.value) })}
                      className="h-8 w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.active}
                      onCheckedChange={() => handleToggleActive(row)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!dirty || isSaving}
                        onClick={() => handleSaveRow(row)}
                        aria-label="Save changes"
                      >
                        {isSaving
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Save className={cn("h-4 w-4", dirty ? "text-amber-600" : "text-muted-foreground")} />
                        }
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Deactivate ZIP code">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate {row.zip_code}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This ZIP code will no longer be accepted at checkout. You can reactivate it anytime using the Active toggle.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleSoftDelete(row.id)}>
                              Deactivate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                  No ZIP codes configured yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {Object.keys(edits).length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You have unsaved changes — click the <Save className="inline h-3 w-3" /> icon on each row to save.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
