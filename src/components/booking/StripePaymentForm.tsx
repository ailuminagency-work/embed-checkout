import { useCallback, useEffect, useRef, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_CONFIG } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Singleton — loadStripe is async but only fetches the script once
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe(): ReturnType<typeof loadStripe> {
  if (!stripePromise) {
    stripePromise = loadStripe(BOOKING_CONFIG.stripePublishableKey);
  }
  return stripePromise;
}

interface StripePaymentFormProps {
  amountCents: number;
  bookingReference: string;
  disabled: boolean;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

export function StripePaymentForm(props: StripePaymentFormProps) {
  const { amountCents, bookingReference, disabled, onSuccess, onError } = props;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const createdRef = useRef(false);

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    supabase.functions
      .invoke("create-payment-intent", {
        body: {
          amount: amountCents,
          currency: BOOKING_CONFIG.currency,
          booking_reference: bookingReference,
        },
      })
      .then(({ data, error }) => {
        if (error || !data?.client_secret) {
          setSetupError(error?.message ?? data?.error ?? "Could not initialize payment.");
        } else {
          setClientSecret(data.client_secret);
        }
      });
  }, [amountCents, bookingReference]);

  if (setupError) {
    return (
      <p className="text-sm text-destructive">{setupError}</p>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center min-h-[120px] text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Preparing secure payment…
      </div>
    );
  }

  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: { borderRadius: "8px", colorPrimary: "#6366f1" },
        },
      }}
    >
      <CheckoutForm
        disabled={disabled}
        amountCents={amountCents}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

interface CheckoutFormProps {
  disabled: boolean;
  amountCents: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

function CheckoutForm({ disabled, amountCents, onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      onError(`Unexpected payment status: ${paymentIntent?.status}`);
      setSubmitting(false);
    }
  }, [stripe, elements, submitting, onSuccess, onError]);

  const isLoading = submitting || !ready;
  const displayAmount = `${BOOKING_CONFIG.currencySymbol}${(amountCents / 100).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <PaymentElement onReady={() => setReady(true)} />
      <Button
        onClick={handleSubmit}
        disabled={disabled || isLoading || !stripe}
        aria-busy={submitting}
        className="w-full h-12 text-base font-semibold"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing payment…</>
        ) : !ready ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</>
        ) : (
          `Pay ${displayAmount}`
        )}
      </Button>
    </div>
  );
}

