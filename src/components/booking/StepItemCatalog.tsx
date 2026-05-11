import { useState, useMemo, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { BOOKING_CONFIG } from "@/config/booking";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Minus, X, Camera,
  Sofa, Refrigerator, Monitor, TreePine, Package,
} from "lucide-react";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const categoryIcons: Record<string, typeof Sofa> = {
  Furniture: Sofa,
  Appliances: Refrigerator,
  Electronics: Monitor,
  "Yard & Outdoor": TreePine,
  Miscellaneous: Package,
};

export function StepItemCatalog() {
  const {
    catalog, categories, catalogLoading, state,
    addToCart, updateQuantity, addCustomItem, removeCustomItem,
    updateCustomer, setSkipPhotos,
  } = useBooking();
  const { toast } = useToast();
  const c = state.customer;
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = c.photos.map((f) => URL.createObjectURL(f));
    setPhotoUrls(urls);
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [c.photos]);

  const filtered = useMemo(() => {
    let items = catalog;
    if (activeCategory !== "All") items = items.filter((i) => i.category === activeCategory);
    if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [catalog, activeCategory, search]);

  const getQty = (id: string) => state.cart.find((c) => c.item.id === id)?.quantity ?? 0;

  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">Select your items</h2>
      <p className="text-sm text-muted-foreground mb-4">Add everything you need picked up.</p>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1 scrollbar-none">
        {["All", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 bg-card",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((item) => {
          const qty = getQty(item.id);
          const Icon = categoryIcons[item.category] || Package;
          return (
            <div
              key={item.id}
              className={cn(
                "relative border rounded-xl transition-all overflow-hidden",
                item.imageUrl ? "min-h-[140px] flex flex-col justify-end" : "p-3 bg-card",
                qty > 0 ? "border-primary shadow-sm" : "border-border",
              )}
            >
              {item.imageUrl ? (
                <>
                  {/* Full background image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${item.imageUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                  {/* Content over image */}
                  <div className="relative z-10 p-3 pt-8">
                    <p className="text-xs font-medium text-white truncate text-center">{item.name}</p>
                    <p className="text-xs font-bold text-white/90 text-center mt-0.5">
                      {BOOKING_CONFIG.currencySymbol}{item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      {qty > 0 ? (
                        <>
                          <button
                            onClick={() => updateQuantity(item.id, qty - 1)}
                            className="h-7 w-7 rounded-full border border-white/30 bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                          >
                            <Minus className="h-3 w-3 text-white" />
                          </button>
                          <span className="text-sm font-semibold w-6 text-center text-white">{qty}</span>
                          <button
                            onClick={() => updateQuantity(item.id, qty + 1)}
                            className="h-7 w-7 rounded-full border border-white/30 bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                          >
                            <Plus className="h-3 w-3 text-white" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="text-xs px-4 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center h-10 mb-2">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium text-foreground truncate text-center">{item.name}</p>
                  <p className="text-xs font-bold text-primary text-center mt-0.5">
                    {BOOKING_CONFIG.currencySymbol}{item.price}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    {qty > 0 ? (
                      <>
                        <button
                          onClick={() => updateQuantity(item.id, qty - 1)}
                          className="h-7 w-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center text-foreground">{qty}</span>
                        <button
                          onClick={() => updateQuantity(item.id, qty + 1)}
                          className="h-7 w-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="text-xs px-4 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No items found.</p>
      )}

      {/* Item not listed */}
      <div className="mt-6 border-t border-border pt-4">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-sm text-primary flex items-center gap-1.5 font-medium hover:underline"
        >
          <Plus className="h-4 w-4" />
          Item not listed?
        </button>
        {showCustom && (
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Describe your item..."
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              className="bg-card text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customDesc.trim()) {
                  addCustomItem(customDesc.trim());
                  setCustomDesc("");
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (customDesc.trim()) {
                  addCustomItem(customDesc.trim());
                  setCustomDesc("");
                }
              }}
            >
              Add
            </Button>
          </div>
        )}
        {state.customItems.map((ci, i) => (
          <div
            key={i}
            className="flex items-center justify-between mt-2 text-sm bg-muted rounded-lg px-3 py-2"
          >
            <span className="text-foreground">{ci.description}</span>
            <button onClick={() => removeCustomItem(i)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Photo upload */}
      <div className="mt-6 border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-1">
          <Label className="text-xs font-medium text-foreground">Photos</Label>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {BOOKING_CONFIG.photoPromoPercent}% OFF
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Upload photos of each item accurately &amp; get {BOOKING_CONFIG.photoPromoPercent}% off!</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (!e.target.files) return;
            const valid: File[] = [];
            const rejected: string[] = [];
            Array.from(e.target.files).forEach((file) => {
              if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
                rejected.push(`${file.name}: unsupported format (use JPEG, PNG, or WEBP)`);
              } else if (file.size > MAX_PHOTO_BYTES) {
                rejected.push(`${file.name}: exceeds 10 MB limit`);
              } else {
                valid.push(file);
              }
            });
            if (rejected.length > 0) {
              toast({ variant: "destructive", title: "Some photos skipped", description: rejected.join(" · ") });
            }
            if (valid.length > 0) {
              updateCustomer({ photos: [...c.photos, ...valid] });
            }
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors bg-card"
        >
          <Camera className="h-4 w-4" />
          Upload photos
        </button>
        {c.photos.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {c.photos.map((_, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                <img src={photoUrls[i]} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() =>
                    updateCustomer({ photos: c.photos.filter((_, idx) => idx !== i) })
                  }
                  className="absolute top-0 right-0 bg-foreground/60 text-background rounded-bl text-xs px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Skip photos checkbox */}
        {c.photos.length === 0 && (
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <Checkbox
              checked={state.skipPhotos}
              onCheckedChange={(checked) => setSkipPhotos(!!checked)}
            />
            <span className="text-xs text-muted-foreground">
              I don't have photos — continue without {BOOKING_CONFIG.photoPromoPercent}% discount
            </span>
          </label>
        )}
      </div>
    </motion.div>
  );
}
