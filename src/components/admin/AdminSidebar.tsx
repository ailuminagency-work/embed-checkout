import { cn } from "@/lib/utils";
import { Package, Webhook, MapPinned } from "lucide-react";

export type AdminSection = "catalog" | "webhooks" | "zip-pricing";

interface AdminSidebarProps {
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
}

const items: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: "catalog", label: "Catalog", icon: Package },
  { id: "zip-pricing", label: "ZIP Pricing", icon: MapPinned },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
];

export function AdminSidebar({ active, onSelect }: AdminSidebarProps) {
  return (
    <aside className="w-48 shrink-0 border-r border-border bg-card min-h-[calc(100vh-49px)]">
      <nav className="flex flex-col gap-0.5 p-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
              active === item.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
