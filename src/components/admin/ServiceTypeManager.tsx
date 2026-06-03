import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ICON_OPTIONS = ["Truck", "Heart", "Package", "Trash2", "Home", "Star", "Zap", "Settings"];

interface ServiceType {
  id: string; slug: string; title: string; description: string;
  icon: string; image_key: string | null; active: boolean; sort_order: number;
}

function SortableRow({ svc, onEdit, onDelete, onToggle }: {
  svc: ServiceType;
  onEdit: (s: ServiceType) => void;
  onDelete: (id: string) => void;
  onToggle: (s: ServiceType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: svc.id });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
        className={`border-b border-border text-sm ${!svc.active ? "opacity-50" : ""}`}>
      <td className="w-8 pl-2">
        <button {...attributes} {...listeners} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab touch-none">
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="py-2 pr-4">
        <div className="font-medium">{svc.title}</div>
        <div className="text-xs text-muted-foreground font-mono">{svc.slug}</div>
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">{svc.description}</td>
      <td className="py-2 pr-4"><Badge variant="secondary" className="text-xs">{svc.icon}</Badge></td>
      <td className="py-2 text-center w-16"><Switch checked={svc.active} onCheckedChange={() => onToggle(svc)} /></td>
      <td className="py-2 pr-2 w-16">
        <div className="flex gap-1.5 justify-end">
          <button onClick={() => onEdit(svc)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => onDelete(svc.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
        </div>
      </td>
    </tr>
  );
}

interface FormState {
  id: string; slug: string; title: string; description: string; icon: string; image_key: string;
}
const emptyForm = (): FormState => ({ id: "", slug: "", title: "", description: "", icon: "Truck", image_key: "" });

function slugify(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

export function ServiceTypeManager() {
  const { toast } = useToast();
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetch = () => supabase.from("service_types").select("*").order("sort_order").then(({ data }) => {
    setTypes(data ?? []); setLoading(false);
  });

  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (s: ServiceType) => {
    setEditing(s);
    setForm({ id: s.id, slug: s.slug, title: s.title, description: s.description, icon: s.icon, image_key: s.image_key ?? "" });
    setDialogOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.slug) { toast({ variant: "destructive", title: "Title and slug are required" }); return; }
    setSaving(true);
    const payload = { title: form.title, slug: form.slug, description: form.description, icon: form.icon, image_key: form.image_key || null };
    if (editing) {
      await supabase.from("service_types").update(payload).eq("id", editing.id);
    } else {
      const sort_order = types.length + 1;
      await supabase.from("service_types").insert({ id: form.slug, sort_order, active: true, ...payload });
    }
    setSaving(false);
    toast({ title: editing ? "Saved" : "Added" });
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this service type?")) return;
    await supabase.from("service_types").delete().eq("id", id);
    fetch();
  };

  const handleToggle = async (s: ServiceType) => {
    await supabase.from("service_types").update({ active: !s.active }).eq("id", s.id);
    setTypes(t => t.map(x => x.id === s.id ? { ...x, active: !x.active } : x));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const reordered = arrayMove(types, types.findIndex(t => t.id === active.id), types.findIndex(t => t.id === over.id));
    setTypes(reordered);
    await Promise.all(reordered.map((t, i) => supabase.from("service_types").update({ sort_order: i + 1 }).eq("id", t.id)));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Service Type</Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-8 pl-2" />
              <th className="py-2.5 pr-4 text-left text-xs font-semibold text-muted-foreground uppercase">Service</th>
              <th className="py-2.5 pr-4 text-left text-xs font-semibold text-muted-foreground uppercase">Description</th>
              <th className="py-2.5 pr-4 text-left text-xs font-semibold text-muted-foreground uppercase">Icon</th>
              <th className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase w-16">Active</th>
              <th className="w-16" />
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={types.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {types.map(s => <SortableRow key={s.id} svc={s} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />)}
                {types.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No service types. Click "Add" to create one.</td></tr>
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? `Edit: ${editing.title}` : "Add Service Type"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => { set("title", e.target.value); if (!editing) set("slug", slugify(e.target.value)); }} placeholder="Junk Removal" />
            </div>
            <div className="space-y-1">
              <Label>Slug (ID) *</Label>
              <Input value={form.slug} onChange={e => set("slug", slugify(e.target.value))} placeholder="junk-removal" className="font-mono text-sm" disabled={!!editing} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="resize-none text-sm" />
            </div>
            <div className="space-y-1">
              <Label>Icon (Lucide name)</Label>
              <Select value={form.icon} onValueChange={v => set("icon", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ICON_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5">Image Key <span className="text-xs text-muted-foreground font-normal">(from app_images table)</span></Label>
              <Input value={form.image_key} onChange={e => set("image_key", e.target.value)} placeholder="junk_removal_card" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
