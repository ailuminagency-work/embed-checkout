import { useState } from "react";
import { motion } from "framer-motion";
import { useBooking } from "@/context/BookingContext";
import { BOOKING_CONFIG } from "@/config/booking";
import { sendBookingWebhook } from "@/utils/webhook";
import { supabase } from "@/integrations/supabase/client";
import { StripePaymentForm } from "./StripePaymentForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Loader2, XCircle, Lock } from "lucide-react";
import { format } from "date-fns";

type PaymentStatus = "idle" | "processing" | "success" | "error";

export function StepPayment() {
  const {
    state, subtotal, total, payableAmount, adjustedItemTotal, zipPricing,
    setPaymentId, setCompleted,
  } = useBooking();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const isProcessing = paymentStatus === "processing";
  const isSuccess = paymentStatus === "success";
  const formDisabled = isProcessing || isSuccess || !agreedToTerms || zipPricing.status !== "resolved";

  // Shared post-payment logic used by both demo and Stripe paths
  const handlePaymentSuccess = async (paymentId: string) => {
    setPaymentStatus("processing");
    setErrorMessage(null);

    try {
      setPaymentId(paymentId);

      const { error: logError } = await supabase.from("booking_pricing_logs").insert({
        booking_reference: paymentId,
        zip_code: state.customer.zip,
        minimum_price: zipPricing.minimumPrice,
        item_total: adjustedItemTotal,
        final_price: total,
      });
      if (logError) console.error("[BookingLog] Failed to write pricing log:", logError.message);

      await sendBookingWebhook(
        { ...state, paymentId },
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

  const handlePaymentError = (message: string) => {
    setErrorMessage(message);
    setPaymentStatus("error");
  };

  // Demo path — no Stripe key configured
  const handleDemoPayment = async () => {
    if (isProcessing || isSuccess) return;
    await handlePaymentSuccess(`demo_${Date.now()}`);
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
              {state.serviceType?.replaceAll("-", " ")}
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
              {BOOKING_CONFIG.currencySymbol}{payableAmount.toFixed(2)}
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

  // Amount in cents for Stripe (payableAmount is already in dollars)
  const amountCents = Math.round(payableAmount * 100);
  const bookingReference = `booking_${Date.now()}`;

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

      {/* Mobile-only summary (desktop has right column) */}
      <div className="md:hidden bg-card border border-border rounded-xl p-4 mb-6 flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {BOOKING_CONFIG.depositMode ? "Deposit due" : "Total due"}
        </span>
        <span className="text-xl font-bold text-foreground">
          {BOOKING_CONFIG.currencySymbol}{payableAmount.toFixed(2)}
        </span>
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
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Payment details</h3>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {BOOKING_CONFIG.stripePublishableKey ? "Powered by Stripe" : "Secure"}
          </span>
        </div>

        {BOOKING_CONFIG.stripePublishableKey ? (
          <StripePaymentForm
            amountCents={amountCents}
            bookingReference={bookingReference}
            disabled={formDisabled}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        ) : (
          <>
            <div className="space-y-3">
              <div className="h-11 rounded-md border border-dashed border-border bg-muted/40 flex items-center px-3 text-xs text-muted-foreground">
                Card number •••• •••• •••• ••••
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 rounded-md border border-dashed border-border bg-muted/40 flex items-center px-3 text-xs text-muted-foreground">
                  MM / YY
                </div>
                <div className="h-11 rounded-md border border-dashed border-border bg-muted/40 flex items-center px-3 text-xs text-muted-foreground">
                  CVC
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Demo mode — add <code className="font-mono">VITE_STRIPE_PUBLISHABLE_KEY</code> to enable real payments.
            </p>
            <Button
              onClick={handleDemoPayment}
              disabled={formDisabled}
              aria-busy={isProcessing}
              className="w-full h-12 text-base font-semibold"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing payment…</>
              ) : paymentStatus === "error" ? (
                "Retry payment"
              ) : (
                `Pay ${BOOKING_CONFIG.currencySymbol}${payableAmount.toFixed(2)}`
              )}
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}
