import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Home, Building2, Briefcase, Building } from "lucide-react";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
};

export function StepCustomerDetails() {
  const { state, updateCustomer, zipPricing, zipLookupLoading } = useBooking();
  const c = state.customer;
  const zipInvalid = c.zip.length > 0 && zipPricing.status !== "resolved";

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
              inputMode="tel"
              value={c.phone}
              onChange={(e) => updateCustomer({ phone: formatPhone(e.target.value) })}
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

        {/* Address */}
        <div>
          <Label htmlFor="address" className="text-xs font-medium text-foreground">Pickup Address *</Label>
          <Input
            id="address"
            value={c.address}
            onChange={(e) => updateCustomer({ address: e.target.value })}
            placeholder="123 Main St"
            className="mt-1 bg-card"
          />
        </div>
        <div>
          <Label htmlFor="address2" className="text-xs font-medium text-foreground">Address Line 2</Label>
          <Input
            id="address2"
            value={c.address2 || ""}
            onChange={(e) => updateCustomer({ address2: e.target.value })}
            placeholder="Apt, Suite, Unit, Floor (optional)"
            className="mt-1 bg-card"
          />
        </div>

        {/* Property Type */}
        <div>
          <Label className="text-xs font-medium text-foreground">Property Type *</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {([
              { value: "house", label: "House", icon: Home },
              { value: "building", label: "Building", icon: Building2 },
              { value: "office", label: "Office", icon: Briefcase },
              { value: "apartment", label: "Apartment", icon: Building },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateCustomer({ propertyType: value })}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                  c.propertyType === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
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
                {zipLookupLoading ? "Checking pricing..." : zipPricing.message || "Enter a valid ZIP code"}
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

      </div>
    </motion.div>
  );
}
