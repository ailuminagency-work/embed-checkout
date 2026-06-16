import { AnimatePresence } from "framer-motion";
import { BookingProvider, useBooking } from "@/context/BookingContext";
import { StepIndicator } from "./StepIndicator";
import { StepServiceType } from "./StepServiceType";
import { StepItemCatalog } from "./StepItemCatalog";
import { StepSchedule } from "./StepSchedule";
import { StepCustomerDetails } from "./StepCustomerDetails";
import { StepPayment } from "./StepPayment";
import { OrderSummary } from "./OrderSummary";
import { MobileBottomBar } from "./MobileBottomBar";
import { imgStyle } from "@/lib/imageSettings";

function WidgetInner() {
  const booking = useBooking();
  const { state, appImages, config } = booking;
  const widgetBg = appImages.widget_background;
  const showHeader = !state.completed && (config.show_logo && config.logo_url ? true : !!config.widget_title);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">
      {widgetBg?.url && (
        <>
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            <img src={widgetBg.url} alt="" style={imgStyle(widgetBg.settings)} />
          </div>
          <div
            className="absolute inset-0 bg-background/85 backdrop-blur-sm pointer-events-none"
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {showHeader && (
          <div className="shrink-0 flex items-center gap-2.5 px-4 md:px-6 pt-4 pb-1">
            {config.show_logo && config.logo_url && (
              <img src={config.logo_url} alt={config.business_name} className="h-7 w-auto object-contain" />
            )}
            <span className="font-bold text-base text-foreground">{config.widget_title}</span>
          </div>
        )}
        {!state.completed && <StepIndicator />}

        <div className="flex-1 flex overflow-hidden min-h-0">
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

          {!state.completed && (
            <div className="hidden md:flex w-[340px] border-l border-border flex-col bg-card">
              <OrderSummary />
            </div>
          )}
        </div>

        {!state.completed && <MobileBottomBar />}
      </div>
    </div>
  );
}

export default function BookingWidget() {
  return (
    <BookingProvider>
      <WidgetInner />
    </BookingProvider>
  );
}
