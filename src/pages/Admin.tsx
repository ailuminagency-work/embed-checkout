import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, LogOut, Loader2 } from "lucide-react";

interface CatalogRow {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string | null;
  sort_order: number;
  active: boolean;
}

const empty: Omit<CatalogRow, "sort_order" | "active"> = {
  id: "",
  name: "",
  category: "",
  price: 0,
  image_url: null,
};

export default function Admin() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/login");
  }, [authLoading, user, isAdmin, navigate]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (isAdmin) fetchItems();
  }, [isAdmin, fetchItems]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setDialogOpen(true);
  };

  const openEdit = (item: CatalogRow) => {
    setEditing(item);
    setForm({ id: item.id, name: item.name, category: item.category, price: item.price, image_url: item.image_url });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.id || !form.name || !form.category) {
      toast({ variant: "destructive", title: "Missing fields", description: "ID, name and category are required." });
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("catalog_items")
        .update({ name: form.name, category: form.category, price: form.price, image_url: form.image_url })
        .eq("id", editing.id);
      if (error) {
        toast({ variant: "destructive", title: "Update failed", description: error.message });
        return;
      }
    } else {
      const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from("catalog_items")
        .insert({ id: form.id, name: form.name, category: form.category, price: form.price, image_url: form.image_url, sort_order: maxSort });
      if (error) {
        toast({ variant: "destructive", title: "Insert failed", description: error.message });
        return;
      }
    }

    setDialogOpen(false);
    fetchItems();
    toast({ title: editing ? "Item updated" : "Item added" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    } else {
      fetchItems();
      toast({ title: "Item deleted" });
    }
  };

  const handleToggleActive = async (item: CatalogRow) => {
    await supabase.from("catalog_items").update({ active: !item.active }).eq("id", item.id);
    fetchItems();
  };

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;

    const a = items[index];
    const b = items[swapIndex];

    await Promise.all([
      supabase.from("catalog_items").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("catalog_items").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    fetchItems();
  };

  if (authLoading || (!isAdmin && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-auto">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-foreground">Catalog Manager</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            View Site
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate("/login"))}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{items.length} items</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Item" : "New Item"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>ID (slug)</Label>
                  <Input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} disabled={!!editing} placeholder="e.g. couch" />
                </div>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Couch / Sofa" />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Furniture" />
                </div>
                <div className="space-y-1">
                  <Label>Price ($)</Label>
                  <Input type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Image URL (optional)</Label>
                  <Input value={form.image_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value || null }))} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave}>{editing ? "Save" : "Add"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="w-16 text-center">Active</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id} className={!item.active ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => handleReorder(idx, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleReorder(idx, "down")} disabled={idx === items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">${item.price}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={item.active} onCheckedChange={() => handleToggleActive(item)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No items yet. Click "Add Item" to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
