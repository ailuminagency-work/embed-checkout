import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { ServiceType } from "@/types/booking";
import { cn } from "@/lib/utils";
import { Truck, Heart } from "lucide-react";

const options: { type: ServiceType; title: string; desc: string; Icon: typeof Truck }[] = [
  { type: "junk-removal", title: "Junk Removal", desc: "We haul away your unwanted items quickly and responsibly.", Icon: Truck },
  { type: "donation-pickup", title: "Donation Pickup", desc: "We pick up items and deliver them to local charities.", Icon: Heart },
];

export function StepServiceType() {
  const { state, setServiceType, nextStep } = useBooking();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">What do you need?</h2>
      <p className="text-sm text-muted-foreground mb-6">Choose the service that fits your needs.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map(({ type, title, desc, Icon }) => (
          <button
            key={type}
            onClick={() => {
              setServiceType(type);
              nextStep();
            }}
            className={cn(
              "p-6 rounded-xl border-2 text-left transition-all hover:shadow-md",
              state.serviceType === type
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 bg-card",
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
