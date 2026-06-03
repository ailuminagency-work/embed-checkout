// All client-specific config is loaded at runtime from the Supabase `app_settings` table.
// Use `useAppConfig()` from @/hooks/useAppConfig in components.
// This file is kept only as a fallback for non-React contexts (e.g. webhook.ts).
// Do NOT add real business values here — add them to the app_settings table instead.

export const BOOKING_CONFIG = {
  companyName: "My Business",
  currency: "USD",
  currencySymbol: "$",
  depositMode: false,
  depositPercentage: 25,
  photoPromoPercent: 5,
  zipCodePattern: /^\d{5}(?:-\d{4})?$/,
  stripePublishableKey: "",
  catalogEndpoint: "",
  webhookMode: "test" as "test" | "live",
  webhookUrl: "",
  twinWebhookUrl: "",
};
