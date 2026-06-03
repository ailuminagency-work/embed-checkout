// Embed entry point — loaded via <script src="widget.js"> on any third-party website.
// Reads Supabase credentials from data-* attributes on the script tag so each
// client can plug in their own project without touching this code.

import React from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BookingWidget from "@/components/booking/BookingWidget";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";

// ── Read credentials from the script tag ─────────────────────────────────────
const script = document.currentScript as HTMLScriptElement | null;
const supabaseUrl  = script?.getAttribute("data-supabase-url")  ?? import.meta.env.VITE_SUPABASE_URL  ?? "";
const supabaseKey  = script?.getAttribute("data-supabase-key")  ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

// ── Expose on window so the singleton client.ts can reference it ─────────────
if (supabaseUrl && supabaseKey) {
  (window as Record<string, unknown>).__EMBED_SUPABASE_URL__ = supabaseUrl;
  (window as Record<string, unknown>).__EMBED_SUPABASE_KEY__ = supabaseKey;
}

// ── Create or find mount container ───────────────────────────────────────────
const container = document.getElementById("booking-widget") ?? (() => {
  const div = document.createElement("div");
  div.id = "booking-widget";
  document.body.appendChild(div);
  return div;
})();

const queryClient = new QueryClient();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BookingWidget />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
