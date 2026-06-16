import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { AdminSidebar, AdminSection } from "@/components/admin/AdminSidebar";
import { CatalogManager } from "@/components/admin/CatalogManager";
import { WebhooksManager } from "@/components/admin/WebhooksManager";
import { ZipPricingManager } from "@/components/admin/ZipPricingManager";
import { BrandingManager } from "@/components/admin/BrandingManager";
import { BookingsManager } from "@/components/admin/BookingsManager";
import { ThemeManager } from "@/components/admin/ThemeManager";
import { DateBlockingManager } from "@/components/admin/DateBlockingManager";
import { ApiKeysManager } from "@/components/admin/ApiKeysManager";
import { TimeWindowManager } from "@/components/admin/TimeWindowManager";
import { ServiceTypeManager } from "@/components/admin/ServiceTypeManager";
import { OnboardingTab } from "@/components/admin/OnboardingTab";
import { TrackingManager } from "@/components/admin/TrackingManager";
import { AddonsManager } from "@/components/admin/AddonsManager";
import { PaymentsManager } from "@/components/admin/PaymentsManager";
import { EventsFeed } from "@/components/admin/EventsFeed";
import { SetupWizard } from "@/components/admin/setup/SetupWizard";

const sectionTitles: Record<AdminSection, string> = {
  setup:          "Setup",
  bookings:       "Bookings",
  events:         "Events",
  catalog:        "Catalog",
  "zip-pricing":  "ZIP Pricing",
  branding:       "Images",
  theme:          "Theme & Branding",
  dates:          "Date Blocking",
  webhooks:       "Webhooks",
  "api-keys":     "API Keys",
  "time-windows": "Time Windows",
  "service-types":"Service Types",
  onboarding:     "Setup & Onboarding",
  tracking:       "Analytics & Tracking",
  addons:         "Add-ons",
  payments:       "Payments & Stripe",
};

export default function Admin() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("bookings");

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/login");
  }, [authLoading, user, isAdmin, navigate]);

  if (authLoading || (!isAdmin && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-auto">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-foreground">{sectionTitles[section]}</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>View Site</Button>
          <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate("/login"))}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <AdminSidebar active={section} onSelect={setSection} />
        <main className="flex-1 max-w-5xl p-6">
          {section === "setup"         && <SetupWizard />}
          {section === "bookings"      && <BookingsManager />}
          {section === "events"        && <EventsFeed />}
          {section === "catalog"       && <CatalogManager />}
          {section === "zip-pricing"   && <ZipPricingManager />}
          {section === "dates"         && <DateBlockingManager />}
          {section === "theme"         && <ThemeManager />}
          {section === "branding"      && <BrandingManager />}
          {section === "webhooks"      && <WebhooksManager />}
          {section === "api-keys"      && <ApiKeysManager />}
          {section === "time-windows"  && <TimeWindowManager />}
          {section === "service-types" && <ServiceTypeManager />}
          {section === "onboarding"    && <OnboardingTab />}
          {section === "tracking"      && <TrackingManager />}
          {section === "addons"        && <AddonsManager />}
          {section === "payments"      && <PaymentsManager />}
        </main>
      </div>
    </div>
  );
}
