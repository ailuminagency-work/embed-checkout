import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { ServiceType } from "@/types/booking";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Heart } from "lucide-react";
import junkRemovalBg from "@/assets/junk-removal-bg.jpg";
import donationPickupBg from "@/assets/donation-pickup-bg.jpg";
import { imgStyle, DEFAULT_IMAGE_SETTINGS } from "@/lib/imageSettings";

const baseOptions: { type: ServiceType; title: string; desc: string; Icon: typeof Truck; defaultBg: string; imageKey: string }[] = [
  { type: "junk-removal", title: "Junk Removal", desc: "We haul away your unwanted items quickly and responsibly.", Icon: Truck, defaultBg: junkRemovalBg, imageKey: "junk_removal_card" },
  { type: "donation-pickup", title: "Donation Pickup", desc: "We pick up items and deliver them to local charities.", Icon: Heart, defaultBg: donationPickupBg, imageKey: "donation_pickup_card" },
];

export function StepServiceType() {
  const { state, setServiceType, nextStep, updateCustomer, zipPricing, zipLookupLoading, appImages } = useBooking();
  const zipReady = zipPricing.status === "resolved";
  const zipBlocked = !!state.customer.zip && !zipReady;
  const zipMessage = zipLookupLoading
    ? "Checking pricing for your area..."
    : zipReady
      ? `Minimum service charge for your area: $${zipPricing.minimumPrice}`
      : zipPricing.status === "unmapped"
        ? "We need to confirm pricing for your area"
        : "Enter your ZIP code first to continue";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">What do you need?</h2>
      <p className="text-sm text-muted-foreground mb-6">Choose the service that fits your needs.</p>

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
        <p className={`mt-2 text-xs ${zipBlocked ? "text-destructive" : "text-muted-foreground"}`}>
          {zipMessage}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {baseOptions.map(({ type, title, desc, Icon, defaultBg, imageKey }) => {
          const custom = appImages[imageKey];
          const bgUrl = custom?.url || defaultBg;
          const settings = custom?.url ? custom.settings : DEFAULT_IMAGE_SETTINGS;
          return (
          <button
            key={type}
            type="button"
            disabled={!zipReady}
            onClick={() => {
              if (!zipReady) return;
              setServiceType(type);
              nextStep();
            }}
            className={cn(
              "relative rounded-xl border-2 text-left transition-all overflow-hidden min-h-[200px] flex flex-col justify-end",
              state.serviceType === type
                ? "border-primary shadow-sm ring-2 ring-primary/30"
                : "border-border",
              zipReady ? "hover:shadow-lg hover:border-primary/40" : "cursor-not-allowed opacity-50 grayscale",
            )}
          >
            {/* Background image */}
            <div className="absolute inset-0 overflow-hidden">
              <img src={bgUrl} alt="" style={imgStyle(settings)} />
            </div>
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

            {/* Content */}
            <div className="relative z-10 p-5">
              <div className="h-10 w-10 rounded-lg bg-primary/90 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-white text-lg">{title}</h3>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">{desc}</p>
            </div>
          </button>
          );
        })}
      </div>
    </motion.div>
  );
}
