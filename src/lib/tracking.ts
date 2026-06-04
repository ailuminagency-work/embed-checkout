// Non-blocking analytics. All functions are wrapped in try/catch — they never throw.
// No PII is sent: only event names, currency codes, and numeric amounts.

export interface TrackingConfig {
  enabled: boolean;
  ga4MeasurementId: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function ensureGtag(measurementId: string) {
  if (document.querySelector(`script[src*="${measurementId}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function (...args) { window.dataLayer.push(args); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
}

export function initTracking(cfg: TrackingConfig) {
  try {
    if (!cfg.enabled) return;
    if (cfg.ga4MeasurementId) ensureGtag(cfg.ga4MeasurementId);
  } catch (e) {
    console.warn("[tracking] init failed:", e);
  }
}

export function trackEvent(
  eventName: string,
  params: Record<string, string | number | boolean>,
  cfg?: TrackingConfig,
) {
  try {
    if (!cfg?.enabled) return;

    // GTM dataLayer — always push if dataLayer exists
    if (window.dataLayer) {
      window.dataLayer.push({ event: eventName, ...params });
    }

    if (typeof window.gtag !== "function") return;

    // GA4
    if (cfg.ga4MeasurementId) {
      window.gtag("event", eventName, params);
    }

    // Google Ads conversion on booking_confirmed only
    if (eventName === "booking_confirmed" && cfg.googleAdsConversionId && cfg.googleAdsConversionLabel) {
      window.gtag("event", "conversion", {
        send_to: `${cfg.googleAdsConversionId}/${cfg.googleAdsConversionLabel}`,
        value: params.value,
        currency: params.currency,
        transaction_id: params.transaction_id,
      });
    }
  } catch (e) {
    console.warn(`[tracking] event "${eventName}" failed:`, e);
  }
}
