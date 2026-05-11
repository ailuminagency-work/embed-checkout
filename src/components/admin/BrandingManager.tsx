import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeftRight,
  ImageIcon,
  ImagePlus,
  Layers,
  Loader2,
  Maximize2,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_IMAGE_SETTINGS,
  ImageSettings,
  imgStyle,
  parseImageSettings,
} from "@/lib/imageSettings";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

type ImageKey = "widget_background" | "junk_removal_card" | "donation_pickup_card";
type SectionKey = "background" | "cards";

interface SlotConfig {
  key: ImageKey;
  title: string;
  location: string;
  folder: string;
  preview: "background" | "card";
}

const SLOTS: SlotConfig[] = [
  {
    key: "widget_background",
    title: "Background Image",
    location: "Main booking area",
    folder: "background",
    preview: "background",
  },
  {
    key: "junk_removal_card",
    title: "Junk Removal Card",
    location: "Service selection card",
    folder: "service-cards/junk-removal",
    preview: "card",
  },
  {
    key: "donation_pickup_card",
    title: "Donation Pickup Card",
    location: "Service selection card",
    folder: "service-cards/donation-pickup",
    preview: "card",
  },
];

const SLOT_BY_KEY = Object.fromEntries(SLOTS.map((slot) => [slot.key, slot])) as Record<
  ImageKey,
  SlotConfig
>;

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

const getStoragePath = (url: string | null) => {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname;
    const marker = "/app-images/";
    const index = pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
};

const safeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "image.jpg";

const toImageSettingsJson = (settings: ImageSettings): Json => ({
  fit: settings.fit,
  positionX: settings.positionX,
  positionY: settings.positionY,
  zoom: settings.zoom,
});

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again.";

export function BrandingManager() {
  const [activeSection, setActiveSection] = useState<SectionKey>("background");
  const [activeCard, setActiveCard] = useState<ImageKey>("junk_removal_card");
  const [slots, setSlots] = useState<Record<ImageKey, SlotState>>({
    widget_background: emptySlot(),
    junk_removal_card: emptySlot(),
    donation_pickup_card: emptySlot(),
  });
  const [loading, setLoading] = useState(true);

  const visibleSlotKey = activeSection === "background" ? "widget_background" : activeCard;
  const visibleSlot = SLOT_BY_KEY[visibleSlotKey];

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

  const statusCounts = useMemo(() => {
    const backgroundReady = slots.widget_background.url ? 1 : 0;
    const cardReady = [slots.junk_removal_card, slots.donation_pickup_card].filter((slot) => slot.url)
      .length;
    return { backgroundReady, cardReady };
  }, [slots]);

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

  const removeStorageFile = async (url: string | null) => {
    const path = getStoragePath(url);
    if (path) await supabase.storage.from("app-images").remove([path]);
  };

  const handleFile = async (key: ImageKey, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    updateSlot(key, { uploading: true });
    const previousUrl = slots[key].url;
    const slot = SLOT_BY_KEY[key];
    const path = `${slot.folder}/${Date.now()}-${safeFileName(file.name)}`;

    try {
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
          [{ key, url, settings: toImageSettingsJson(settings), updated_at: new Date().toISOString() }],
          { onConflict: "key" },
        );
      if (dbErr) throw dbErr;

      await removeStorageFile(previousUrl);
      updateSlot(key, { url, settings, dirty: false, uploading: false });
      toast({ title: "Image saved" });
    } catch (e: unknown) {
      await supabase.storage.from("app-images").remove([path]);
      updateSlot(key, { uploading: false });
      toast({ title: "Upload failed", description: getErrorMessage(e), variant: "destructive" });
    }
  };

  const handleRemove = async (key: ImageKey) => {
    const previousUrl = slots[key].url;
    updateSlot(key, { saving: true });
    try {
      const { error } = await supabase
        .from("app_images")
        .upsert(
          [
            {
              key,
              url: null,
              settings: toImageSettingsJson(DEFAULT_IMAGE_SETTINGS),
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "key" },
        );
      if (error) throw error;

      await removeStorageFile(previousUrl);
      updateSlot(key, {
        url: null,
        settings: { ...DEFAULT_IMAGE_SETTINGS },
        dirty: false,
        saving: false,
      });
      toast({ title: "Image deleted" });
    } catch (e: unknown) {
      updateSlot(key, { saving: false });
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" });
    }
  };

  const saveSettings = async (key: ImageKey) => {
    const slot = slots[key];
    updateSlot(key, { saving: true });
    try {
      const { error } = await supabase
        .from("app_images")
        .upsert(
          [
            {
              key,
              url: slot.url,
              settings: toImageSettingsJson(slot.settings),
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "key" },
        );
      if (error) throw error;
      updateSlot(key, { dirty: false, saving: false });
      toast({ title: "Crop saved" });
    } catch (e: unknown) {
      updateSlot(key, { saving: false });
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" });
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
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Image Uploads</h2>
            <p className="text-sm text-muted-foreground">Choose a section, upload, adjust, save.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <StatusPill label="Background" value={`${statusCounts.backgroundReady}/1`} />
            <StatusPill label="Cards" value={`${statusCounts.cardReady}/2`} />
          </div>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as SectionKey)}>
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted p-1">
          <TabsTrigger value="background" className="gap-2 rounded-lg py-2.5">
            <ImageIcon className="h-4 w-4" />
            Background
          </TabsTrigger>
          <TabsTrigger value="cards" className="gap-2 rounded-lg py-2.5">
            <Layers className="h-4 w-4" />
            Card Images
          </TabsTrigger>
        </TabsList>

        <TabsContent value="background" className="mt-4">
          <ImageEditor
            slot={visibleSlot}
            state={slots.widget_background}
            onFile={(file) => handleFile("widget_background", file)}
            onRemove={() => handleRemove("widget_background")}
            onSave={() => saveSettings("widget_background")}
            onReset={() => resetSettings("widget_background")}
            onSettingsChange={(p) => updateSettings("widget_background", p)}
          />
        </TabsContent>

        <TabsContent value="cards" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {SLOTS.filter((slot) => slot.preview === "card").map((slot) => (
              <button
                key={slot.key}
                type="button"
                onClick={() => setActiveCard(slot.key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  activeCard === slot.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{slot.title}</span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      slots[slot.key].url ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                    aria-hidden
                  />
                </div>
                <div className="mt-1 text-xs">{slots[slot.key].url ? "Image added" : "No image"}</div>
              </button>
            ))}
          </div>

          <ImageEditor
            slot={visibleSlot}
            state={slots[activeCard]}
            onFile={(file) => handleFile(activeCard, file)}
            onRemove={() => handleRemove(activeCard)}
            onSave={() => saveSettings(activeCard)}
            onReset={() => resetSettings(activeCard)}
            onSettingsChange={(p) => updateSettings(activeCard, p)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface StatusPillProps {
  label: string;
  value: string;
}

function StatusPill({ label, value }: StatusPillProps) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-foreground">{value}</div>
    </div>
  );
}

interface ImageEditorProps {
  slot: SlotConfig;
  state: SlotState;
  onFile: (file: File) => void;
  onRemove: () => void;
  onSave: () => void;
  onReset: () => void;
  onSettingsChange: (partial: Partial<ImageSettings>) => void;
}

function ImageEditor({ slot, state, onFile, onRemove, onSave, onReset, onSettingsChange }: ImageEditorProps) {
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {slot.location}
          </div>
          <h3 className="text-lg font-semibold text-foreground">{slot.title}</h3>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          Folder: <span className="font-mono text-foreground">app-images/{slot.folder}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),280px]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !state.url && inputRef.current?.click()}
          className={cn(
            "relative overflow-hidden rounded-xl border-2 transition-colors",
            slot.preview === "background" ? "aspect-[16/9]" : "aspect-[4/5] max-h-[520px]",
            dragOver ? "border-primary bg-primary/5" : "border-border",
            !state.url && "cursor-pointer border-dashed hover:border-primary/60 hover:bg-muted/30",
          )}
        >
          {state.url ? (
            <>
              <img src={state.url} alt={slot.title} style={imgStyle(state.settings)} />
              {slot.preview === "background" ? <BackgroundPreviewOverlay /> : <CardPreviewOverlay title={slot.title} />}
              {busy && <BusyOverlay />}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
              {state.uploading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <>
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {dragOver ? "Drop image here" : "Upload image"}
                    </div>
                    <div className="mt-1 text-xs">PNG, JPG, WEBP</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {state.url ? "Change" : "Upload"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !state.url}
              onClick={onRemove}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <div className="mb-3 text-sm font-semibold text-foreground">Crop</div>
            {state.url ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSettingsChange({ fit: "cover" })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      state.settings.fit === "cover"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    onClick={() => onSettingsChange({ fit: "contain" })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      state.settings.fit === "contain"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Fit
                  </button>
                </div>

                <SliderRow
                  icon={Maximize2}
                  label="Zoom"
                  value={state.settings.zoom}
                  min={50}
                  max={300}
                  step={1}
                  suffix="%"
                  onChange={(v) => onSettingsChange({ zoom: v })}
                />
                <SliderRow
                  icon={ArrowLeftRight}
                  label="Left / Right"
                  value={state.settings.positionX}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={(v) => onSettingsChange({ positionX: v })}
                />
                <SliderRow
                  icon={ArrowLeftRight}
                  label="Up / Down"
                  value={state.settings.positionY}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={(v) => onSettingsChange({ positionY: v })}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                Upload an image first.
              </div>
            )}
          </div>

          <div className="grid grid-cols-[auto,1fr] gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onReset} disabled={busy || !state.url}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="button" size="sm" onClick={onSave} disabled={busy || !state.url || !state.dirty}>
              {state.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : state.dirty ? "Save crop" : "Saved"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackgroundPreviewOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
      <div className="w-3/5 rounded-xl border border-border bg-card/80 p-4 shadow-sm">
        <div className="mb-2 h-3 w-2/3 rounded-full bg-muted" />
        <div className="h-2 w-full rounded-full bg-muted" />
        <div className="mt-2 h-2 w-4/5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function CardPreviewOverlay({ title }: { title: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/45 to-foreground/10 pointer-events-none" />
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
        <div className="mb-2 h-10 w-10 rounded-lg bg-primary/90" />
        <div className="text-sm font-semibold text-primary-foreground">{title}</div>
      </div>
    </>
  );
}

function BusyOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

interface SliderRowProps {
  icon: typeof Maximize2;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function SliderRow({ icon: Icon, label, value, min, max, step, suffix, onChange }: SliderRowProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
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
