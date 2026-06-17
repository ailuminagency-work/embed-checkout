import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Loader2, CalendarX } from "lucide-react";

type CancelState = "loading" | "confirm" | "success" | "out_of_window" | "already_cancelled" | "error";

export default function Cancel() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<CancelState>(token ? "confirm" : "error");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: { token },
      });

      if (error) throw new Error(error.message);

      if (data?.already_cancelled) {
        setState("already_cancelled");
      } else if (data?.within_policy === false) {
        setMessage(data.message ?? "Cancellation window has passed.");
        setState("out_of_window");
      } else if (data?.cancelled) {
        setState("success");
      } else {
        throw new Error("Unexpected response from server.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    } finally {
      setProcessing(false);
    }
  };

  if (!token) {
    return (
      <Page>
        <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Invalid Link</h1>
        <p className="text-sm text-muted-foreground">This cancellation link is missing a token. Please check your confirmation email.</p>
      </Page>
    );
  }

  if (state === "confirm") {
    return (
      <Page>
        <CalendarX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Cancel your booking?</h1>
        <p className="text-sm text-muted-foreground mb-6">This action cannot be undone.</p>
        <Button onClick={handleCancel} disabled={processing} variant="destructive" className="w-full">
          {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : "Yes, cancel my booking"}
        </Button>
        <Link to="/" className="block mt-3 text-center text-sm text-muted-foreground hover:text-foreground">
          Keep my booking
        </Link>
      </Page>
    );
  }

  if (state === "success") {
    return (
      <Page>
        <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Booking Cancelled</h1>
        <p className="text-sm text-muted-foreground">Your booking has been cancelled. If you've paid, our team will be in touch regarding any refund.</p>
      </Page>
    );
  }

  if (state === "already_cancelled") {
    return (
      <Page>
        <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Already Cancelled</h1>
        <p className="text-sm text-muted-foreground">This booking has already been cancelled.</p>
      </Page>
    );
  }

  if (state === "out_of_window") {
    return (
      <Page>
        <Clock className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Cancellation Window Passed</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </Page>
    );
  }

  return (
    <Page>
      <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
      <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{message || "This cancellation link may be invalid or expired."}</p>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
