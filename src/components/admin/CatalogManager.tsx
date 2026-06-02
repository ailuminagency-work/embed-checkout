import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  GripVertical,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface CatalogRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  image_url: string | null;
  sort_order: number;
  active: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Inline price cell ──────────────────────────────────────────────────────────
function PriceCell({ item, onSaved }: { item: CatalogRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.price));
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) {
      setValue(String(item.price));
      setEditing(false);
      return;
    }
    if (parsed === item.price) {
      setEditing(false);
      return;
    }
    const { error } = await supabase
      .from("catalog_items")
      .update({ price: parsed })
      .eq("id", item.id);
    if (error) {
      toast({ variant: "destructive", title: "Price update failed", description: error.message });
      setValue(String(item.price));
    } else {
      onSaved();
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setValue(String(item.price)); setEditing(false); }
        }}
        className="h-7 w-24 text-right text-sm"
        autoFocus
      />
    );
  }

  return (
    <button
      className="text-right text-sm font-medium tabular-nums hover:text-primary hover:underline underline-offset-2 cursor-pointer"
      title="Click to edit price"
      onClick={() => { setValue(String(item.price)); setEditing(true); }}
    >
      ${item.price}
    </button>
  );
}

// ── Sortable row ───────────────────────────────────────────────────────────────
function SortableRow({
  item,
  categories,
  onEdit,
  onDelete,
  onToggle,
  onPriceSaved,
}: {
  item: CatalogRow;
  categories: string[];
  onEdit: (item: CatalogRow) => void;
  onDelete: (id: string) => void;
  onToggle: (item: CatalogRow) => void;
  onPriceSaved: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border text-sm ${!item.active ? "opacity-50" : ""}`}
    >
      {/* Drag handle */}
      <td className="w-8 pl-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>

      {/* Image thumbnail */}
      <td className="w-12 py-2">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-9 w-9 rounded object-cover bg-muted"
            loading="lazy"
          />
        ) : (
          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
            <ImagePlus className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </td>

      {/* Name + description */}
      <td className="py-2 pr-4">
        <div className="font-medium">{item.name}</div>
        {item.description && (
          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
            {item.description}
          </div>
        )}
      </td>

      {/* Category */}
      <td className="py-2 pr-4">
        <Badge variant="secondary" className="text-xs font-normal">
          {item.category}
        </Badge>
      </td>

      {/* Price — inline editable */}
      <td className="py-2 pr-4 text-right">
        <PriceCell item={item} onSaved={onPriceSaved} />
      </td>

      {/* Active toggle */}
      <td className="py-2 text-center w-16">
        <Switch
          checked={item.active}
          onCheckedChange={() => onToggle(item)}
          aria-label={item.active ? "Deactivate item" : "Activate item"}
        />
      </td>

      {/* Actions */}
      <td className="py-2 pr-2 w-16">
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={() => onEdit(item)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Edit item"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="text-muted-foreground hover:text-destructive p-1 rounded"
            aria-label="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Image uploader ─────────────────────────────────────────────────────────────
function ImageUploader({
  value,
  onChange,
  itemId,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  itemId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Only image files allowed" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${itemId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("catalog-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
      return;
    }
    const { data } = supabase.storage.from("catalog-images").getPublicUrl(path);
    onChange(data.publicUrl);
  };

  return (
    <div className="space-y-2">
      <Label>Image</Label>
      <div
        className="relative border-2 border-dashed border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {value ? (
          <div className="relative group">
            <img
              src={value}
              alt="Item"
              className="w-full h-36 object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <span className="text-white text-xs font-medium">Click to replace</span>
            </div>
            <button
              type="button"
              className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="h-36 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs">Click or drag an image here</span>
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {/* Fallback URL input */}
      <Input
        placeholder="Or paste an image URL…"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-xs"
      />
    </div>
  );
}

// ── Item dialog (add / edit) ───────────────────────────────────────────────────
interface ItemForm {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  image_url: string | null;
  active: boolean;
}

const emptyForm = (): ItemForm => ({
  id: "",
  name: "",
  category: "",
  description: "",
  price: "0",
  image_url: null,
  active: true,
});

function ItemDialog({
  open,
  editing,
  existingCategories,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: CatalogRow | null;
  existingCategories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [slugLocked, setSlugLocked] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        id: editing.id,
        name: editing.name,
        category: editing.category,
        description: editing.description ?? "",
        price: String(editing.price),
        image_url: editing.image_url,
        active: editing.active,
      });
      setSlugLocked(true);
      setCustomCategory(!existingCategories.includes(editing.category));
    } else {
      setForm(emptyForm());
      setSlugLocked(false);
      setCustomCategory(false);
    }
  }, [open, editing, existingCategories]);

  const set = <K extends keyof ItemForm>(key: K, val: ItemForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleNameChange = (name: string) => {
    set("name", name);
    if (!slugLocked) set("id", slugify(name));
  };

  const handleSave = async () => {
    const price = parseFloat(form.price);
    if (!form.id || !form.name || !form.category) {
      toast({ variant: "destructive", title: "Name and category are required" });
      return;
    }
    if (isNaN(price) || price < 0) {
      toast({ variant: "destructive", title: "Enter a valid price" });
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name,
      category: form.category,
      description: form.description || null,
      price,
      image_url: form.image_url,
      active: form.active,
    };

    if (editing) {
      const { error } = await supabase.from("catalog_items").update(payload).eq("id", editing.id);
      if (error) {
        toast({ variant: "destructive", title: "Save failed", description: error.message });
        setSaving(false);
        return;
      }
    } else {
      // Get next sort_order
      const { data: existing } = await supabase
        .from("catalog_items")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextSort = existing?.[0]?.sort_order != null ? existing[0].sort_order + 1 : 0;

      const { error } = await supabase.from("catalog_items").insert({
        id: form.id,
        sort_order: nextSort,
        ...payload,
      });
      if (error) {
        toast({ variant: "destructive", title: "Add failed", description: error.message });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast({ title: editing ? "Item updated" : "Item added" });
    onSaved();
    onClose();
  };

  const ALL_CATEGORIES = [...new Set([...existingCategories])];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit: ${editing.name}` : "Add New Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Name */}
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Couch / Sofa"
            />
          </div>

          {/* Slug (auto-generated, editable) */}
          {!editing && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5">
                ID / Slug
                <span className="text-xs text-muted-foreground font-normal">(auto-generated)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={form.id}
                  onChange={(e) => { set("id", slugify(e.target.value)); setSlugLocked(true); }}
                  placeholder="couch-sofa"
                  className="font-mono text-sm"
                />
                {slugLocked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { set("id", slugify(form.name)); setSlugLocked(false); }}
                    title="Re-sync from name"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Category */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Category *</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setCustomCategory((c) => !c)}
              >
                {customCategory ? "Choose existing" : "New category"}
              </button>
            </div>
            {customCategory || ALL_CATEGORIES.length === 0 ? (
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="e.g. Furniture"
              />
            ) : (
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Price */}
          <div className="space-y-1">
            <Label>Price ($) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                className="pl-7"
                placeholder="0"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5">
              Description
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short description shown on the booking widget…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Image */}
          <ImageUploader
            value={form.image_url}
            onChange={(url) => set("image_url", url)}
            itemId={form.id || `new-${Date.now()}`}
          />

          {/* Active */}
          <div className="flex items-center gap-3 pt-1">
            <Switch
              id="active-toggle"
              checked={form.active}
              onCheckedChange={(v) => set("active", v)}
            />
            <Label htmlFor="active-toggle" className="cursor-pointer">
              Visible to customers
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Save Changes" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CatalogManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchItems = useCallback(async () => {
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
    fetchItems();
  }, [fetchItems]);

  const categories = [...new Set(items.map((i) => i.category))];

  const displayed = categoryFilter === "all"
    ? items
    : items.filter((i) => i.category === categoryFilter);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    setItems(reordered);

    // Persist updated sort_order for all affected rows
    await Promise.all(
      reordered.map((item, idx) =>
        supabase.from("catalog_items").update({ sort_order: idx }).eq("id", item.id),
      ),
    );
  };

  const handleToggle = async (item: CatalogRow) => {
    await supabase.from("catalog_items").update({ active: !item.active }).eq("id", item.id);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    } else {
      toast({ title: "Item deleted" });
      fetchItems();
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (item: CatalogRow) => { setEditing(item); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {items.length} items · {categories.length} categories
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any price to edit it inline. Drag the <GripVertical className="h-3 w-3 inline" /> handle to reorder.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Item
        </Button>
      </div>

      {/* Category filter tabs */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={categoryFilter === "all" ? "default" : "outline"}
            onClick={() => setCategoryFilter("all")}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={categoryFilter === c ? "default" : "outline"}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-8 pl-2" />
                <th className="w-12" />
                <th className="py-2.5 pr-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Item
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Category
                </th>
                <th className="py-2.5 pr-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Price
                </th>
                <th className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">
                  Active
                </th>
                <th className="w-16" />
              </tr>
            </thead>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayed.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {displayed.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                        {categoryFilter !== "all"
                          ? `No items in "${categoryFilter}".`
                          : 'No items yet. Click "Add Item" to get started.'}
                      </td>
                    </tr>
                  ) : (
                    displayed.map((item) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        categories={categories}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onToggle={handleToggle}
                        onPriceSaved={fetchItems}
                      />
                    ))
                  )}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
      )}

      <ItemDialog
        open={dialogOpen}
        editing={editing}
        existingCategories={categories}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchItems}
      />
    </div>
  );
}
