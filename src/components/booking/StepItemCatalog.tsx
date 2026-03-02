import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { BOOKING_CONFIG } from "@/config/booking";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Plus, Minus, X,
  Sofa, Refrigerator, Monitor, TreePine, Package,
} from "lucide-react";

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
  } = useBooking();

  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customDesc, setCustomDesc] = useState("");

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
                "border rounded-xl p-3 transition-all bg-card",
                qty > 0 ? "border-primary shadow-sm" : "border-border",
              )}
            >
              <div className="flex items-center justify-center h-10 mb-2">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-9 w-9 object-contain rounded" />
                ) : (
                  <Icon className="h-6 w-6 text-muted-foreground" />
                )}
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
    </motion.div>
  );
}
