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

const sectionTitles: Record<AdminSection, string> = {
  catalog: "Catalog Manager",
  "zip-pricing": "ZIP Pricing Manager",
  branding: "Branding",
  webhooks: "Webhooks",
};

export default function Admin() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("catalog");

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
        <main className="flex-1 max-w-4xl p-4">
          {section === "catalog" && <CatalogManager />}
          {section === "zip-pricing" && <ZipPricingManager />}
          {section === "branding" && <BrandingManager />}
          {section === "webhooks" && <WebhooksManager />}
        </main>
      </div>
    </div>
  );
}
