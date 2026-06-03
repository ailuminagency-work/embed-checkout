import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TimeWindow { id: string; label: string; sort_order: number; active: boolean; }

function SortableRow({
  tw, onToggle, onDelete, onLabelChange,
}: {
  tw: TimeWindow;
  onToggle: (tw: TimeWindow) => void;
  onDelete: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tw.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
    >
      <button {...attributes} {...listeners} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={tw.label}
        onChange={(e) => onLabelChange(tw.id, e.target.value)}
        className="flex-1 h-8 text-sm"
      />
      <Switch checked={tw.active} onCheckedChange={() => onToggle(tw)} />
      <button onClick={() => onDelete(tw.id)} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function TimeWindowManager() {
  const { toast } = useToast();
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    supabase.from("time_windows").select("*").order("sort_order").then(({ data }) => {
      setWindows(data ?? []);
      setLoading(false);
    });
  }, []);

  const saveAll = async (updated: TimeWindow[]) => {
    setSaving(true);
    await Promise.all(updated.map((tw, i) =>
      supabase.from("time_windows").update({ label: tw.label, active: tw.active, sort_order: i + 1 }).eq("id", tw.id)
    ));
    setSaving(false);
    toast({ title: "Time windows saved" });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const reordered = arrayMove(windows, windows.findIndex(w => w.id === active.id), windows.findIndex(w => w.id === over.id));
    setWindows(reordered);
    await saveAll(reordered);
  };

  const handleToggle = async (tw: TimeWindow) => {
    const updated = windows.map(w => w.id === tw.id ? { ...w, active: !w.active } : w);
    setWindows(updated);
    await supabase.from("time_windows").update({ active: !tw.active }).eq("id", tw.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this time window?")) return;
    await supabase.from("time_windows").delete().eq("id", id);
    setWindows(w => w.filter(tw => tw.id !== id));
    toast({ title: "Deleted" });
  };

  const handleLabelChange = (id: string, label: string) => {
    setWindows(w => w.map(tw => tw.id === id ? { ...tw, label } : tw));
  };

  const addWindow = async () => {
    const id = `window-${Date.now()}`;
    const sort_order = windows.length + 1;
    const { data } = await supabase.from("time_windows")
      .insert({ id, label: "New Time Window", sort_order, active: true })
      .select().single();
    if (data) setWindows(w => [...w, data]);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Drag to reorder. Changes save automatically.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => saveAll(windows)} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Save Labels
          </Button>
          <Button size="sm" onClick={addWindow}>
            <Plus className="h-4 w-4 mr-1" /> Add Window
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={windows.map(w => w.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {windows.map(tw => (
              <SortableRow key={tw.id} tw={tw} onToggle={handleToggle} onDelete={handleDelete} onLabelChange={handleLabelChange} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {windows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No time windows. Click "Add Window" to create one.
        </div>
      )}
    </div>
  );
}
