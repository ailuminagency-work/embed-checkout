import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, Trash2, ImagePlus, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_IMAGE_SETTINGS,
  ImageSettings,
  imgStyle,
  parseImageSettings,
} from "@/lib/imageSettings";
import { cn } from "@/lib/utils";

type ImageKey = "widget_background" | "junk_removal_card" | "donation_pickup_card";

interface SlotConfig {
  key: ImageKey;
  title: string;
  description: string;
  preview: "background" | "card";
}

const SLOTS: SlotConfig[] = [
  {
    key: "widget_background",
    title: "Widget Background",
    description: "Shown behind the entire booking widget.",
    preview: "background",
  },
  {
    key: "junk_removal_card",
    title: "Junk Removal Card",
    description: "Image on the Junk Removal service card.",
    preview: "card",
  },
  {
    key: "donation_pickup_card",
    title: "Donation Pickup Card",
    description: "Image on the Donation Pickup service card.",
    preview: "card",
  },
];

interface SlotState {
  url: string | null;
  settings: ImageSettings;
  dirty: boolean;
  saving: boolean;
  uploading: boolean;
}

const emptySlot = (): SlotState => ({
  url: null,
  settings: { ...DEFAULT_IMAGE_SETTINGS },
  dirty: false,
  saving: false,
  uploading: false,
});

export function BrandingManager() {
  const [slots, setSlots] = useState<Record<ImageKey, SlotState>>({
    widget_background: emptySlot(),
    junk_removal_card: emptySlot(),
    donation_pickup_card: emptySlot(),
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("app_images").select("key, url, settings");
    if (error) {
      toast({ title: "Failed to load images", description: error.message, variant: "destructive" });
    } else if (data) {
      setSlots((prev) => {
        const next = { ...prev };
        SLOTS.forEach(({ key }) => {
          const row = data.find((r) => r.key === key);
          next[key] = {
            url: row?.url ?? null,
            settings: parseImageSettings(row?.settings),
            dirty: false,
            saving: false,
            uploading: false,
          };
        });
        return next;
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateSlot = (key: ImageKey, partial: Partial<SlotState>) => {
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } }));
  };

  const updateSettings = (key: ImageKey, partial: Partial<ImageSettings>) => {
    setSlots((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        settings: { ...prev[key].settings, ...partial },
        dirty: true,
      },
    }));
  };

  const handleFile = async (key: ImageKey, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    updateSlot(key, { uploading: true });
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("app-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("app-images").getPublicUrl(path);
      const url = pub.publicUrl;
      const settings = { ...DEFAULT_IMAGE_SETTINGS };
      const { error: dbErr } = await supabase
        .from("app_images")
        .upsert(
          { key, url, settings: settings as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (dbErr) throw dbErr;
      updateSlot(key, { url, settings, dirty: false, uploading: false });
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      updateSlot(key, { uploading: false });
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (key: ImageKey) => {
    updateSlot(key, { saving: true });
    try {
      const { error } = await supabase
        .from("app_images")
        .upsert(
          {
            key,
            url: null,
            settings: DEFAULT_IMAGE_SETTINGS as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
      if (error) throw error;
      updateSlot(key, {
        url: null,
        settings: { ...DEFAULT_IMAGE_SETTINGS },
        dirty: false,
        saving: false,
      });
      toast({ title: "Image removed" });
    } catch (e: any) {
      updateSlot(key, { saving: false });
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
  };

  const saveSettings = async (key: ImageKey) => {
    const slot = slots[key];
    updateSlot(key, { saving: true });
    try {
      const { error } = await supabase
        .from("app_images")
        .upsert(
          {
            key,
            url: slot.url,
            settings: slot.settings as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
      if (error) throw error;
      updateSlot(key, { dirty: false, saving: false });
      toast({ title: "Saved" });
    } catch (e: any) {
      updateSlot(key, { saving: false });
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const resetSettings = (key: ImageKey) => {
    updateSlot(key, { settings: { ...DEFAULT_IMAGE_SETTINGS }, dirty: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Branding Images</h2>
        <p className="text-sm text-muted-foreground">
          Drop or pick an image, then drag the sliders to crop and zoom. Your changes preview live.
        </p>
      </div>

      <div className="space-y-4">
        {SLOTS.map((slot) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            state={slots[slot.key]}
            onFile={(file) => handleFile(slot.key, file)}
            onRemove={() => handleRemove(slot.key)}
            onSave={() => saveSettings(slot.key)}
            onReset={() => resetSettings(slot.key)}
            onSettingsChange={(p) => updateSettings(slot.key, p)}
          />
        ))}
      </div>
    </div>
  );
}

interface SlotCardProps {
  slot: SlotConfig;
  state: SlotState;
  onFile: (file: File) => void;
  onRemove: () => void;
  onSave: () => void;
  onReset: () => void;
  onSettingsChange: (partial: Partial<ImageSettings>) => void;
}

function SlotCard({ slot, state, onFile, onRemove, onSave, onReset, onSettingsChange }: SlotCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const busy = state.uploading || state.saving;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{slot.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{slot.description}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid md:grid-cols-[1fr,260px] gap-4">
        {/* Live preview */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !state.url && inputRef.current?.click()}
          className={cn(
            "relative rounded-lg overflow-hidden border-2 transition-colors",
            slot.preview === "background" ? "aspect-[16/9]" : "aspect-[4/5]",
            dragOver ? "border-primary bg-primary/5" : "border-dashed border-border",
            !state.url && "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
            state.url && "border-solid",
          )}
        >
          {state.url ? (
            <>
              <img src={state.url} alt={slot.title} style={imgStyle(state.settings)} />
              {slot.preview === "card" && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10 pointer-events-none" />
              )}
              {slot.preview === "background" && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-none flex items-center justify-center">
                  <span className="text-xs text-foreground/70 bg-background/70 px-2 py-1 rounded">
                    Widget content sits here
                  </span>
                </div>
              )}
              {slot.preview === "card" && (
                <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
                  <div className="text-white text-sm font-semibold">{slot.title}</div>
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 px-4 text-center">
              {state.uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <>
                  <ImagePlus className="h-7 w-7" />
                  <div className="text-sm font-medium text-foreground">
                    {dragOver ? "Drop image here" : "Click or drop image"}
                  </div>
                  <div className="text-xs">PNG, JPG, WEBP up to ~5 MB</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {state.url ? "Replace" : "Upload"}
            </Button>
            {state.url && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onRemove}
                aria-label="Remove image"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {state.url && (
            <>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onSettingsChange({ fit: "cover" })}
                  className={cn(
                    "flex-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-colors",
                    state.settings.fit === "cover"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  Fill
                </button>
                <button
                  type="button"
                  onClick={() => onSettingsChange({ fit: "contain" })}
                  className={cn(
                    "flex-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-colors",
                    state.settings.fit === "contain"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  Fit
                </button>
              </div>

              <SliderRow
                label="Zoom"
                value={state.settings.zoom}
                min={50}
                max={300}
                step={1}
                suffix="%"
                onChange={(v) => onSettingsChange({ zoom: v })}
              />
              <SliderRow
                label="Horizontal"
                value={state.settings.positionX}
                min={0}
                max={100}
                step={1}
                suffix="%"
                onChange={(v) => onSettingsChange({ positionX: v })}
              />
              <SliderRow
                label="Vertical"
                value={state.settings.positionY}
                min={0}
                max={100}
                step={1}
                suffix="%"
                onChange={(v) => onSettingsChange({ positionY: v })}
              />

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onReset}
                  disabled={busy}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  onClick={onSave}
                  disabled={busy || !state.dirty}
                >
                  {state.saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : state.dirty ? (
                    "Save changes"
                  ) : (
                    "Saved"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, min, max, step, suffix, onChange }: SliderRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}