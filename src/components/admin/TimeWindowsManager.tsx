import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeWindowRow {
  id: string;
  label: string;
  sort_order: number;
  active: boolean;
}

export function TimeWindowsManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<TimeWindowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("time_windows")
      .select("id, label, sort_order, active")
      .order("sort_order", { ascending: true });
    if (error) {
      toast({ variant: "destructive", title: "Unable to load time windows", description: error.message });
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      toast({ variant: "destructive", title: "Label required" });
      return;
    }
    const maxSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
    const { error } = await supabase.from("time_windows").insert({
      label: newLabel.trim(),
      sort_order: maxSort,
    });
    if (error) {
      toast({ variant: "destructive", title: "Add failed", description: error.message });
      return;
    }
    setDialogOpen(false);
    setNewLabel("");
    fetchData();
    toast({ title: "Time window added" });
  };

  const handleToggleActive = async (row: TimeWindowRow) => {
    const { error } = await supabase
      .from("time_windows")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } else {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, active: !r.active } : r));
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("time_windows").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    } else {
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Time window removed" });
    }
  };

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= rows.length) return;
    const a = rows[index]; const b = rows[swapIndex];
    const [r1, r2] = await Promise.all([
      supabase.from("time_windows").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("time_windows").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      toast({ variant: "destructive", title: "Reorder failed", description: (r1.error ?? r2.error)!.message });
      return;
    }
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
        <CardTitle className="text-base">Time Windows</CardTitle>
        <CardDescription>Define the pickup time slots customers can choose from.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Window</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Time Window</DialogTitle></DialogHeader>
              <div className="space-y-1">
                <Label>Label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. 8:00 AM – 12:00 PM"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <DialogFooter><Button onClick={handleAdd}>Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Order</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="w-20 text-center">Active</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.id} className={cn(!row.active && "opacity-50")}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => handleReorder(idx, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleReorder(idx, "down")} disabled={idx === rows.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={row.active} onCheckedChange={() => handleToggleActive(row)} />
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Delete time window">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove "{row.label}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This time window will no longer appear at checkout. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(row.id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                  No time windows configured yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
