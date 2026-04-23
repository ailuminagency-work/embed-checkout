import { useBooking } from "@/context/BookingContext";
import { BOOKING_CONFIG } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";

export function MobileBottomBar() {
  const { state, payableAmount, canProceed, nextStep, prevStep, zipPricing } = useBooking();

  return (
    <div className="md:hidden shrink-0 border-t border-border bg-card px-4 py-3 flex items-center gap-3">
      {state.step > 0 && (
        <Button variant="outline" size="icon" onClick={prevStep} className="shrink-0 h-10 w-10">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <div className="flex-1 min-w-0">
        {state.cart.length > 0 ? (
          <div>
            <p className="text-xs text-muted-foreground">{BOOKING_CONFIG.depositMode ? "Deposit" : "Final total"}</p>
            <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
              {BOOKING_CONFIG.currencySymbol}{payableAmount}
            </p>
            {zipPricing.status !== "resolved" && state.customer.zip && (
              <p className="text-[11px] text-destructive truncate">{zipPricing.message}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {state.cart.length === 0 && state.step > 0 ? "Add items to continue" : ""}
          </p>
        )}
      </div>

      {state.step < 4 && (
        <Button
          onClick={nextStep}
          disabled={!canProceed}
          className="shrink-0 h-10 px-6"
        >
          {state.step === 3 ? "Review" : "Next"}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
