/**
 * ═══════════════════════════════════════════════════════════
 *  BOOKING WIDGET CONFIGURATION
 *  Edit the values below to customize the widget.
 * ═══════════════════════════════════════════════════════════
 */
export const BOOKING_CONFIG = {
  /** Company name shown in the header */
  companyName: "CleanSlate Hauling",

  /** URL to company logo (leave empty for text-only header) */
  logoUrl: "",

  /** Webhook URL for Make / n8n — receives full booking payload on success */
  webhookUrl: "https://hook.us1.make.com/YOUR-WEBHOOK-ID",

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
