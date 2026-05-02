import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ImageKey = "widget_background" | "junk_removal_card" | "donation_pickup_card";

const SLOTS: { key: ImageKey; title: string; description: string }[] = [
  {
    key: "widget_background",
    title: "Widget Background",
    description: "Background image behind the booking widget. Replaces the plain white background.",
  },
  {
    key: "junk_removal_card",
    title: "Junk Removal Card",
    description: "Image used on the Junk Removal service-type card (Step 1).",
  },
  {
    key: "donation_pickup_card",
    title: "Donation Pickup Card",
    description: "Image used on the Donation Pickup service-type card (Step 1).",
  },
];

export function BrandingManager() {
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("app_images").select("key, url");
    if (error) {
      toast({ title: "Failed to load images", description: error.message, variant: "destructive" });
    } else if (data) {
      const map: Record<string, string | null> = {};
      data.forEach((row) => (map[row.key] = row.url));
      setImages(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (key: ImageKey, file: File) => {
    setBusyKey(key);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("app-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("app-images").getPublicUrl(path);
      const url = pub.publicUrl;

      const { error: dbErr } = await supabase
        .from("app_images")
        .upsert({ key, url, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (dbErr) throw dbErr;

      setImages((prev) => ({ ...prev, [key]: url }));
      toast({ title: "Image updated" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const handleClear = async (key: ImageKey) => {
    setBusyKey(key);
    try {
      const { error } = await supabase
        .from("app_images")
        .upsert({ key, url: null, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      setImages((prev) => ({ ...prev, [key]: null }));
      toast({ title: "Image removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Branding Images</h2>
        <p className="text-sm text-muted-foreground">
          Upload images used in the booking widget. Recommended: JPG/PNG under 2 MB.
        </p>
      </div>

      <div className="grid gap-4">
        {SLOTS.map(({ key, title, description }) => {
          const url = images[key];
          const busy = busyKey === key;
          return (
            <div key={key} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                  {url ? (
                    <img src={url} alt={title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium text-foreground">{title}</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">{description}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button asChild size="sm" disabled={busy}>
                      <label className="cursor-pointer">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        {url ? "Replace" : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(key, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </Button>
                    {url && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleClear(key)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
