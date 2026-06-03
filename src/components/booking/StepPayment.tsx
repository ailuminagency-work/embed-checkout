import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useBooking } from "@/context/BookingContext";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Loader2, XCircle, Lock, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import type { BookingState } from "@/types/booking";

type PaymentStatus = "idle" | "processing" | "success" | "error";

// ── save booking record ────────────────────────────────────────────────────────
async function saveBooking(
  state: BookingState,
  paymentId: string,
  itemTotal: number,
  photoPromoDiscount: number,
  adjustedItemTotal: number,
  total: number,
  payableAmount: number,
  minimumPrice: number | null,
  depositMode: boolean = false,
): Promise<boolean> {
  const result = await createBooking({
    reference: paymentId,
    service_type: state.serviceType ?? "unknown",
    status: "confirmed",
    customer_name: state.customer.name,
    customer_email: state.customer.email,
    customer_phone: state.customer.phone,
    customer_address: state.customer.address,
    customer_address2: state.customer.address2 ?? null,
    customer_zip: state.customer.zip,
    customer_property_type: state.customer.propertyType,
    customer_gate_code: state.customer.gateCode || null,
    schedule_date: state.selectedDate ? format(state.selectedDate, "yyyy-MM-dd") : null,
    schedule_time_window: state.selectedTimeWindow?.label ?? null,
    items: state.cart.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      price: c.item.price,
      quantity: c.quantity,
      lineTotal: c.item.price * c.quantity,
    })),
    custom_items: state.customItems,
    item_total: itemTotal,
    photo_promo_discount: photoPromoDiscount,
    adjusted_item_total: adjustedItemTotal,
    minimum_price: minimumPrice,
    final_total: total,
    amount_charged: payableAmount,
    deposit_mode: depositMode,
    payment_id: paymentId,
    notes: state.customer.notes || null,
  });
  return result !== null;
}

// ── send confirmation email ────────────────────────────────────────────────────
async function sendConfirmationEmail(state: BookingState, total: number) {
  try {
    await supabase.functions.invoke("send-confirmation", {
      body: {
        customerName: state.customer.name,
        customerEmail: state.customer.email,
        serviceType: state.serviceType,
        scheduleDate: state.selectedDate ? format(state.selectedDate, "MMMM d, yyyy") : null,
        timeWindow: state.selectedTimeWindow?.label,
        items: state.cart.map((c) => ({ name: c.item.name, quantity: c.quantity, price: c.item.price })),
        total,
        reference: state.paymentId,
      },
    });
  } catch (e) {
    console.warn("[Email] Confirmation send failed (non-blocking):", e);
  }
}

// ── success screen ─────────────────────────────────────────────────────────────
function SuccessScreen() {
  const { state, config, payableAmount } = useBooking();
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
        {state.customer.email && " A confirmation has been sent to your email."}
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
            {config.deposit_mode ? "Deposit Paid" : "Total Paid"}
          </span>
          <span className="font-bold text-foreground">
            {config.currency_symbol}{payableAmount}
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

// ── stripe card form ───────────────────────────────────────────────────────────
interface StripeFormProps {
  clientSecret: string;
  agreedToTerms: boolean;
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}

function StripeCardForm({ clientSecret, agreedToTerms, onSuccess, onError }: StripeFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const { payableAmount, config } = useBooking();

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    const card = elements.getElement(CardElement);
    if (!card) { setProcessing(false); return; }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });

    if (error) {
      onError(error.message ?? "Payment failed. Please try again.");
      setProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Payment details</h3>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Powered by Stripe
          </span>
        </div>
        <div className="rounded-md border border-input bg-background px-3 py-3">
          <CardElement options={{
            style: {
              base: { fontSize: "14px", color: "hsl(var(--foreground))", "::placeholder": { color: "hsl(var(--muted-foreground))" } },
              invalid: { color: "hsl(var(--destructive))" },
            },
            hidePostalCode: true,
          }} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Your payment is encrypted and secure.
        </div>
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!stripe || processing || !agreedToTerms}
        aria-busy={processing}
        className="w-full h-12 text-base font-semibold"
      >
        {processing ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
        ) : (
          `Pay ${config.currency_symbol}${payableAmount}`
        )}
      </Button>
    </div>
  );
}

// ── demo payment form ──────────────────────────────────────────────────────────
interface DemoFormProps {
  agreedToTerms: boolean;
  onSuccess: (paymentId: string) => void;
  onError: (msg: string) => void;
}

function DemoPaymentForm({ agreedToTerms, onSuccess, onError }: DemoFormProps) {
  const [processing, setProcessing] = useState(false);
  const { payableAmount, config } = useBooking();

  const handlePay = async () => {
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1400));
      onSuccess(`demo_${Date.now()}`);
    } catch {
      onError("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Payment details</h3>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Secure
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-11 rounded-md border border-dashed border-border bg-muted/40 flex items-center px-3 text-xs text-muted-foreground">
            Card number •••• •••• •••• ••••
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-11 rounded-md border border-dashed border-border bg-muted/40 flex items-center px-3 text-xs text-muted-foreground">MM / YY</div>
            <div className="h-11 rounded-md border border-dashed border-border bg-muted/40 flex items-center px-3 text-xs text-muted-foreground">CVC</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground border-t border-border pt-3">
          Demo mode — Stripe not connected. Click pay to simulate the booking.
        </p>
      </div>
      <Button
        onClick={handlePay}
        disabled={processing || !agreedToTerms}
        aria-busy={processing}
        className="w-full h-12 text-base font-semibold"
      >
        {processing ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing payment…</>
        ) : (
          `Pay ${config.currency_symbol}${payableAmount}`
        )}
      </Button>
    </div>
  );
}

// ── main step ──────────────────────────────────────────────────────────────────
export function StepPayment() {
  const {
    state, config, subtotal, total, payableAmount, adjustedItemTotal,
    photoPromoDiscount, itemTotal, zipPricing,
    setPaymentId, setCompleted,
  } = useBooking();
  const { toast } = useToast();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState<number | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  const stripeKey = config.stripe_publishable_key;
  const useStripeMode = !!stripeKey;
  const sym = config.currency_symbol;

  // load stripe + create PaymentIntent with server-calculated amount (Change 3)
  useEffect(() => {
    if (!useStripeMode || paymentStatus === "success") return;
    setStripeLoading(true);
    setStripePromise(loadStripe(stripeKey!));

    const cartItems = state.cart.map((c) => ({ id: c.item.id, quantity: c.quantity }));
    const photosUploaded = state.customer.photos.length > 0;

    supabase.functions
      .invoke("create-payment-intent", {
        body: { items: cartItems, zip_code: state.customer.zip, photos_uploaded: photosUploaded },
      })
      .then(({ data, error }) => {
        if (error || !data?.client_secret) {
          setErrorMessage("Could not initialise payment. Please refresh and try again.");
        } else {
          setClientSecret(data.client_secret);
          setVerifiedAmount(data.verified_amount);
          if (data.verified_amount !== payableAmount) {
            toast({
              title: "Price adjusted",
              description: `Your total has been verified at ${sym}${data.verified_amount}.`,
            });
          }
        }
        setStripeLoading(false);
      });
  }, [useStripeMode, stripeKey, state.cart, state.customer.zip, state.customer.photos.length]);

  const displayAmount = verifiedAmount ?? payableAmount;

  const handleSuccess = useCallback(async (paymentId: string) => {
    setPaymentId(paymentId);
    setPaymentStatus("processing");

    const saved = await saveBooking(
      state, paymentId, itemTotal, photoPromoDiscount,
      adjustedItemTotal, total, displayAmount, zipPricing.minimumPrice,
      config.deposit_mode,
    );

    if (!saved) {
      toast({
        variant: "destructive",
        title: "Booking recorded with issues",
        description: "Your payment succeeded but we had trouble saving your booking. Our team will reach out to confirm.",
      });
    }

    // Webhook delivery is handled server-side by the DB trigger on bookings INSERT
    await sendConfirmationEmail({ ...state, paymentId }, displayAmount);

    setPaymentStatus("success");
    setCompleted(true);
  }, [state, itemTotal, photoPromoDiscount, adjustedItemTotal, total, displayAmount,
      zipPricing.minimumPrice, setPaymentId, setCompleted, toast]);

  const handleError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setPaymentStatus("error");
  }, []);

  if (state.completed) return <SuccessScreen />;

  const stripeElementsOptions = clientSecret
    ? ({ clientSecret, appearance: { theme: "stripe" as const } })
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">Review & Pay</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {config.deposit_mode
          ? `A ${config.deposit_percentage}% deposit is required to confirm your booking.`
          : "Full payment is required to confirm your booking."}
      </p>

      {/* Mobile total */}
      <div className="md:hidden bg-card border border-border rounded-xl p-4 mb-6 flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {config.deposit_mode ? "Deposit due" : "Total due"}
        </span>
        <span className="text-xl font-bold text-foreground">
          {sym}{displayAmount}
        </span>
      </div>

      {/* Terms */}
      <div className="flex items-start gap-3 mb-6">
        <Checkbox
          id="terms"
          checked={agreedToTerms}
          onCheckedChange={(c) => setAgreedToTerms(c === true)}
          disabled={paymentStatus === "processing"}
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

      {/* Error */}
      {paymentStatus === "error" && errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Payment form */}
      {useStripeMode ? (
        stripeLoading || !clientSecret || !stripePromise ? (
          <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading secure payment form…
          </div>
        ) : (
          <Elements stripe={stripePromise} options={stripeElementsOptions}>
            <StripeCardForm
              clientSecret={clientSecret}
              agreedToTerms={agreedToTerms}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </Elements>
        )
      ) : (
        <DemoPaymentForm
          agreedToTerms={agreedToTerms}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}
    </motion.div>
  );
}
