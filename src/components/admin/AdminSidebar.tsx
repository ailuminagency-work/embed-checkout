import { cn } from "@/lib/utils";
import {
  Package, Webhook, MapPinned, Image as ImageIcon,
  CalendarX, Palette, ClipboardList, KeyRound,
  Clock, Layers, Rocket, BarChart3, Puzzle, CreditCard, Activity, Wand2,
} from "lucide-react";

export type AdminSection =
  | "setup"
  | "bookings"
  | "events"
  | "catalog"
  | "zip-pricing"
  | "branding"
  | "theme"
  | "dates"
  | "webhooks"
  | "api-keys"
  | "time-windows"
  | "service-types"
  | "onboarding"
  | "tracking"
  | "addons"
  | "payments";

interface AdminSidebarProps {
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
}

const groups: { label: string; items: { id: AdminSection; label: string; icon: React.ElementType }[] }[] = [
  {
    label: "Get Started",
    items: [
      { id: "setup", label: "Setup Wizard", icon: Wand2 },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "bookings",      label: "Bookings",      icon: ClipboardList },
      { id: "events",        label: "Events",         icon: Activity },
      { id: "catalog",       label: "Catalog",        icon: Package },
      { id: "zip-pricing",   label: "ZIP Pricing",    icon: MapPinned },
      { id: "dates",         label: "Date Blocking",  icon: CalendarX },
      { id: "time-windows",  label: "Time Windows",   icon: Clock },
      { id: "service-types", label: "Service Types",  icon: Layers },
    ],
  },
  {
    label: "Customise",
    items: [
      { id: "theme",    label: "Theme",    icon: Palette },
      { id: "branding", label: "Images",   icon: ImageIcon },
      { id: "webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    label: "Integrations",
    items: [
      { id: "payments",    label: "Payments",    icon: CreditCard },
      { id: "api-keys",    label: "API Keys",    icon: KeyRound },
      { id: "tracking",    label: "Analytics",   icon: BarChart3 },
      { id: "addons",      label: "Add-ons",     icon: Puzzle },
      { id: "onboarding",  label: "Health Check", icon: Rocket },
    ],
  },
];

export function AdminSidebar({ active, onSelect }: AdminSidebarProps) {
  return (
    <aside className="w-52 shrink-0 border-r border-border bg-card min-h-[calc(100vh-49px)]">
      <nav className="flex flex-col gap-4 p-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
                    active === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
