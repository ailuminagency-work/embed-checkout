import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { BOOKING_CONFIG } from "@/config/booking";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, AlertCircle } from "lucide-react";
import { useRef } from "react";

export function StepCustomerDetails() {
  const { state, updateCustomer } = useBooking();
  const c = state.customer;
  const fileRef = useRef<HTMLInputElement>(null);

  const zipInvalid =
    BOOKING_CONFIG.serviceAreaZips.length > 0 &&
    c.zip.length >= 5 &&
    !BOOKING_CONFIG.serviceAreaZips.includes(c.zip);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">Your details</h2>
      <p className="text-sm text-muted-foreground mb-6">Tell us where and how to reach you.</p>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor="name" className="text-xs font-medium text-foreground">Full Name *</Label>
          <Input
            id="name"
            value={c.name}
            onChange={(e) => updateCustomer({ name: e.target.value })}
            placeholder="Jane Smith"
            className="mt-1 bg-card"
          />
        </div>

        {/* Phone + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone" className="text-xs font-medium text-foreground">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={c.phone}
              onChange={(e) => updateCustomer({ phone: e.target.value })}
              placeholder="(555) 123-4567"
              className="mt-1 bg-card"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs font-medium text-foreground">Email *</Label>
            <Input
              id="email"
              type="email"
              value={c.email}
              onChange={(e) => updateCustomer({ email: e.target.value })}
              placeholder="jane@email.com"
              className="mt-1 bg-card"
            />
          </div>
        </div>

        {/* Address + ZIP */}
        <div>
          <Label htmlFor="address" className="text-xs font-medium text-foreground">Pickup Address *</Label>
          <Input
            id="address"
            value={c.address}
            onChange={(e) => updateCustomer({ address: e.target.value })}
            placeholder="123 Main St, Apt 4B"
            className="mt-1 bg-card"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="zip" className="text-xs font-medium text-foreground">ZIP Code *</Label>
            <Input
              id="zip"
              value={c.zip}
              onChange={(e) => updateCustomer({ zip: e.target.value })}
              placeholder="90210"
              className="mt-1 bg-card"
              maxLength={10}
            />
            {zipInvalid && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Outside our service area
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="gate" className="text-xs font-medium text-foreground">Gate Code</Label>
            <Input
              id="gate"
              value={c.gateCode}
              onChange={(e) => updateCustomer({ gateCode: e.target.value })}
              placeholder="#1234"
              className="mt-1 bg-card"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes" className="text-xs font-medium text-foreground">Special Instructions</Label>
          <Textarea
            id="notes"
            value={c.notes}
            onChange={(e) => updateCustomer({ notes: e.target.value })}
            placeholder="Items are in the garage. Dog is friendly."
            className="mt-1 bg-card resize-none"
            rows={3}
          />
        </div>

        {/* Photo upload */}
        <div>
          <Label className="text-xs font-medium text-foreground">Photos (optional)</Label>
          <p className="text-xs text-muted-foreground mb-2">Help us estimate more accurately.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                updateCustomer({ photos: [...c.photos, ...Array.from(e.target.files)] });
              }
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
              {c.photos.map((f, i) => (
                <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                  <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
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
        </div>
      </div>
    </motion.div>
  );
}
