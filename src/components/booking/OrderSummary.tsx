import { useBooking } from "@/context/BookingContext";
import { BOOKING_CONFIG } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, AlertTriangle, ArrowRight, ArrowLeft, Tag } from "lucide-react";

export function OrderSummary() {
  const {
    state, itemTotal, adjustedItemTotal, photoPromoDiscount, total, payableAmount,
    canProceed, nextStep, prevStep, zipPricing,
  } = useBooking();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm text-foreground">Order Summary</h3>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4 text-sm">
          {/* Service type */}
          {state.serviceType && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Service</span>
              <p className="text-foreground font-medium capitalize mt-0.5">
                {state.serviceType.replace("-", " ")}
              </p>
            </div>
          )}

          {/* Cart items */}
          {state.cart.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</span>
              <div className="mt-1 space-y-1.5">
                {state.cart.map((c) => (
                  <div key={c.item.id} className="flex justify-between">
                    <span className="text-foreground">
                      {c.item.name}
                      {c.quantity > 1 && (
                        <span className="text-muted-foreground"> × {c.quantity}</span>
                      )}
                    </span>
                    <span className="font-medium text-foreground tabular-nums">
                      {BOOKING_CONFIG.currencySymbol}{c.item.price * c.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom items */}
          {state.customItems.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Items</span>
              <div className="mt-1 space-y-1">
                {state.customItems.map((ci, i) => (
                  <p key={i} className="text-foreground text-xs">• {ci.description}</p>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          {state.selectedDate && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Schedule</span>
              <p className="text-foreground mt-0.5">
                {state.selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              {state.selectedTimeWindow && (
                <p className="text-muted-foreground text-xs">{state.selectedTimeWindow.label}</p>
              )}
            </div>
          )}

          {/* Empty state */}
          {state.cart.length === 0 && !state.serviceType && (
            <p className="text-muted-foreground text-center py-8 text-xs">
              Your selections will appear here.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Totals + actions */}
      <div className="border-t border-border p-4 space-y-3">
        {state.cart.length > 0 && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Item total</span>
              <span className="tabular-nums">{BOOKING_CONFIG.currencySymbol}{itemTotal}</span>
            </div>
            {photoPromoDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Photo promo ({BOOKING_CONFIG.photoPromoPercent}% off)
                </span>
                <span className="tabular-nums">-{BOOKING_CONFIG.currencySymbol}{photoPromoDiscount}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Adjusted item total</span>
              <span className="tabular-nums">{BOOKING_CONFIG.currencySymbol}{adjustedItemTotal}</span>
            </div>
            {zipPricing.status === "resolved" && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Area minimum</span>
                  <span className="tabular-nums">{BOOKING_CONFIG.currencySymbol}{zipPricing.minimumPrice}</span>
                </div>
                {adjustedItemTotal < (zipPricing.minimumPrice ?? 0) && (
                  <div className="flex items-center gap-1 text-xs text-accent">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Minimum service charge applied for {zipPricing.zoneName}</span>
                  </div>
                )}
              </>
            )}
            {zipPricing.status !== "resolved" && state.customer.zip && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                <span>{zipPricing.message}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground">
              <span>{BOOKING_CONFIG.depositMode ? "Deposit" : "Final adjusted total"}</span>
              <span className="tabular-nums">{BOOKING_CONFIG.currencySymbol}{payableAmount}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {state.step > 0 && (
            <Button variant="outline" size="sm" onClick={prevStep} className="flex-none">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {state.step < 4 && (
            <Button
              onClick={nextStep}
              disabled={!canProceed}
              className="flex-1 h-10"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
