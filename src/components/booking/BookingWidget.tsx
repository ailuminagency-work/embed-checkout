import { AnimatePresence } from "framer-motion";
import { BOOKING_CONFIG } from "@/config/booking";
import { BookingProvider, useBooking } from "@/context/BookingContext";
import { StepIndicator } from "./StepIndicator";
import { StepServiceType } from "./StepServiceType";
import { StepItemCatalog } from "./StepItemCatalog";
import { StepSchedule } from "./StepSchedule";
import { StepCustomerDetails } from "./StepCustomerDetails";
import { StepPayment } from "./StepPayment";
import { OrderSummary } from "./OrderSummary";
import { MobileBottomBar } from "./MobileBottomBar";
import { Truck } from "lucide-react";

function WidgetInner() {
  const { state } = useBooking();

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      










      

      {/* Step indicator */}
      {!state.completed && <StepIndicator />}

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Step content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-2xl">
            <AnimatePresence mode="wait">
              {state.step === 0 && <StepServiceType key="step-0" />}
              {state.step === 1 && <StepItemCatalog key="step-1" />}
              {state.step === 2 && <StepSchedule key="step-2" />}
              {state.step === 3 && <StepCustomerDetails key="step-3" />}
              {state.step === 4 && <StepPayment key="step-4" />}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Sticky summary (desktop only) */}
        {!state.completed &&
        <div className="hidden md:flex w-[340px] border-l border-border flex-col bg-card">
            <OrderSummary />
          </div>
        }
      </div>

      {/* Mobile bottom bar */}
      {!state.completed && <MobileBottomBar />}
    </div>);

}

export default function BookingWidget() {
  return (
    <BookingProvider>
      <WidgetInner />
    </BookingProvider>);

}