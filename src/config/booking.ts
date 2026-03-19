/**
 * ═══════════════════════════════════════════════════════════
 *  BOOKING WIDGET CONFIGURATION
 *  Edit the values below to customize the widget.
 *
 *  WEBHOOK SETUP
 *  Set these env vars (in .env.local or secrets):
 *    VITE_WEBHOOK_MODE          = "test" | "live"
 *    VITE_MAKE_WEBHOOK_URL_TEST = https://hook.us1.make.com/...
 *    VITE_MAKE_WEBHOOK_URL_LIVE = https://hook.us1.make.com/...
 *    VITE_TWIN_WEBHOOK_URL      = https://build.twin.so/...
 * ═══════════════════════════════════════════════════════════
 */

type WebhookMode = "test" | "live";

const webhookMode: WebhookMode =
  (import.meta.env.VITE_WEBHOOK_MODE as WebhookMode) || "test";

const makeWebhookUrls: Record<WebhookMode, string> = {
  test: import.meta.env.VITE_MAKE_WEBHOOK_URL_TEST || "",
  live: import.meta.env.VITE_MAKE_WEBHOOK_URL_LIVE || "",
};

export const BOOKING_CONFIG = {
  /** Company name shown in the header */
  companyName: "CleanSlate Hauling",

  /** URL to company logo (leave empty for text-only header) */
  logoUrl: "",

  /** Current webhook mode — "test" or "live" */
  webhookMode,

  /** Active Make webhook URL (resolved from mode) */
  webhookUrl: makeWebhookUrls[webhookMode],

  /** Twin Agent AI webhook URL */
  twinWebhookUrl: import.meta.env.VITE_TWIN_WEBHOOK_URL || "",

  /** ISO 4217 currency code */
  currency: "USD",

  /** Currency display symbol */
  currencySymbol: "$",

  /** Minimum order charge in dollars */
  minimumCharge: 75,

  /** Allowed ZIP codes — empty array means no filter */
  serviceAreaZips: [] as string[],

  /** true = collect deposit only; false = collect full payment */
  depositMode: false,

  /** Deposit percentage when depositMode is true (e.g. 25 = 25%) */
  depositPercentage: 25,

  /** REST endpoint to fetch item catalog (GET, returns CatalogItem[]).
   *  Leave empty to use the built-in default catalog. */
  catalogEndpoint: "",

  /** Promo discount percentage applied when customer uploads photos (e.g. 5 = 5%) */
  photoPromoPercent: 5,

  /** Stripe publishable key — required for live payments.
   *  Leave empty for demo / simulation mode. */
  stripePublishableKey: "",
};
