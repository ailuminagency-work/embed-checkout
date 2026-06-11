export type AddonStatus = "active" | "inactive" | "error";
export type AddonCategory = "communication" | "marketing" | "operations" | "analytics";

export interface Addon {
  id: string;
  name: string;
  description: string;
  category: AddonCategory;
  icon: string;
  requiredKeys: string[];
  docsUrl: string;
  status: AddonStatus;
  errorMessage?: string;
}

export const ADDON_REGISTRY: Addon[] = [
  {
    id: "sms_confirmation",
    name: "SMS Confirmations",
    description: "Send instant text message confirmations and reminders to customers via Twilio.",
    category: "communication",
    icon: "MessageSquare",
    requiredKeys: ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"],
    docsUrl: "https://twilio.com/docs",
    status: "inactive",
  },
  {
    id: "booking_reminders",
    name: "Booking Reminders",
    description: "Automatically email customers 48 hours and 2 hours before their scheduled pickup.",
    category: "communication",
    icon: "Bell",
    requiredKeys: [],
    docsUrl: "",
    status: "inactive",
  },
  {
    id: "cancellation_flow",
    name: "Self-Serve Cancellation",
    description: "Customers can cancel or reschedule from a link in their confirmation email.",
    category: "operations",
    icon: "CalendarX",
    requiredKeys: [],
    docsUrl: "",
    status: "inactive",
  },
  {
    id: "review_requests",
    name: "Review Requests",
    description: "Automatically ask customers for a Google review 24 hours after their service.",
    category: "marketing",
    icon: "Star",
    requiredKeys: ["google_business_review_url"],
    docsUrl: "https://support.google.com/business",
    status: "inactive",
  },
  {
    id: "promo_codes",
    name: "Promo Codes",
    description: "Create discount codes for marketing campaigns. Applied at checkout.",
    category: "marketing",
    icon: "Tag",
    requiredKeys: [],
    docsUrl: "",
    status: "inactive",
  },
  {
    id: "customer_portal",
    name: "Customer Portal",
    description: "Customers can view their booking history and upcoming appointments.",
    category: "operations",
    icon: "UserCircle",
    requiredKeys: [],
    docsUrl: "",
    status: "inactive",
  },
  {
    id: "google_analytics",
    name: "Google Analytics",
    description: "Track booking funnel events in Google Analytics 4.",
    category: "analytics",
    icon: "BarChart",
    requiredKeys: ["ga4_measurement_id"],
    docsUrl: "https://analytics.google.com",
    status: "inactive",
  },
  {
    id: "google_ads",
    name: "Google Ads Conversions",
    description: "Fire conversion events to Google Ads when a booking is confirmed.",
    category: "analytics",
    icon: "TrendingUp",
    requiredKeys: ["google_ads_conversion_id", "google_ads_conversion_label"],
    docsUrl: "https://ads.google.com",
    status: "inactive",
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description: "Automatically create a Sales Receipt in QuickBooks when a booking is confirmed. Keeps your books in sync with zero manual entry.",
    category: "operations",
    icon: "BookOpen",
    // Connection state lives in app_settings.quickbooks_connected — set by the
    // OAuth flow. Tokens are stored in integration_secrets (admin-only), never
    // in publicly-readable app_settings.
    requiredKeys: ["quickbooks_connected"],
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/get-started",
    status: "inactive",
  },
  {
    id: "multilanguage",
    name: "Multi-Language",
    description: "Display the booking widget in Spanish and other languages.",
    category: "operations",
    icon: "Globe",
    requiredKeys: ["widget_language"],
    docsUrl: "",
    status: "inactive",
  },
];

// Human-readable labels for required settings keys
export const KEY_LABELS: Record<string, string> = {
  twilio_account_sid: "Account SID",
  twilio_auth_token: "Auth Token",
  twilio_phone_number: "Phone Number",
  google_business_review_url: "Google Review URL",
  ga4_measurement_id: "Measurement ID",
  google_ads_conversion_id: "Conversion ID",
  google_ads_conversion_label: "Conversion Label",
  widget_language: "Language Code (e.g. es)",
};
