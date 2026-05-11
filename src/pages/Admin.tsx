import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AdminSidebar, AdminSection } from "@/components/admin/AdminSidebar";
import { CatalogManager } from "@/components/admin/CatalogManager";
import { WebhooksManager } from "@/components/admin/WebhooksManager";
import { ZipPricingManager } from "@/components/admin/ZipPricingManager";
import { BrandingManager } from "@/components/admin/BrandingManager";
import { TimeWindowsManager } from "@/components/admin/TimeWindowsManager";
import { StripeAnalytics } from "@/components/admin/StripeAnalytics";

const sectionTitles: Record<AdminSection, string> = {
  catalog: "Catalog Manager",
  "zip-pricing": "ZIP Pricing Manager",
  "time-windows": "Time Windows",
  branding: "Images",
  webhooks: "Webhooks",
  analytics: "Analytics",
};

function AdminInner() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("catalog");

  return (
    <div className="min-h-screen bg-background overflow-auto">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-foreground">{sectionTitles[section]}</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>View Site</Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => signOut().then(() => navigate("/login"))}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <AdminSidebar active={section} onSelect={setSection} />
        <main className="flex-1 max-w-4xl p-4">
          {section === "catalog" && (
            <ErrorBoundary label="CatalogManager">
              <CatalogManager />
            </ErrorBoundary>
          )}
          {section === "zip-pricing" && (
            <ErrorBoundary label="ZipPricingManager">
              <ZipPricingManager />
            </ErrorBoundary>
          )}
          {section === "time-windows" && (
            <ErrorBoundary label="TimeWindowsManager">
              <TimeWindowsManager />
            </ErrorBoundary>
          )}
          {section === "branding" && (
            <ErrorBoundary label="BrandingManager">
              <BrandingManager />
            </ErrorBoundary>
          )}
          {section === "webhooks" && (
            <ErrorBoundary label="WebhooksManager">
              <WebhooksManager />
            </ErrorBoundary>
          )}
          {section === "analytics" && (
            <ErrorBoundary label="StripeAnalytics">
              <StripeAnalytics />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <RequireAdmin>
      <AdminInner />
    </RequireAdmin>
  );
}
