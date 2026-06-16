import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { ServiceType } from "@/types/booking";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Heart, Package, Loader2 } from "lucide-react";
import junkRemovalBg from "@/assets/junk-removal-bg.jpg";
import donationPickupBg from "@/assets/donation-pickup-bg.jpg";
import { imgStyle, DEFAULT_IMAGE_SETTINGS } from "@/lib/imageSettings";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK_IMAGES: Record<string, string> = {
  "junk_removal_card": junkRemovalBg,
  "donation_pickup_card": donationPickupBg,
};

const ICON_MAP: Record<string, typeof Truck> = {
  Truck, Heart, Package,
};

interface DBServiceType {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  image_key: string | null;
  sort_order: number;
}

export function StepServiceType() {
  const { state, config, setServiceType, nextStep, updateCustomer, zipPricing, zipLookupLoading, appImages } = useBooking();
  const [serviceTypes, setServiceTypes] = useState<DBServiceType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  useEffect(() => {
    supabase.from("service_types")
      .select("id, slug, title, description, icon, image_key, sort_order")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => {
        setServiceTypes(data ?? []);
        setLoadingTypes(false);
      });
  }, []);

  const zipRestricted = config.enable_zip_restrictions;
  const zipReady = zipPricing.status === "resolved";
  const zipBlocked = !!state.customer.zip && !zipReady;

  const contactEmail = config.contact_email;
  const sym = config.currency_symbol;

  const zipMessage = zipLookupLoading
    ? "Checking your area..."
    : zipReady
      ? (zipPricing.minimumPrice != null ? `Area minimum: ${sym}${zipPricing.minimumPrice}` : "")
      : zipPricing.status === "unmapped"
        ? `We service your area! Contact us for a custom quote${contactEmail ? `: ${contactEmail}` : "."}`
        : "Enter your ZIP code to check availability in your area.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">What do you need?</h2>
      <p className="text-sm text-muted-foreground mb-6">Choose the service that fits your needs.</p>

      {zipRestricted && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <Label htmlFor="service-zip" className="text-xs font-medium text-foreground">ZIP Code *</Label>
          <Input
            id="service-zip"
            value={state.customer.zip}
            onChange={(e) => updateCustomer({ zip: e.target.value })}
            placeholder="90210"
            className="mt-2 bg-background"
            inputMode="numeric"
            maxLength={10}
          />
          {zipMessage && (
            <p className={`mt-2 text-xs ${zipBlocked ? "text-destructive" : "text-muted-foreground"}`}>
              {zipMessage}
            </p>
          )}
        </div>
      )}

      {loadingTypes ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {serviceTypes.map((svc) => {
            const Icon = ICON_MAP[svc.icon] ?? Truck;
            const imageKey = svc.image_key ?? "";
            const custom = appImages[imageKey];
            const bgUrl = custom?.url || FALLBACK_IMAGES[imageKey] || junkRemovalBg;
            const settings = custom?.url ? custom.settings : DEFAULT_IMAGE_SETTINGS;

            return (
              <button
                key={svc.id}
                type="button"
                disabled={!zipReady}
                onClick={() => {
                  if (!zipReady) return;
                  setServiceType(svc.slug as ServiceType);
                  nextStep();
                }}
                className={cn(
                  "relative rounded-xl border-2 text-left transition-all overflow-hidden min-h-[200px] flex flex-col justify-end",
                  state.serviceType === svc.slug
                    ? "border-primary shadow-sm ring-2 ring-primary/30"
                    : "border-border",
                  zipReady ? "hover:shadow-lg hover:border-primary/40" : "cursor-not-allowed opacity-50 grayscale",
                )}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <img src={bgUrl} alt="" style={imgStyle(settings)} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
                <div className="relative z-10 p-5">
                  <div className="h-10 w-10 rounded-lg bg-primary/90 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-white text-lg">{svc.title}</h3>
                  <p className="text-sm text-white/80 mt-1 leading-relaxed">{svc.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
