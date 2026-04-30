import { useState } from "react";
import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { BOOKING_CONFIG } from "@/config/booking";
import { sendBookingWebhook } from "@/utils/webhook";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";

type PaymentStatus = "idle" | "processing" | "success" | "error";

export function StepPayment() {
  const {
    state, subtotal, total, payableAmount, itemTotal, adjustedItemTotal, zipPricing,
    setPaymentId, setCompleted,
  } = useBooking();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const isProcessing = paymentStatus === "processing";
  const isDisabled =
    isProcessing ||
    !agreedToTerms ||
    zipPricing.status !== "resolved" ||
    paymentStatus === "success";

  const handleDemoPayment = async () => {
    // Guard against duplicate submissions
    if (isProcessing || paymentStatus === "success") return;

    setPaymentStatus("processing");
    setErrorMessage(null);

    try {
      // Simulate payment processing
      await new Promise((r) => setTimeout(r, 1500));
      const fakeId = `demo_${Date.now()}`;
      setPaymentId(fakeId);

      const { error: logError } = await supabase.from("booking_pricing_logs").insert({
        booking_reference: fakeId,
        zip_code: state.customer.zip,
        minimum_price: zipPricing.minimumPrice,
        item_total: adjustedItemTotal,
        final_price: total,
      });
      if (logError) throw new Error(logError.message);

      await sendBookingWebhook(
        { ...state, paymentId: fakeId },
        subtotal,
        total,
        payableAmount,
      );

      setPaymentStatus("success");
      setCompleted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setPaymentStatus("error");
    }
  };

  // Success screen
  if (state.completed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center py-12"
      >
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Booking Confirmed!</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
          Thank you, {state.customer.name}. We'll see you on{" "}
          {state.selectedDate ? format(state.selectedDate, "MMMM d, yyyy") : "your scheduled date"}{" "}
          during the {state.selectedTimeWindow?.label} window.
        </p>
        <div className="bg-card border border-border rounded-xl p-4 max-w-xs mx-auto text-left text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium text-foreground capitalize">
              {state.serviceType?.replace("-", " ")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items</span>
            <span className="font-medium text-foreground">{state.cart.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {BOOKING_CONFIG.depositMode ? "Deposit Paid" : "Total Paid"}
            </span>
            <span className="font-bold text-foreground">
              {BOOKING_CONFIG.currencySymbol}{payableAmount}
            </span>
          </div>
          {state.paymentId && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Ref: {state.paymentId}</span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">Review & Pay</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {BOOKING_CONFIG.depositMode
          ? `A ${BOOKING_CONFIG.depositPercentage}% deposit is required to confirm your booking.`
          : "Full payment is required to confirm your booking."}
      </p>

      {/* Order review */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Service</span>
          <span className="font-medium text-foreground capitalize">
            {state.serviceType?.replace("-", " ")}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Date</span>
          <span className="font-medium text-foreground">
            {state.selectedDate ? format(state.selectedDate, "MMM d, yyyy") : "—"}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Time</span>
          <span className="font-medium text-foreground">{state.selectedTimeWindow?.label ?? "—"}</span>
        </div>
        <div className="border-t border-border pt-3">
          {state.cart.map((c) => (
            <div key={c.item.id} className="flex justify-between py-1">
              <span className="text-foreground">
                {c.item.name} × {c.quantity}
              </span>
              <span className="font-medium text-foreground">
                {BOOKING_CONFIG.currencySymbol}{c.item.price * c.quantity}
              </span>
            </div>
          ))}
          {state.customItems.map((ci, i) => (
            <div key={i} className="flex justify-between py-1">
              <span className="text-foreground">{ci.description}</span>
              <span className="text-muted-foreground text-xs">TBD</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Item total</span>
          <span>{BOOKING_CONFIG.currencySymbol}{itemTotal}</span>
        </div>
        {zipPricing.status === "resolved" && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <span>Adjusted item total</span>
              <span>{BOOKING_CONFIG.currencySymbol}{adjustedItemTotal}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Area minimum</span>
              <span>{BOOKING_CONFIG.currencySymbol}{zipPricing.minimumPrice}</span>
            </div>
            {adjustedItemTotal < (zipPricing.minimumPrice ?? 0) && (
              <div className="text-xs text-accent flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Minimum service charge applied for ZIP {zipPricing.zipCode}
              </div>
            )}
          </>
        )}
        <div className="border-t border-border pt-3 flex justify-between font-bold text-foreground">
          <span>{BOOKING_CONFIG.depositMode ? "Deposit Due" : "Final adjusted total"}</span>
          <span>{BOOKING_CONFIG.currencySymbol}{payableAmount}</span>
        </div>
      </div>

      {/* Terms agreement */}
      <div className="flex items-start gap-3 mb-6">
        <Checkbox
          id="terms"
          checked={agreedToTerms}
          onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
          disabled={isProcessing}
          className="mt-0.5"
        />
        <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:text-primary">Terms of Service</a>{" "}
          and{" "}
          <a href="/cancellation-policy" target="_blank" rel="noopener noreferrer" className="underline text-foreground hover:text-primary">Cancellation Policy</a>.
          I understand that pricing may be adjusted on-site based on actual items.
        </Label>
      </div>

      {/* Error state */}
      {paymentStatus === "error" && errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Payment area */}
      {!BOOKING_CONFIG.stripePublishableKey ? (
        <div className="space-y-4">
          <div className="bg-muted rounded-xl p-4 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Demo Mode</p>
            <p>Stripe is not configured. Click below to simulate a payment.</p>
          </div>
          <Button
            onClick={handleDemoPayment}
            disabled={isDisabled}
            aria-busy={isProcessing}
            className="w-full h-12 text-base font-semibold"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing payment...
              </>
            ) : paymentStatus === "error" ? (
              `Retry payment`
            ) : (
              `Pay ${BOOKING_CONFIG.currencySymbol}${payableAmount}`
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6 min-h-[120px] flex items-center justify-center text-sm text-muted-foreground">
            Stripe Payment Element will render here
          </div>
          <Button
            onClick={handleDemoPayment}
            disabled={isDisabled}
            aria-busy={isProcessing}
            className="w-full h-12 text-base font-semibold"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing payment...
              </>
            ) : paymentStatus === "error" ? (
              `Retry payment`
            ) : (
              `Pay ${BOOKING_CONFIG.currencySymbol}${payableAmount}`
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
